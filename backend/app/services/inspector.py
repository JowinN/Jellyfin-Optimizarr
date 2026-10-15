import os
import json
import asyncio
from typing import Dict, Any, Optional, List
from app.core.logging import logger

class MediaInspector:
    """Authoritative FFprobe metadata inspector for video, audio, and subtitle streams."""

    async def probe(self, filepath: str) -> Optional[Dict[str, Any]]:
        """Executes FFprobe on a file and returns parsed structured metadata."""
        if not os.path.exists(filepath):
            logger.error(f"Cannot probe file; path does not exist: {filepath}")
            return None

        cmd = [
            "ffprobe",
            "-v", "quiet",
            "-print_format", "json",
            "-show_format",
            "-show_streams",
            "-show_chapters",
            filepath,
        ]

        try:
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, stderr = await process.communicate()

            if process.returncode != 0:
                logger.warning(f"FFprobe returned non-zero code {process.returncode} for {filepath}: {stderr.decode('utf-8', errors='ignore')}")
                return None

            raw_data = json.loads(stdout.decode("utf-8", errors="replace"))
            return self._parse_probe_data(filepath, raw_data)

        except FileNotFoundError:
            logger.error("FFprobe executable not found on system PATH.")
            return None
        except Exception as e:
            logger.error(f"Unexpected error probing {filepath}: {e}")
            return None

    def _parse_probe_data(self, filepath: str, raw: Dict[str, Any]) -> Dict[str, Any]:
        fmt = raw.get("format", {})
        streams = raw.get("streams", [])

        # Duration and File Size
        try:
            size_bytes = int(fmt.get("size", os.path.getsize(filepath)))
        except (ValueError, OSError):
            size_bytes = 0

        try:
            duration = float(fmt.get("duration", 0.0))
        except ValueError:
            duration = 0.0

        bitrate_kbps = int(float(fmt.get("bit_rate", 0)) / 1000) if fmt.get("bit_rate") else 0
        container_format = fmt.get("format_name", "").split(",")[0]

        # Extract Video Streams
        video_streams = [s for s in streams if s.get("codec_type") == "video"]
        primary_video = video_streams[0] if video_streams else {}

        video_codec = primary_video.get("codec_name", "unknown")
        width = int(primary_video.get("width", 0))
        height = int(primary_video.get("height", 0))
        pix_fmt = primary_video.get("pix_fmt", "")
        bit_depth = int(primary_video.get("bits_per_raw_sample", 8)) if primary_video.get("bits_per_raw_sample") else (10 if "10" in pix_fmt else 8)

        # Frame Rate
        fps = 0.0
        r_fps = primary_video.get("r_frame_rate", "0/1")
        if "/" in r_fps:
            num, den = r_fps.split("/")
            if float(den) > 0:
                fps = round(float(num) / float(den), 2)

        # Resolution label
        resolution = "Unknown"
        if width >= 3800 or height >= 2000:
            resolution = "4K"
        elif width >= 2500 or height >= 1400:
            resolution = "1440p"
        elif width >= 1900 or height >= 1000:
            resolution = "1080p"
        elif width >= 1200 or height >= 700:
            resolution = "720p"
        elif height > 0:
            resolution = f"{height}p"

        # HDR Detection
        color_transfer = primary_video.get("color_transfer", "")
        color_space = primary_video.get("color_space", "")
        is_hdr = color_transfer in ("smpte2084", "arib-std-b67") or "bt2020" in color_space
        hdr_format = ""
        if color_transfer == "smpte2084":
            hdr_format = "HDR10"
        elif color_transfer == "arib-std-b67":
            hdr_format = "HLG"
        if "side_data_list" in primary_video:
            for sd in primary_video["side_data_list"]:
                if "DOVI" in sd.get("side_data_type", "") or "Dolby Vision" in str(sd):
                    hdr_format = "Dolby Vision"

        # Audio Streams
        audio_streams = [s for s in streams if s.get("codec_type") == "audio"]
        audio_track_list = []
        audio_codecs_set = set()
        audio_langs_set = set()

        for idx, a in enumerate(audio_streams):
            codec = a.get("codec_name", "unknown")
            channels = int(a.get("channels", 2))
            layout = a.get("channel_layout", f"{channels} channels")
            sample_rate = int(a.get("sample_rate", 48000))
            tags = a.get("tags", {})
            lang = tags.get("language", tags.get("LANGUAGE", "und"))
            title = tags.get("title", tags.get("TITLE", f"Track {idx + 1}"))
            disposition = a.get("disposition", {})
            is_default = bool(disposition.get("default", 0))
            is_forced = bool(disposition.get("forced", 0))
            is_commentary = bool(disposition.get("comment", 0))

            audio_codecs_set.add(codec)
            if lang != "und":
                audio_langs_set.add(lang)

            audio_track_list.append({
                "stream_index": int(a.get("index", idx)),
                "audio_index": idx,
                "codec": codec,
                "channels": channels,
                "channel_layout": layout,
                "sample_rate": sample_rate,
                "bitrate": int(a.get("bit_rate", 0)) if a.get("bit_rate") else None,
                "language": lang,
                "title": title,
                "is_default": is_default,
                "is_forced": is_forced,
                "is_commentary": is_commentary,
            })

        # Subtitle Streams
        sub_streams = [s for s in streams if s.get("codec_type") == "subtitle"]
        sub_track_list = []
        sub_langs_set = set()

        for idx, s in enumerate(sub_streams):
            codec = s.get("codec_name", "unknown")
            tags = s.get("tags", {})
            lang = tags.get("language", tags.get("LANGUAGE", "und"))
            title = tags.get("title", tags.get("TITLE", f"Subtitle {idx + 1}"))
            disposition = s.get("disposition", {})
            is_default = bool(disposition.get("default", 0))
            is_forced = bool(disposition.get("forced", 0))
            is_bitmap = codec in ("hdmv_pgs_subtitle", "dvd_subtitle", "vobsub")

            if lang != "und":
                sub_langs_set.add(lang)

            sub_track_list.append({
                "stream_index": int(s.get("index", idx)),
                "sub_index": idx,
                "codec": codec,
                "language": lang,
                "title": title,
                "is_default": is_default,
                "is_forced": is_forced,
                "is_bitmap": is_bitmap,
            })

        # MB per minute calculation
        mb_per_minute = 0.0
        if duration > 10:
            mb_size = size_bytes / (1024 * 1024)
            minutes = duration / 60.0
            mb_per_minute = round(mb_size / minutes, 2)

        # Efficiency Score (100 is highly efficient, lower means ripe for optimization)
        # Based on codec, resolution, and MB/minute
        efficiency_score = self._calculate_efficiency(video_codec, resolution, mb_per_minute)

        return {
            "size_bytes": size_bytes,
            "duration_seconds": round(duration, 2),
            "container_format": container_format,
            "video_codec": video_codec,
            "resolution": resolution,
            "width": width,
            "height": height,
            "fps": fps,
            "bitrate_kbps": bitrate_kbps,
            "bit_depth": bit_depth,
            "pixel_format": pix_fmt,
            "is_hdr": is_hdr,
            "hdr_format": hdr_format,
            "audio_tracks_count": len(audio_track_list),
            "audio_codecs": ", ".join(sorted(audio_codecs_set)) if audio_codecs_set else "None",
            "audio_languages": ", ".join(sorted(audio_langs_set)) if audio_langs_set else "und",
            "subtitle_tracks_count": len(sub_track_list),
            "subtitle_languages": ", ".join(sorted(sub_langs_set)) if sub_langs_set else "None",
            "mb_per_minute": mb_per_minute,
            "efficiency_score": efficiency_score,
            "streams_detail": {
                "video": primary_video,
                "audio": audio_track_list,
                "subtitles": sub_track_list,
                "chapters_count": len(raw.get("chapters", [])),
            }
        }

    def _calculate_efficiency(self, codec: str, resolution: str, mb_per_minute: float) -> float:
        if mb_per_minute <= 0:
            return 50.0

        # Benchmark standard targets in MB/min for HEVC/AV1 at balanced quality:
        # 1080p: ~20-30 MB/min
        # 4K: ~60-90 MB/min
        # 720p: ~10-18 MB/min
        base_targets = {
            "4K": 75.0,
            "1440p": 45.0,
            "1080p": 25.0,
            "720p": 12.0,
            "480p": 6.0,
        }
        target = base_targets.get(resolution, 25.0)

        # Efficiency: ratio of target to actual, clamped between 5.0 and 99.0
        score = (target / mb_per_minute) * 75.0
        if codec in ("hevc", "av1", "h265"):
            score += 15.0  # Already using modern codec
        elif codec in ("mpeg2video", "vc1", "msmpeg4v3"):
            score -= 20.0  # Very old inefficient codec

        return round(max(5.0, min(99.0, score)), 1)

media_inspector = MediaInspector()
