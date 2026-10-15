import os
import asyncio
from typing import Dict, Any, List
from app.config import settings
from app.core.logging import logger

class HardwareDetector:
    """Detects and tests hardware-accelerated video encoders inside the container."""

    def __init__(self):
        self._cached_results: Optional[Dict[str, Any]] = None

    async def detect_capabilities(self, force_refresh: bool = False) -> Dict[str, Any]:
        if self._cached_results and not force_refresh:
            return self._cached_results

        dri_path = settings.DRI_DEVICE
        dri_present = os.path.exists(dri_path)
        dri_permissions = ""

        if dri_present:
            can_read = os.access(dri_path, os.R_OK)
            can_write = os.access(dri_path, os.W_OK)
            dri_permissions = f"Read: {'yes' if can_read else 'no'}, Write: {'yes' if can_write else 'no'}"
        else:
            dri_permissions = "Device file not found"

        available_video_encoders = await self._get_available_encoders("video")
        available_audio_encoders = await self._get_available_encoders("audio")

        vaapi_supported = ("hevc_vaapi" in available_video_encoders or "h264_vaapi" in available_video_encoders) and dri_present
        qsv_supported = ("hevc_qsv" in available_video_encoders or "h264_qsv" in available_video_encoders) and dri_present
        nvenc_supported = "hevc_nvenc" in available_video_encoders or "h264_nvenc" in available_video_encoders

        recommended = "libx265"
        if nvenc_supported:
            recommended = "hevc_nvenc" if "hevc_nvenc" in available_video_encoders else "h264_nvenc"
        elif vaapi_supported and dri_present:
            recommended = "hevc_vaapi" if "hevc_vaapi" in available_video_encoders else "h264_vaapi"
        elif qsv_supported and dri_present:
            recommended = "hevc_qsv" if "hevc_qsv" in available_video_encoders else "h264_qsv"

        notes = []
        if dri_present:
            notes.append(f"Direct Rendering Infrastructure detected at {dri_path}")
        else:
            notes.append(f"No DRI device found at {dri_path}. Running with high-performance CPU software encoding.")

        if "libx265" in available_video_encoders:
            notes.append("High-efficiency CPU encoder (libx265) is ready.")

        ffmpeg_version = await self._get_ffmpeg_version()

        result = {
            "dri_device_present": dri_present,
            "dri_device_path": dri_path,
            "dri_device_permissions": dri_permissions,
            "vaapi_supported": vaapi_supported,
            "qsv_supported": qsv_supported,
            "nvenc_supported": nvenc_supported,
            "available_video_encoders": available_video_encoders,
            "available_audio_encoders": available_audio_encoders,
            "ffmpeg_version": ffmpeg_version,
            "recommended_encoder": recommended,
            "notes": notes,
        }

        self._cached_results = result
        return result

    async def _get_available_encoders(self, codec_type: str) -> List[str]:
        try:
            process = await asyncio.create_subprocess_exec(
                "ffmpeg", "-encoders",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            stdout, _ = await process.communicate()
            output = stdout.decode("utf-8", errors="ignore")

            type_indicator = "V" if codec_type == "video" else "A"
            encoders = []
            for line in output.splitlines():
                line = line.strip()
                if line.startswith(f"{type_indicator}") or (len(line) > 6 and line[1] == type_indicator):
                    parts = line.split()
                    if len(parts) >= 2:
                        encoders.append(parts[1])
            return encoders
        except Exception as e:
            logger.warning(f"Error querying ffmpeg encoders: {e}")
            return ["libx264", "libx265"] if codec_type == "video" else ["aac", "libopus"]

    async def _get_ffmpeg_version(self) -> str:
        try:
            process = await asyncio.create_subprocess_exec(
                "ffmpeg", "-version",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            stdout, _ = await process.communicate()
            first_line = stdout.decode("utf-8", errors="ignore").splitlines()
            return first_line[0] if first_line else "Unknown"
        except Exception:
            return "FFmpeg not found"

hardware_detector = HardwareDetector()
