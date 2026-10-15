from typing import List, Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.profile import EncodingProfile
from app.core.logging import logger

DEFAULT_PRESETS: List[Dict[str, Any]] = [
    {
        "name": "Maximum Quality",
        "description": "Very conservative compression with imperceptible quality loss. 10-bit HEVC, preserves all audio and subtitles.",
        "is_preset": True,
        "video_codec": "hevc",
        "rate_control_mode": "crf",
        "crf": 18.0,
        "encoder_preset": "slow",
        "pixel_format": "yuv420p10le",
        "resolution_mode": "original",
        "audio_policy": "copy_all",
        "preferred_audio_codec": "copy",
        "subtitle_policy": "copy_all",
        "preserve_hdr": True,
        "hwaccel_type": "auto",
        "min_storage_saving_percent": 5.0,
    },
    {
        "name": "High Quality",
        "description": "High visual fidelity with meaningful compression. Excellent for movies and premium series.",
        "is_preset": True,
        "video_codec": "hevc",
        "rate_control_mode": "crf",
        "crf": 20.0,
        "encoder_preset": "medium",
        "pixel_format": "yuv420p10le",
        "resolution_mode": "original",
        "audio_policy": "copy_all",
        "preferred_audio_codec": "copy",
        "subtitle_policy": "copy_all",
        "preserve_hdr": True,
        "hwaccel_type": "auto",
        "min_storage_saving_percent": 15.0,
    },
    {
        "name": "Balanced",
        "description": "Practical compromise between visual quality, file size, and encoding speed. Recommended default.",
        "is_preset": True,
        "video_codec": "hevc",
        "rate_control_mode": "crf",
        "crf": 22.0,
        "encoder_preset": "medium",
        "pixel_format": "yuv420p10le",
        "resolution_mode": "original",
        "audio_policy": "copy_all",
        "preferred_audio_codec": "copy",
        "subtitle_policy": "copy_all",
        "preserve_hdr": True,
        "hwaccel_type": "auto",
        "min_storage_saving_percent": 25.0,
    },
    {
        "name": "GPU Hardware Accelerated (H.264 / Ultra Speed)",
        "description": "Blazing fast encoding utilizing NVIDIA NVENC or Intel QSV at 60-80+ fps with universal playback compatibility.",
        "is_preset": True,
        "video_codec": "h264",
        "rate_control_mode": "crf",
        "crf": 22.0,
        "target_bitrate_kbps": 4500,
        "encoder_preset": "faster",
        "pixel_format": "yuv420p",
        "resolution_mode": "original",
        "audio_policy": "copy_all",
        "preferred_audio_codec": "copy",
        "subtitle_policy": "copy_all",
        "preserve_hdr": False,
        "hwaccel_type": "auto",
        "min_storage_saving_percent": 20.0,
    },
    {
        "name": "Storage Saver",
        "description": "Stronger compression for secondary content with an explicit visual quality trade-off.",
        "is_preset": True,
        "video_codec": "hevc",
        "rate_control_mode": "crf",
        "crf": 25.0,
        "encoder_preset": "medium",
        "pixel_format": "yuv420p10le",
        "resolution_mode": "original",
        "audio_policy": "keep_surround_add_aac",
        "preferred_audio_codec": "aac",
        "audio_bitrate_kbps": 192,
        "subtitle_policy": "copy_all",
        "preserve_hdr": True,
        "hwaccel_type": "auto",
        "min_storage_saving_percent": 40.0,
    },
    {
        "name": "Small File",
        "description": "Aggressively reduces file size for archival or constrained disks. Visible compression artifacts may occur.",
        "is_preset": True,
        "video_codec": "hevc",
        "rate_control_mode": "crf",
        "crf": 28.0,
        "encoder_preset": "faster",
        "pixel_format": "yuv420p",
        "resolution_mode": "1080p",
        "audio_policy": "transcode_all",
        "preferred_audio_codec": "aac",
        "audio_bitrate_kbps": 160,
        "subtitle_policy": "copy_all",
        "preserve_hdr": False,
        "hdr_to_sdr_tonemap": True,
        "hwaccel_type": "auto",
        "min_storage_saving_percent": 55.0,
    },
    {
        "name": "Anime Optimized",
        "description": "Tuned specifically for animation: 10-bit color, protects line art and flat gradients, preserves all dub tracks and styled subtitles.",
        "is_preset": True,
        "video_codec": "hevc",
        "rate_control_mode": "crf",
        "crf": 20.0,
        "encoder_preset": "slow",
        "pixel_format": "yuv420p10le",
        "resolution_mode": "original",
        "audio_policy": "copy_all",
        "preferred_audio_codec": "copy",
        "subtitle_policy": "copy_all",
        "preserve_hdr": True,
        "hwaccel_type": "auto",
        "min_storage_saving_percent": 20.0,
        "custom_ffmpeg_flags": {"tune": "animation"},
    },
    {
        "name": "TV Episode Optimized",
        "description": "Balanced bitrate and quality targets for television seasons. Typical target 20-30 MB/min for 1080p.",
        "is_preset": True,
        "video_codec": "hevc",
        "rate_control_mode": "crf",
        "crf": 22.5,
        "encoder_preset": "medium",
        "pixel_format": "yuv420p10le",
        "resolution_mode": "original",
        "target_mb_per_minute": 25.0,
        "audio_policy": "copy_all",
        "preferred_audio_codec": "copy",
        "subtitle_policy": "copy_all",
        "preserve_hdr": True,
        "hwaccel_type": "auto",
        "min_storage_saving_percent": 25.0,
    },
    {
        "name": "Movie Optimized",
        "description": "Cinematic quality retention preserving surround sound, HDR metadata, grain characteristics, and chapter markers.",
        "is_preset": True,
        "video_codec": "hevc",
        "rate_control_mode": "crf",
        "crf": 19.5,
        "encoder_preset": "medium",
        "pixel_format": "yuv420p10le",
        "resolution_mode": "original",
        "audio_policy": "copy_all",
        "preferred_audio_codec": "copy",
        "subtitle_policy": "copy_all",
        "preserve_hdr": True,
        "hwaccel_type": "auto",
        "min_storage_saving_percent": 15.0,
    },
    {
        "name": "Archive / Original Quality",
        "description": "Stream-copy container remuxing only. Cleans containers without lossy video recompression.",
        "is_preset": True,
        "video_codec": "copy",
        "rate_control_mode": "crf",
        "crf": 0.0,
        "encoder_preset": "medium",
        "pixel_format": "auto",
        "resolution_mode": "original",
        "audio_policy": "copy_all",
        "preferred_audio_codec": "copy",
        "subtitle_policy": "copy_all",
        "preserve_hdr": True,
        "hwaccel_type": "cpu_only",
        "min_storage_saving_percent": 0.0,
    },
    {
        "name": "YouTube Space Saver (AV1 + Opus)",
        "description": "YouTube's high-efficiency streaming standard (GPU-accelerated / AV1 + Opus audio) scaled down to 50% (half size) of original file.",
        "is_preset": True,
        "video_codec": "youtube",
        "scale_down_percent": 50,
        "rate_control_mode": "target_bitrate",
        "crf": 26.0,
        "encoder_preset": "6",
        "pixel_format": "yuv420p10le",
        "resolution_mode": "original",
        "audio_policy": "transcode_all",
        "preferred_audio_codec": "opus",
        "audio_bitrate_kbps": 128,
        "subtitle_policy": "copy_all",
        "preserve_hdr": True,
        "hwaccel_type": "auto",
        "min_storage_saving_percent": 50.0,
    },
    {
        "name": "Smart Target Size (8.5 MB/min • 720p AV1 + Opus)",
        "description": "Strict target size: 8.5 MB/min (~1 GB for 2-hour movie, ~204 MB for 24-min episode). Auto-downscales 4K/1080p to 720p with dynamic AV1 video and Opus audio.",
        "is_preset": True,
        "video_codec": "av1",
        "rate_control_mode": "target_bitrate",
        "target_mb_per_minute": 8.5,
        "encoder_preset": "6",
        "pixel_format": "yuv420p10le",
        "resolution_mode": "720p",
        "audio_policy": "transcode_all",
        "preferred_audio_codec": "opus",
        "audio_bitrate_kbps": 96,
        "subtitle_policy": "copy_all",
        "preserve_hdr": False,
        "hdr_to_sdr_tonemap": True,
        "hwaccel_type": "auto",
        "min_storage_saving_percent": 20.0,
        "scale_down_percent": 0,
    },
    {
        "name": "GPU Target Size (8.5 MB/min • 720p H.264 NVENC + Opus)",
        "description": "Blazing fast GPU hardware target: 8.5 MB/min (~1 GB for 2-hour movie, ~204 MB for 24-min episode). Encodes at 80-100+ fps on NVIDIA GPU (NVENC), downscales to 720p with Opus audio.",
        "is_preset": True,
        "video_codec": "h264",
        "rate_control_mode": "target_bitrate",
        "target_mb_per_minute": 8.5,
        "encoder_preset": "p4",
        "pixel_format": "yuv420p",
        "resolution_mode": "720p",
        "audio_policy": "transcode_all",
        "preferred_audio_codec": "opus",
        "audio_bitrate_kbps": 96,
        "subtitle_policy": "copy_all",
        "preserve_hdr": False,
        "hdr_to_sdr_tonemap": True,
        "hwaccel_type": "cuda",
        "min_storage_saving_percent": 20.0,
        "scale_down_percent": 0,
        "preferred_node_id": "windows-node",
    },
    {
        "name": "Custom",
        "description": "Fully adjustable profile template for advanced user configuration.",
        "is_preset": True,
        "video_codec": "hevc",
        "rate_control_mode": "crf",
        "crf": 21.0,
        "encoder_preset": "medium",
        "pixel_format": "yuv420p10le",
        "resolution_mode": "original",
        "audio_policy": "copy_all",
        "preferred_audio_codec": "copy",
        "subtitle_policy": "copy_all",
        "preserve_hdr": True,
        "hwaccel_type": "auto",
        "min_storage_saving_percent": 10.0,
        "scale_down_percent": 0,
    },
]

class ProfileManager:
    """Manages built-in presets and customized encoding profiles."""

    async def seed_presets(self, session: AsyncSession):
        """Ensures all standard built-in presets exist in the database on initial setup without re-creating deleted ones."""
        from app.models.settings import AppSetting
        stmt_setting = select(AppSetting).where(AppSetting.key == "presets_seeded")
        res_setting = await session.execute(stmt_setting)
        seeded = res_setting.scalar_one_or_none()
        if seeded and seeded.value == "true":
            # Check if newly added presets are seeded
            for target_name in ["YouTube Space Saver (AV1 + Opus)", "Smart Target Size (8.5 MB/min • 720p AV1 + Opus)"]:
                stmt_check = select(EncodingProfile).where(EncodingProfile.name == target_name)
                res_check = await session.execute(stmt_check)
                if not res_check.scalar_one_or_none():
                    preset_data = next((p for p in DEFAULT_PRESETS if p["name"] == target_name), None)
                    if preset_data:
                        session.add(EncodingProfile(**preset_data))
                        await session.commit()
            return

        for preset in DEFAULT_PRESETS:
            stmt = select(EncodingProfile).where(EncodingProfile.name == preset["name"])
            res = await session.execute(stmt)
            existing = res.scalar_one_or_none()
            if not existing:
                profile = EncodingProfile(**preset)
                session.add(profile)

        session.add(AppSetting(key="presets_seeded", value="true", description="Initial presets seeded flag"))
        await session.commit()
        logger.info("Encoding presets verified in database.")

    async def restore_default_presets(self, session: AsyncSession):
        """Re-creates any default presets that were deleted."""
        for preset in DEFAULT_PRESETS:
            stmt = select(EncodingProfile).where(EncodingProfile.name == preset["name"])
            res = await session.execute(stmt)
            existing = res.scalar_one_or_none()
            if not existing:
                profile = EncodingProfile(**preset)
                session.add(profile)
        await session.commit()
        logger.info("Default presets restored in database.")

    async def get_profile_by_id(self, session: AsyncSession, profile_id: int) -> Optional[EncodingProfile]:
        stmt = select(EncodingProfile).where(EncodingProfile.id == profile_id)
        res = await session.execute(stmt)
        return res.scalar_one_or_none()

    async def get_default_profile(self, session: AsyncSession) -> Optional[EncodingProfile]:
        stmt = select(EncodingProfile).where(EncodingProfile.name == "Balanced")
        res = await session.execute(stmt)
        profile = res.scalar_one_or_none()
        if not profile:
            stmt_any = select(EncodingProfile).limit(1)
            res_any = await session.execute(stmt_any)
            profile = res_any.scalar_one_or_none()
        return profile

profile_manager = ProfileManager()
