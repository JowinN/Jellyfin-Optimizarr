import asyncio
from datetime import datetime
from typing import Dict, Any, List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func, or_

from app.database import AsyncSessionLocal
from app.models.automation import AutomationRule
from app.models.media import MediaItem
from app.models.job import EncodingJob
from app.models.profile import EncodingProfile
from app.core.logging import logger
from app.core.events import event_broadcaster

class AutomationService:
    """Manages scheduled and automated rule-based background optimization."""

    def __init__(self):
        self._is_running = False
        self._scheduler_task: Optional[asyncio.Task] = None

    def start(self):
        """Starts periodic rule evaluation background loop."""
        if not self._is_running:
            self._is_running = True
            self._scheduler_task = asyncio.create_task(self._periodic_loop())
            logger.info("Automation Scheduler service started.")

    def stop(self):
        """Stops the periodic rule evaluation loop."""
        self._is_running = False
        if self._scheduler_task:
            self._scheduler_task.cancel()
            logger.info("Automation Scheduler service stopped.")

    async def _periodic_loop(self):
        """Runs periodic checks every 60 seconds to catch newly added media or pending rules."""
        await asyncio.sleep(15)  # Initial grace delay on startup
        while self._is_running:
            try:
                async with AsyncSessionLocal() as session:
                    await self.evaluate_all_active_rules(session)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in automation periodic evaluation loop: {e}")

            # Sleep 60 seconds between evaluations
            for _ in range(60):
                if not self._is_running:
                    break
                await asyncio.sleep(1)

    async def get_matching_media(self, session: AsyncSession, rule: AutomationRule) -> List[MediaItem]:
        """Returns all media items matching the scope of a given automation rule."""
        query = select(MediaItem)

        if rule.scope_type == "library" and rule.target_library:
            query = query.where(func.lower(MediaItem.library) == rule.target_library.lower())
        elif rule.scope_type == "series" and rule.target_series_name:
            query = query.where(func.lower(MediaItem.series_name) == rule.target_series_name.lower())

        # Order by season, episode or filename for logical queueing
        query = query.order_by(
            MediaItem.series_name.asc(),
            MediaItem.season_number.asc(),
            MediaItem.episode_number.asc(),
            MediaItem.filename.asc()
        )

        res = await session.execute(query)
        return list(res.scalars().all())

    async def evaluate_rule(self, session: AsyncSession, rule_id: int) -> Dict[str, Any]:
        """Evaluates an individual rule: updates matched counts and queues unoptimized media."""
        stmt_rule = select(AutomationRule).where(AutomationRule.id == rule_id)
        rule = (await session.execute(stmt_rule)).scalar_one_or_none()
        if not rule:
            return {"rule_id": rule_id, "queued_jobs": 0, "matched_items": 0, "message": "Rule not found"}

        stmt_prof = select(EncodingProfile).where(EncodingProfile.id == rule.profile_id)
        profile = (await session.execute(stmt_prof)).scalar_one_or_none()
        if not profile:
            return {"rule_id": rule_id, "queued_jobs": 0, "matched_items": 0, "message": "Associated profile not found"}

        matching_items = await self.get_matching_media(session, rule)
        matched_total = len(matching_items)
        queued_count = 0
        completed_count = 0

        # Resolve assigned node display name
        assigned_name = rule.assigned_node_name
        if not assigned_name and rule.assigned_node_id:
            if rule.assigned_node_id == "windows-node":
                assigned_name = "Windows PC (Quadro K620)"
            elif rule.assigned_node_id == "local":
                assigned_name = "Ubuntu Server (Local)"

        for item in matching_items:
            if item.optimization_status == "optimized":
                completed_count += 1
                continue

            if not rule.is_active:
                continue

            # ZERO-BLOAT SMART GUARD: If item already meets or exceeds target size constraint, skip it!
            target_mb_min = getattr(profile, "target_mb_per_minute", 0.0) or 0.0
            if target_mb_min > 0 and item.duration_seconds and item.duration_seconds > 0 and item.size_bytes > 0:
                target_size_bytes = int(target_mb_min * 1024 * 1024 * (item.duration_seconds / 60.0))
                if item.size_bytes <= target_size_bytes:
                    completed_count += 1
                    continue

            # Check if this item is unoptimized or failed and needs queueing
            if item.optimization_status in ("unoptimized", "failed"):
                # Ensure no pending/running job exists for this media item
                stmt_existing = select(EncodingJob).where(
                    and_(
                        EncodingJob.media_item_id == item.id,
                        EncodingJob.status.in_(["pending", "running"]),
                    )
                )
                existing_job = (await session.execute(stmt_existing)).scalar_one_or_none()

                if not existing_job:
                    job = EncodingJob(
                        media_item_id=item.id,
                        profile_id=rule.profile_id,
                        status="pending",
                        stage="queued",
                        priority=rule.priority,
                        is_dry_run=False,
                        source_path=item.path,
                        replacement_mode=rule.replacement_mode,
                        source_size_bytes=item.size_bytes,
                        assigned_node_id=rule.assigned_node_id,
                        assigned_node_name=assigned_name,
                    )
                    session.add(job)
                    item.optimization_status = "queued"
                    queued_count += 1

        # Update telemetry on rule record
        rule.last_run_at = datetime.utcnow()
        rule.matched_count = matched_total
        rule.queued_count = queued_count
        rule.completed_count = completed_count
        rule.updated_at = datetime.utcnow()
        await session.commit()

        if queued_count > 0:
            logger.info(f"Automation rule '{rule.name}' queued {queued_count} new optimization jobs.")
            await event_broadcaster.broadcast("queue_updated", {})
            await event_broadcaster.broadcast("automation_updated", {"rule_id": rule.id, "queued": queued_count})

        return {
            "rule_id": rule.id,
            "rule_name": rule.name,
            "queued_jobs": queued_count,
            "matched_items": matched_total,
            "completed_items": completed_count,
            "message": f"Evaluated '{rule.name}': queued {queued_count} items ({completed_count}/{matched_total} already optimized).",
        }

    async def evaluate_all_active_rules(self, session: AsyncSession) -> List[Dict[str, Any]]:
        """Evaluates all enabled automation rules in priority order."""
        stmt = select(AutomationRule.id).where(AutomationRule.is_active == True).order_by(AutomationRule.priority.desc())
        res = await session.execute(stmt)
        rule_ids = res.scalars().all()

        results = []
        for rid in rule_ids:
            res_rule = await self.evaluate_rule(session, rid)
            results.append(res_rule)

        return results

    async def on_media_item_scanned(self, session: AsyncSession, media_item: MediaItem) -> Optional[int]:
        """Automatically checks newly scanned media against active automation rules."""
        if media_item.optimization_status not in ("unoptimized", "failed"):
            return None

        # Check existing active queue job
        stmt_existing = select(EncodingJob).where(
            and_(
                EncodingJob.media_item_id == media_item.id,
                EncodingJob.status.in_(["pending", "running"]),
            )
        )
        if (await session.execute(stmt_existing)).scalar_one_or_none():
            return None

        # Fetch active rules that have auto_encode_new enabled
        stmt_rules = (
            select(AutomationRule)
            .where(
                and_(
                    AutomationRule.is_active == True,
                    AutomationRule.auto_encode_new == True,
                )
            )
            .order_by(AutomationRule.priority.desc())
        )
        rules = (await session.execute(stmt_rules)).scalars().all()

        for rule in rules:
            matched = False
            if rule.scope_type == "all":
                matched = True
            elif rule.scope_type == "library" and rule.target_library:
                matched = (media_item.library.lower() == rule.target_library.lower())
            elif rule.scope_type == "series" and rule.target_series_name:
                matched = (media_item.series_name and media_item.series_name.lower() == rule.target_series_name.lower())

            if matched:
                stmt_prof = select(EncodingProfile).where(EncodingProfile.id == rule.profile_id)
                profile = (await session.execute(stmt_prof)).scalar_one_or_none()
                if profile:
                    target_mb_min = getattr(profile, "target_mb_per_minute", 0.0) or 0.0
                    if target_mb_min > 0 and media_item.duration_seconds and media_item.duration_seconds > 0 and media_item.size_bytes > 0:
                        target_size_bytes = int(target_mb_min * 1024 * 1024 * (media_item.duration_seconds / 60.0))
                        if media_item.size_bytes <= target_size_bytes:
                            logger.info(f"Skipping auto-enqueue for {media_item.filename}: already smaller than rule target size ({media_item.size_bytes / (1024*1024):.1f} MB <= {target_size_bytes / (1024*1024):.1f} MB)")
                            continue

                assigned_name = rule.assigned_node_name
                if not assigned_name and rule.assigned_node_id:
                    if rule.assigned_node_id == "windows-node":
                        assigned_name = "Windows PC (Quadro K620)"
                    elif rule.assigned_node_id == "local":
                        assigned_name = "Ubuntu Server (Local)"

                job = EncodingJob(
                    media_item_id=media_item.id,
                    profile_id=rule.profile_id,
                    status="pending",
                    stage="queued",
                    priority=rule.priority,
                    is_dry_run=False,
                    source_path=media_item.path,
                    replacement_mode=rule.replacement_mode,
                    source_size_bytes=media_item.size_bytes,
                    assigned_node_id=rule.assigned_node_id,
                    assigned_node_name=assigned_name,
                )
                session.add(job)
                media_item.optimization_status = "queued"
                await session.commit()
                await session.refresh(job)

                logger.info(f"Automation rule '{rule.name}' auto-enqueued newly scanned media: {media_item.filename} (Job #{job.id})")
                await event_broadcaster.broadcast("queue_updated", {})
                return job.id

        return None

automation_service = AutomationService()
