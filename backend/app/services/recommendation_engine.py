from typing import List, Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from app.models.media import MediaItem
from app.models.profile import EncodingProfile
from app.services.ffmpeg_builder import ffmpeg_command_builder
from app.services.profile_manager import profile_manager
from app.core.logging import logger

class RecommendationEngine:
    """Evaluates media library items and recommends high-yield optimization candidates."""

    async def analyze_candidates(
        self,
        session: AsyncSession,
        library: Optional[str] = None,
        min_mb_per_minute: Optional[float] = None,
        limit: int = 50,
    ) -> List[Dict[str, Any]]:
        query = select(MediaItem).where(
            and_(
                MediaItem.optimization_status.in_(["unoptimized", "failed"]),
                MediaItem.duration_seconds > 60.0,
            )
        )

        if library:
            query = query.where(MediaItem.library == library)

        query = query.order_by(MediaItem.mb_per_minute.desc())
        res = await session.execute(query)
        items = res.scalars().all()

        default_profile = await profile_manager.get_default_profile(session)
        candidates = []

        for item in items:
            rec = self.evaluate_item(item, default_profile, min_mb_per_minute)
            if rec["is_recommended"]:
                candidates.append(rec)
                if len(candidates) >= limit:
                    break

        return candidates

    def evaluate_item(
        self,
        item: MediaItem,
        profile: EncodingProfile,
        min_mb_per_min_override: Optional[float] = None,
    ) -> Dict[str, Any]:
        mb_min = item.mb_per_minute
        codec = item.video_codec.lower()
        res = item.resolution

        # Check if already efficiently encoded
        is_already_efficient = False
        if codec in ("hevc", "h265", "av1"):
            if res in ("1080p", "720p") and mb_min <= 22.0:
                is_already_efficient = True
            elif res == "4K" and mb_min <= 55.0:
                is_already_efficient = True

        # Savings Projection
        # 1. Target MB per minute exact projection
        target_mb_min = getattr(profile, "target_mb_per_minute", 0.0) or 0.0
        scale_down = getattr(profile, "scale_down_percent", 0) or 0

        if target_mb_min > 0 and item.duration_seconds and item.duration_seconds > 0 and item.size_bytes > 0:
            target_output_bytes = int((target_mb_min * 1024 * 1024 * (item.duration_seconds / 60.0)))
            if target_output_bytes < item.size_bytes:
                estimated_saved_bytes = item.size_bytes - target_output_bytes
                projected_saving_ratio = estimated_saved_bytes / item.size_bytes
                estimated_output_bytes = target_output_bytes
            else:
                estimated_saved_bytes = 0
                projected_saving_ratio = 0.0
                estimated_output_bytes = item.size_bytes
        elif scale_down > 0:
            projected_saving_ratio = min(0.95, max(0.05, scale_down / 100.0))
            estimated_saved_bytes = int(item.size_bytes * projected_saving_ratio)
            estimated_output_bytes = item.size_bytes - estimated_saved_bytes
        elif codec in ("mpeg2video", "vc1", "msmpeg4v3"):
            projected_saving_ratio = 0.65
            estimated_saved_bytes = int(item.size_bytes * projected_saving_ratio)
            estimated_output_bytes = item.size_bytes - estimated_saved_bytes
        elif codec in ("h264", "avc"):
            projected_saving_ratio = 0.48
            estimated_saved_bytes = int(item.size_bytes * projected_saving_ratio)
            estimated_output_bytes = item.size_bytes - estimated_saved_bytes
        elif codec in ("hevc", "h265") and not is_already_efficient:
            projected_saving_ratio = 0.30
            estimated_saved_bytes = int(item.size_bytes * projected_saving_ratio)
            estimated_output_bytes = item.size_bytes - estimated_saved_bytes
        elif codec in ("av1", "youtube") and not is_already_efficient:
            projected_saving_ratio = 0.20
            estimated_saved_bytes = int(item.size_bytes * projected_saving_ratio)
            estimated_output_bytes = item.size_bytes - estimated_saved_bytes
        else:
            projected_saving_ratio = 0.25
            estimated_saved_bytes = int(item.size_bytes * projected_saving_ratio)
            estimated_output_bytes = item.size_bytes - estimated_saved_bytes

        # Recommendation threshold
        min_thresh = min_mb_per_min_override or self._get_default_threshold(item.library, res)
        is_recommended = (mb_min >= min_thresh) and (not is_already_efficient) and (estimated_saved_bytes > 100 * 1024 * 1024)

        reasons = []
        if codec in ("mpeg2video", "vc1"):
            reasons.append(f"Legacy codec ({codec}) consumes disproportionate storage.")
        if mb_min > min_thresh:
            reasons.append(f"High storage density: {mb_min:.1f} MB/min (Threshold: {min_thresh:.1f} MB/min).")
        if item.audio_tracks_count > 4:
            reasons.append(f"Contains {item.audio_tracks_count} audio tracks which will all be safely preserved.")
        if target_mb_min > 0:
            reasons.append(f"Target size limit: {target_mb_min:.1f} MB/min (Estimated size: {estimated_output_bytes / (1024*1024):.0f} MB).")
        elif scale_down > 0:
            reasons.append(f"Target size scaling: {scale_down}% scale down (~{round(100 - scale_down)}% output size).")

        return {
            "media_item_id": item.id,
            "filename": item.filename,
            "library": item.library,
            "resolution": item.resolution,
            "video_codec": item.video_codec,
            "current_size_bytes": item.size_bytes,
            "duration_seconds": item.duration_seconds,
            "mb_per_minute": mb_min,
            "is_recommended": is_recommended,
            "is_already_efficient": is_already_efficient,
            "estimated_output_bytes": estimated_output_bytes,
            "estimated_saved_bytes": estimated_saved_bytes,
            "estimated_savings_percent": round(projected_saving_ratio * 100, 1),
            "reasons": reasons,
        }

    def _get_default_threshold(self, library: str, resolution: str) -> float:
        if library == "anime":
            return 18.0 if resolution == "1080p" else 40.0
        elif library == "tv":
            return 26.0 if resolution == "1080p" else 60.0
        else:  # movies
            return 38.0 if resolution == "1080p" else 80.0

    async def generate_dry_run_plan(
        self,
        session: AsyncSession,
        media_item_id: int,
        profile_id: int,
    ) -> Optional[Dict[str, Any]]:
        stmt = select(MediaItem).where(MediaItem.id == media_item_id)
        res = await session.execute(stmt)
        item = res.scalar_one_or_none()
        if not item:
            return None

        profile = await profile_manager.get_profile_by_id(session, profile_id)
        if not profile:
            profile = await profile_manager.get_default_profile(session)

        evaluation = self.evaluate_item(item, profile)

        # Build proposed FFmpeg command args for inspection
        mock_output = f"/work/preview_{item.id}.mkv"
        proposed_cmd = ffmpeg_command_builder.build_command(
            input_path=item.path,
            output_path=mock_output,
            profile=profile,
            media_info={
                "width": item.width,
                "height": item.height,
                "is_hdr": item.is_hdr,
                "bit_depth": item.bit_depth,
                "streams_detail": item.streams_detail or {},
                "size_bytes": item.size_bytes,
                "duration_seconds": item.duration_seconds,
            },
        )

        risks = []
        if item.is_hdr and not profile.preserve_hdr:
            risks.append("HDR color profile will be converted to standard dynamic range (SDR).")
        if item.audio_tracks_count > 1 and profile.audio_policy == "transcode_all":
            risks.append(f"All {item.audio_tracks_count} audio streams will be transcoded to {profile.preferred_audio_codec}.")

        return {
            "media_item_id": item.id,
            "source_path": item.path,
            "source_size_bytes": item.size_bytes,
            "estimated_output_size_bytes": evaluation["estimated_output_bytes"],
            "estimated_savings_bytes": evaluation["estimated_saved_bytes"],
            "estimated_savings_percent": evaluation["estimated_savings_percent"],
            "selected_profile_name": profile.name,
            "hardware_accel": profile.hwaccel_type,
            "proposed_ffmpeg_args": proposed_cmd,
            "required_work_space_bytes": int(item.size_bytes * 1.5),
            "potential_risks": risks,
        }

recommendation_engine = RecommendationEngine()
