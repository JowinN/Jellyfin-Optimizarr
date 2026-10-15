import os
import shutil
import hashlib
import asyncio
from datetime import datetime
from typing import Dict, Any, Optional, Tuple, Set
import psutil
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.rollback import RollbackRecord
from app.models.audit import AuditLog
from app.models.media import MediaItem
from app.config import settings
from app.services.jellyfin_client import jellyfin_client
from app.core.logging import logger

class ReplacementManager:
    """Manages transactional safe file replacement, backups, audit logging, and rollback operations."""

    def __init__(self):
        self._active_file_locks: Set[str] = set()
        self._lock = asyncio.Lock()

    async def acquire_file_lock(self, filepath: str) -> bool:
        normalized = os.path.abspath(filepath)
        async with self._lock:
            if normalized in self._active_file_locks:
                return False
            self._active_file_locks.add(normalized)
            return True

    async def release_file_lock(self, filepath: str):
        normalized = os.path.abspath(filepath)
        async with self._lock:
            self._active_file_locks.discard(normalized)

    def check_disk_space(self, target_dir: str, required_gb: float) -> Tuple[bool, float]:
        """Checks if target_dir has at least required_gb free space."""
        try:
            stat = psutil.disk_usage(target_dir)
            free_gb = stat.free / (1024 ** 3)
            return free_gb >= required_gb, round(free_gb, 2)
        except Exception as e:
            logger.warning(f"Disk check failed for {target_dir}: {e}")
            return True, 999.0

    def compute_sha256(self, filepath: str, max_bytes: int = 10 * 1024 * 1024) -> str:
        """Calculates fast checksum for the first 10MB of the file."""
        hasher = hashlib.sha256()
        try:
            with open(filepath, "rb") as f:
                chunk = f.read(max_bytes)
                hasher.update(chunk)
            return hasher.hexdigest()
        except Exception:
            return ""

    async def execute_replacement(
        self,
        session: AsyncSession,
        media_item: MediaItem,
        temp_encoded_path: str,
        replacement_mode: str,
        pre_encode_mtime: float,
        pre_encode_size: int,
        job_id: int,
    ) -> Tuple[bool, str, Optional[str]]:
        """
        Safely applies the optimized file.
        Returns: (success, message, backup_path_if_created)
        """
        source_path = media_item.path

        # 1. Verify source still exists
        if not os.path.exists(source_path):
            return False, f"Source file no longer exists at {source_path}", None

        # 2. Check if source was modified during encoding
        current_stat = os.stat(source_path)
        if abs(current_stat.st_mtime - pre_encode_mtime) > 1.0 or current_stat.st_size != pre_encode_size:
            return False, "Source file was modified or replaced during encoding. Aborting replacement for safety.", None

        # 3. Check disk space on destination filesystem
        source_dir = os.path.dirname(source_path)
        dest_ok, dest_free = self.check_disk_space(source_dir, 2.0)
        if not dest_ok:
            return False, f"Insufficient disk space in destination directory ({dest_free} GB free).", None

        optimized_size = os.path.getsize(temp_encoded_path)

        # 4. ZERO-BLOAT SAFETY GUARDRAIL: Strict enforcement that optimized file must be smaller than source
        if pre_encode_size > 0 and optimized_size >= pre_encode_size:
            opt_mb = optimized_size / (1024 * 1024)
            pre_mb = pre_encode_size / (1024 * 1024)
            logger.critical(
                f"ZERO-BLOAT GUARDRAIL: Encoded file ({opt_mb:.1f} MB) is larger or equal to original source ({pre_mb:.1f} MB). "
                f"Refusing to replace source media {source_path}."
            )
            return (
                False,
                f"Zero-Bloat Protection: Encoded output ({opt_mb:.1f} MB) >= original ({pre_mb:.1f} MB). Replacement aborted to protect storage.",
                None,
            )

        # 5. Replacement Mode: OPTIMIZED COPY
        if replacement_mode == "optimized_copy":
            root, ext = os.path.splitext(source_path)
            copy_path = f"{root}.optimized{ext}"
            shutil.copy2(temp_encoded_path, copy_path)
            logger.info(f"Created optimized copy alongside source: {copy_path}")

            # Audit log
            audit = AuditLog(
                event_type="create_optimized_copy",
                target_path=copy_path,
                details={"original_size": pre_encode_size, "optimized_size": optimized_size},
            )
            session.add(audit)
            await session.commit()
            return True, "Optimized copy created successfully.", None

        # 5. Replacement Mode: MANUAL APPROVAL
        elif replacement_mode == "manual_approval":
            logger.info(f"Job {job_id} awaiting manual approval before replacing {source_path}")
            return True, "Encoding complete. Awaiting manual confirmation.", None

        # 6. Replacement Mode: REPLACE WITH BACKUP (Default & Safest)
        else:
            # Prepare backup directory path structure
            timestamp_str = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
            rel_path = os.path.basename(source_path)
            backup_folder = os.path.join(settings.BACKUP_DIR, media_item.library)
            os.makedirs(backup_folder, exist_ok=True)
            backup_path = os.path.join(backup_folder, f"{rel_path}.{timestamp_str}.bak")

            try:
                # Move original to backup
                shutil.move(source_path, backup_path)
                logger.info(f"Moved original media file to backup: {backup_path}")

                # Move/Install optimized file into place
                # Note: If across filesystem mount, shutil.move handles copy + remove
                shutil.move(temp_encoded_path, source_path)
                logger.info(f"Installed optimized file to: {source_path}")

                # Set appropriate permissions matching PUID/PGID
                try:
                    os.chown(source_path, settings.PUID, settings.PGID)
                except (AttributeError, PermissionError, OSError):
                    pass

                # Create Rollback Record
                rollback_record = RollbackRecord(
                    job_id=job_id,
                    media_item_id=media_item.id,
                    original_path=source_path,
                    backup_path=backup_path,
                    optimized_path=source_path,
                    original_size_bytes=pre_encode_size,
                    optimized_size_bytes=optimized_size,
                    original_checksum=media_item.fingerprint_sha256,
                    status="available",
                )
                session.add(rollback_record)

                # Create Audit Log
                audit = AuditLog(
                    event_type="replace_media_with_backup",
                    target_path=source_path,
                    details={
                        "backup_path": backup_path,
                        "saved_bytes": pre_encode_size - optimized_size,
                    },
                )
                session.add(audit)
                await session.commit()

                # Trigger Jellyfin item refresh
                if media_item.jellyfin_item_id:
                    asyncio.create_task(jellyfin_client.refresh_item(media_item.jellyfin_item_id))

                return True, "Replaced successfully with recoverable backup preserved.", backup_path

            except Exception as e:
                logger.error(f"Error during file replacement: {e}")
                # Attempt recovery: if original was moved to backup but optimized failed to move, restore original!
                if os.path.exists(backup_path) and not os.path.exists(source_path):
                    shutil.move(backup_path, source_path)
                    logger.warning("Restored original from backup after replacement failure.")
                return False, f"Replacement error: {str(e)}", None

    async def rollback(self, session: AsyncSession, record_id: int) -> Tuple[bool, str]:
        """Restores the original file from a rollback backup."""
        stmt = select(RollbackRecord).where(RollbackRecord.id == record_id)
        res = await session.execute(stmt)
        record = res.scalar_one_or_none()

        if not record:
            return False, "Rollback record not found."

        if record.status != "available":
            return False, f"Cannot restore: record is marked '{record.status}'."

        if not os.path.exists(record.backup_path):
            return False, f"Backup file missing from disk: {record.backup_path}"

        target_path = record.original_path
        locked = await self.acquire_file_lock(target_path)
        if not locked:
            return False, "File is currently locked by an active operation."

        try:
            # Move backup file back to original location
            shutil.move(record.backup_path, target_path)
            record.status = "restored"
            record.restored_at = datetime.utcnow()

            # Update MediaItem state
            stmt_item = select(MediaItem).where(MediaItem.id == record.media_item_id)
            res_item = await session.execute(stmt_item)
            item = res_item.scalar_one_or_none()
            if item:
                item.size_bytes = record.original_size_bytes
                item.optimization_status = "unoptimized"
                if item.jellyfin_item_id:
                    asyncio.create_task(jellyfin_client.refresh_item(item.jellyfin_item_id))

            # Audit
            audit = AuditLog(
                event_type="rollback_restored",
                target_path=target_path,
                details={"backup_path": record.backup_path},
            )
            session.add(audit)
            await session.commit()

            logger.info(f"Successfully rolled back file: {target_path} from {record.backup_path}")
            return True, "Original file successfully restored from backup."
        except Exception as e:
            logger.error(f"Error executing rollback: {e}")
            return False, f"Rollback failed: {str(e)}"
        finally:
            await self.release_file_lock(target_path)

replacement_manager = ReplacementManager()
