import os
import re
import asyncio
from datetime import datetime
from typing import Dict, Any, List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from app.models.media import MediaItem
from app.config import settings
from app.services.inspector import media_inspector
from app.services.jellyfin_client import jellyfin_client
from app.core.logging import logger
from app.core.events import event_broadcaster
from app.services.automation_service import automation_service

SUPPORTED_EXTENSIONS = {".mkv", ".mp4", ".m4v", ".avi", ".ts", ".webm", ".mov", ".wmv"}

class LibraryScanner:
    """Recursively scans media directories, parses titles/episodes, probes streams, and syncs with Jellyfin."""

    def __init__(self):
        self.is_scanning = False
        self._should_cancel = False
        self.current_library: Optional[str] = None
        self.current_file: Optional[str] = None
        self.scanned_count = 0
        self.total_found = 0
        self.errors_count = 0

    def cancel(self):
        self._should_cancel = True

    async def scan_all(self, session: AsyncSession, force_rescan: bool = False, libraries: Optional[List[str]] = None):
        if self.is_scanning:
            logger.warning("Scan already in progress.")
            return

        self.is_scanning = True
        self._should_cancel = False
        self.scanned_count = 0
        self.pruned_count = 0
        self.errors_count = 0

        target_libs = libraries or ["movies", "tv", "anime"]
        lib_dirs = {
            "movies": settings.MOVIES_DIR,
            "tv": settings.TV_DIR,
            "anime": settings.ANIME_DIR,
        }

        try:
            logger.info(f"Starting library scan for: {', '.join(target_libs)}")
            for lib_name in target_libs:
                if self._should_cancel:
                    logger.info("Scan cancelled by user.")
                    break

                root_dir = lib_dirs.get(lib_name)
                if not root_dir or not os.path.exists(root_dir):
                    logger.warning(f"Directory for {lib_name} does not exist at {root_dir}")
                    continue

                self.current_library = lib_name
                await self._scan_directory(session, lib_name, root_dir, force_rescan)
                pruned = await self.prune_missing_files(session, lib_name)
                self.pruned_count += pruned

            logger.info(f"Scan complete. Scanned: {self.scanned_count}, Pruned: {self.pruned_count}, Errors: {self.errors_count}")
            try:
                await automation_service.evaluate_all_active_rules(session)
            except Exception as e:
                logger.error(f"Error evaluating automation rules after scan: {e}")

        finally:
            self.is_scanning = False
            self.current_library = None
            self.current_file = None
            await event_broadcaster.broadcast("scan_finished", {
                "scanned_count": self.scanned_count,
                "pruned_count": self.pruned_count,
                "errors_count": self.errors_count,
            })

    async def prune_missing_files(self, session: AsyncSession, library_name: Optional[str] = None) -> int:
        """Removes database records for media items whose files no longer exist on disk."""
        query = select(MediaItem)
        if library_name:
            query = query.where(MediaItem.library == library_name)
        
        res = await session.execute(query)
        items = res.scalars().all()
        pruned = 0

        for item in items:
            if not os.path.exists(item.path):
                logger.info(f"Pruning missing media item: {item.filename} (Path: {item.path})")
                await session.delete(item)
                pruned += 1

        if pruned > 0:
            await session.commit()
            logger.info(f"Pruned {pruned} missing media items from database for library '{library_name or 'all'}'.")

        return pruned

    async def _scan_directory(self, session: AsyncSession, library_name: str, root_dir: str, force_rescan: bool):
        for dirpath, _, filenames in os.walk(root_dir):
            if self._should_cancel:
                break

            for fname in filenames:
                if self._should_cancel:
                    break

                _, ext = os.path.splitext(fname)
                if ext.lower() not in SUPPORTED_EXTENSIONS:
                    continue

                full_path = os.path.join(dirpath, fname)
                self.current_file = fname

                try:
                    await self._process_media_file(session, library_name, full_path, force_rescan)
                    self.scanned_count += 1

                    if self.scanned_count % 10 == 0:
                        await event_broadcaster.broadcast("scan_progress", {
                            "library": library_name,
                            "current_file": fname,
                            "scanned_count": self.scanned_count,
                        })

                except Exception as e:
                    self.errors_count += 1
                    logger.error(f"Error scanning {full_path}: {e}")

                # Yield control to event loop
                await asyncio.sleep(0.01)

    async def _process_media_file(self, session: AsyncSession, library_name: str, full_path: str, force_rescan: bool):
        stat = os.stat(full_path)
        size_bytes = stat.st_size
        mtime = stat.st_mtime

        # Check existing database record
        stmt = select(MediaItem).where(MediaItem.path == full_path)
        res = await session.execute(stmt)
        item = res.scalar_one_or_none()

        # Incremental check: if mtime and size match, skip probing!
        if item and not force_rescan:
            if abs(item.mtime - mtime) < 1.0 and item.size_bytes == size_bytes:
                return

        # Probe file with FFprobe
        probe_info = await media_inspector.probe(full_path)
        if not probe_info:
            logger.warning(f"Could not probe {full_path}. File might be corrupt or incomplete.")
            return

        # Parse naming metadata
        parsed = self._parse_media_naming(library_name, full_path)

        if not item:
            item = MediaItem(
                path=full_path,
                filename=os.path.basename(full_path),
                library=library_name,
                media_type=parsed["media_type"],
                title=parsed["title"],
                series_name=parsed["series_name"],
                season_number=parsed["season"],
                episode_number=parsed["episode"],
                size_bytes=size_bytes,
                mtime=mtime,
                duration_seconds=probe_info["duration_seconds"],
                container_format=probe_info["container_format"],
                video_codec=probe_info["video_codec"],
                resolution=probe_info["resolution"],
                width=probe_info["width"],
                height=probe_info["height"],
                fps=probe_info["fps"],
                bitrate_kbps=probe_info["bitrate_kbps"],
                bit_depth=probe_info["bit_depth"],
                pixel_format=probe_info["pixel_format"],
                is_hdr=probe_info["is_hdr"],
                hdr_format=probe_info["hdr_format"],
                audio_tracks_count=probe_info["audio_tracks_count"],
                audio_codecs=probe_info["audio_codecs"],
                audio_languages=probe_info["audio_languages"],
                subtitle_tracks_count=probe_info["subtitle_tracks_count"],
                subtitle_languages=probe_info["subtitle_languages"],
                mb_per_minute=probe_info["mb_per_minute"],
                efficiency_score=probe_info["efficiency_score"],
                streams_detail=probe_info["streams_detail"],
                optimization_status="unoptimized",
                last_scanned_at=datetime.utcnow(),
            )
            session.add(item)
        else:
            # Update existing record
            item.size_bytes = size_bytes
            item.mtime = mtime
            item.duration_seconds = probe_info["duration_seconds"]
            item.container_format = probe_info["container_format"]
            item.video_codec = probe_info["video_codec"]
            item.resolution = probe_info["resolution"]
            item.width = probe_info["width"]
            item.height = probe_info["height"]
            item.fps = probe_info["fps"]
            item.bitrate_kbps = probe_info["bitrate_kbps"]
            item.bit_depth = probe_info["bit_depth"]
            item.pixel_format = probe_info["pixel_format"]
            item.is_hdr = probe_info["is_hdr"]
            item.hdr_format = probe_info["hdr_format"]
            item.audio_tracks_count = probe_info["audio_tracks_count"]
            item.audio_codecs = probe_info["audio_codecs"]
            item.audio_languages = probe_info["audio_languages"]
            item.subtitle_tracks_count = probe_info["subtitle_tracks_count"]
            item.subtitle_languages = probe_info["subtitle_languages"]
            item.mb_per_minute = probe_info["mb_per_minute"]
            item.efficiency_score = probe_info["efficiency_score"]
            item.streams_detail = probe_info["streams_detail"]
            item.last_scanned_at = datetime.utcnow()

        await session.commit()

        # Check newly scanned or updated media against active automation rules
        try:
            await automation_service.on_media_item_scanned(session, item)
        except Exception as e:
            logger.error(f"Error checking automation rules for scanned item {item.filename}: {e}")

    def _parse_media_naming(self, library: str, filepath: str) -> Dict[str, Any]:
        fname = os.path.basename(filepath)
        name_no_ext, _ = os.path.splitext(fname)

        if library in ("tv", "anime"):
            # Match standard patterns like S01E05 or 1x05
            match = re.search(r"[Ss](\d{1,2})[Ee](\d{1,3})", name_no_ext)
            if match:
                season = int(match.group(1))
                episode = int(match.group(2))
                parent_dir = os.path.basename(os.path.dirname(os.path.dirname(filepath)))
                series_name = parent_dir if parent_dir not in ("tv", "anime", "") else name_no_ext[:match.start()].strip(" -._")
                return {
                    "media_type": "episode",
                    "title": name_no_ext,
                    "series_name": series_name,
                    "season": season,
                    "episode": episode,
                }
            # Fallback for anime: episode number pattern E01 or - 01
            anime_match = re.search(r"[-_\s](\d{1,3})[-_\s]", name_no_ext)
            if anime_match:
                episode = int(anime_match.group(1))
                series_name = os.path.basename(os.path.dirname(filepath))
                return {
                    "media_type": "episode",
                    "title": name_no_ext,
                    "series_name": series_name,
                    "season": 1,
                    "episode": episode,
                }

        # Default movie
        return {
            "media_type": "movie",
            "title": name_no_ext,
            "series_name": None,
            "season": None,
            "episode": None,
        }

library_scanner = LibraryScanner()
