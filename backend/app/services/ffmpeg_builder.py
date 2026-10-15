import os
from typing import List, Dict, Any, Optional
from app.models.profile import EncodingProfile
from app.config import settings
from app.core.logging import logger

class FFmpegCommandBuilder:
    """Builds structured, validated argument arrays for FFmpeg execution. Strictly avoids shell strings."""

    def build_command(
        self,
        input_path: str,
        output_path: str,
        profile: EncodingProfile,
        media_info: Dict[str, Any],
        hwaccel_override: Optional[str] = None,
        is_sample: bool = False,
        sample_duration_seconds: int = 60,
        sample_start_seconds: int = 120,
    ) -> List[str]:
        cmd: List[str] = ["ffmpeg", "-hide_banner", "-y"]

        # Hardware Acceleration Inputs
        hw_mode = hwaccel_override or profile.hwaccel_type
        if hw_mode == "auto":
            hw_mode = settings.HWACCEL_MODE
        if hw_mode == "auto":
            if os.path.exists(settings.DRI_DEVICE):
                hw_mode = "vaapi"
            else:
                hw_mode = "cpu_only"

        use_cuda = hw_mode in ("cuda", "nvenc")
        use_vaapi = hw_mode == "vaapi" and os.path.exists(settings.DRI_DEVICE)
        use_qsv = hw_mode == "qsv" and os.path.exists(settings.DRI_DEVICE)

        if use_cuda and profile.video_codec != "copy":
            cmd.extend(["-hwaccel", "auto"])
        elif use_vaapi and profile.video_codec != "copy":
            cmd.extend([
                "-vaapi_device", settings.DRI_DEVICE,
                "-hwaccel", "vaapi",
                "-hwaccel_output_format", "vaapi",
            ])
        elif use_qsv and profile.video_codec != "copy":
            cmd.extend([
                "-init_hw_device", "qsv=hw",
                "-filter_hw_device", "hw",
                "-hwaccel", "qsv",
            ])

        # Sample preview seek options if requested
        if is_sample:
            cmd.extend(["-ss", str(sample_start_seconds)])

        # Input file
        cmd.extend(["-i", input_path])

        if is_sample:
            cmd.extend(["-t", str(sample_duration_seconds)])

        # Explicit Stream Mapping
        # 1. Primary Video
        cmd.extend(["-map", "0:v:0"])

        # 2. Audio Mapping - Preserve ALL required audio tracks by default
        streams_detail = media_info.get("streams_detail", {})
        audio_tracks = streams_detail.get("audio", [])
        has_audio = len(audio_tracks) > 0

        if not has_audio and not profile.allow_silent_output:
            logger.info("Source has no audio tracks. Silent output flag is False.")

        audio_cmd_parts = self._build_audio_mapping(profile, audio_tracks)
        cmd.extend(audio_cmd_parts)

        # 3. Subtitle Mapping - Preserve all subtitles by default
        if profile.subtitle_policy != "none":
            # Map all subtitle streams if present
            cmd.extend(["-map", "0:s?"])
            cmd.extend(["-c:s", "copy"])

        # 4. Metadata & Chapters Preservation
        cmd.extend([
            "-map_chapters", "0",
            "-map_metadata", "0",
        ])

        # Video Filter & Encoding Configuration
        if profile.video_codec == "copy":
            cmd.extend(["-c:v", "copy"])
        else:
            video_args = self._build_video_args(profile, media_info, use_vaapi, use_qsv, use_cuda)
            cmd.extend(video_args)

        # Thread limits if configured
        if settings.FFMPEG_THREADS > 0:
            cmd.extend(["-threads", str(settings.FFMPEG_THREADS)])

        # Progress reporting over pipe
        cmd.extend(["-progress", "pipe:1", "-nostats"])

        # Output file destination
        cmd.append(output_path)

        return cmd

    def _build_audio_mapping(self, profile: EncodingProfile, audio_tracks: List[Dict[str, Any]]) -> List[str]:
        args: List[str] = []
        if not audio_tracks:
            return args

        policy = profile.audio_policy
        preferred_codec = profile.preferred_audio_codec
        bitrate_k = profile.audio_bitrate_kbps or 192

        # YouTube & AV1 Presets or Opus preferred: strictly uses Opus
        if profile.video_codec in ("youtube", "av1") or preferred_codec == "opus":
            if policy == "copy_all" and (profile.video_codec in ("youtube", "av1") or preferred_codec == "opus"):
                policy = "transcode_all"
            preferred_codec = "opus"
            bitrate_k = profile.audio_bitrate_kbps or (128 if profile.video_codec == "youtube" else 96)

        if policy == "copy_all":
            # Direct stream-copy for all audio streams
            for idx in range(len(audio_tracks)):
                args.extend(["-map", f"0:a:{idx}", f"-c:a:{idx}", "copy"])

        elif policy == "transcode_all":
            codec_flag = "libopus" if preferred_codec == "opus" else preferred_codec
            for idx in range(len(audio_tracks)):
                args.extend([
                    "-map", f"0:a:{idx}",
                    f"-c:a:{idx}", codec_flag,
                    f"-b:a:{idx}", f"{bitrate_k}k",
                ])

        elif policy == "keep_surround_add_aac":
            # Copy all original tracks
            for idx, track in enumerate(audio_tracks):
                args.extend(["-map", f"0:a:{idx}", f"-c:a:{idx}", "copy"])

            # If track 0 has >2 channels, add an extra stereo AAC compatibility track
            if audio_tracks and audio_tracks[0].get("channels", 2) > 2:
                next_idx = len(audio_tracks)
                args.extend([
                    "-map", "0:a:0",
                    f"-c:a:{next_idx}", "aac",
                    f"-ac:a:{next_idx}", "2",
                    f"-b:a:{next_idx}", "192k",
                    f"-metadata:s:a:{next_idx}", "title=Stereo AAC Compatibility",
                ])
        else:
            # Default safe fallback: copy all tracks
            for idx in range(len(audio_tracks)):
                args.extend(["-map", f"0:a:{idx}", f"-c:a:{idx}", "copy"])

        return args

    def _build_video_args(
        self,
        profile: EncodingProfile,
        media_info: Dict[str, Any],
        use_vaapi: bool,
        use_qsv: bool,
        use_cuda: bool = False,
    ) -> List[str]:
        args: List[str] = []
        target_codec = profile.video_codec
        source_width = media_info.get("width", 0)
        source_height = media_info.get("height", 0)

        # Filters construction (Scaling, Deinterlacing)
        filters: List[str] = []

        if profile.deinterlace:
            if use_vaapi:
                filters.append("deinterlace_vaapi")
            elif use_qsv:
                filters.append("vpp_qsv=deinterlace=advanced")
            else:
                filters.append("yadif")

        # Resolution scaling - NEVER upscale!
        target_height = self._get_target_height(profile.resolution_mode, profile.max_height)
        target_width = 1280 if target_height == 720 else (1920 if target_height == 1080 else (854 if target_height == 480 else (3840 if target_height == 2160 else 0)))

        needs_downscale = False
        if target_height > 0:
            if source_height > target_height or (target_width > 0 and source_width > target_width):
                needs_downscale = True
            elif source_height == 0:
                needs_downscale = True

        if needs_downscale and target_height > 0:
            if use_vaapi:
                filters.append(f"scale_vaapi=w=-2:h={target_height}")
            elif use_qsv:
                filters.append(f"scale_qsv=w=-2:h={target_height}")
            else:
                if target_width > 0:
                    filters.append(f"scale='min({target_width},iw)':'min({target_height},ih)':force_original_aspect_ratio=decrease,scale=trunc(iw/2)*2:trunc(ih/2)*2")
                else:
                    filters.append(f"scale=-2:{target_height}")

        # HDR to SDR Tone Mapping if explicitly requested
        if profile.hdr_to_sdr_tonemap and media_info.get("is_hdr"):
            if not use_vaapi and not use_qsv:
                filters.append("tonemap=tonemap=hable:desat=0,format=yuv420p")

        if filters:
            args.extend(["-vf", ",".join(filters)])

        # Target Bitrate calculations:
        # Priority 1: Target MB per minute (e.g. 8.5 MB/min = ~1 GB for 2-hour movie)
        target_mb_min = getattr(profile, "target_mb_per_minute", 0.0) or 0.0
        scale_down = getattr(profile, "scale_down_percent", 0) or 0
        target_bitrate_kbps = profile.target_bitrate_kbps or 0
        source_size_bytes = media_info.get("size_bytes", 0)
        duration_sec = float(media_info.get("duration_seconds", 0.0))

        if target_mb_min > 0:
            # 1 MB = 1024 * 1024 * 8 bits. In 60 seconds:
            total_target_kbps = int((target_mb_min * 1024 * 1024 * 8) / 60000)
            audio_kbps = profile.audio_bitrate_kbps or (96 if profile.preferred_audio_codec == "opus" or target_codec in ("youtube", "av1") else 128)
            target_bitrate_kbps = max(100, total_target_kbps - audio_kbps)
        elif scale_down > 0 and source_size_bytes > 0 and duration_sec > 0:
            reduction_ratio = min(0.95, max(0.05, scale_down / 100.0))
            target_size_bytes = source_size_bytes * (1.0 - reduction_ratio)
            total_target_kbps = int((target_size_bytes * 8) / (duration_sec * 1000))
            audio_kbps = profile.audio_bitrate_kbps or (128 if target_codec == "youtube" else 192)
            target_bitrate_kbps = max(100, total_target_kbps - audio_kbps)

        # Codec Selection & Hardware Specifics
        if use_cuda:
            if target_codec in ("hevc", "h265"):
                encoder = "hevc_nvenc"
            elif target_codec in ("youtube", "av1"):
                encoder = "hevc_nvenc"
            else:
                encoder = "h264_nvenc"
            args.extend(["-c:v", encoder, "-preset", "p4", "-rc", "vbr"])
            if target_bitrate_kbps > 0:
                args.extend(["-b:v", f"{target_bitrate_kbps}k", "-maxrate", f"{int(target_bitrate_kbps * 1.15)}k", "-bufsize", f"{int(target_bitrate_kbps * 2)}k"])
            else:
                args.extend(["-cq", str(int(profile.crf))])
            args.extend(["-pix_fmt", "yuv420p"])
        elif use_vaapi:
            encoder = "hevc_vaapi" if target_codec in ("hevc", "h265", "youtube", "av1") else "h264_vaapi"
            args.extend(["-c:v", encoder])
            if target_bitrate_kbps > 0:
                args.extend(["-b:v", f"{target_bitrate_kbps}k", "-maxrate", f"{int(target_bitrate_kbps * 1.15)}k"])
            else:
                qp_val = int(profile.crf + 2)  # VAAPI QP mapping
                args.extend(["-qp", str(qp_val)])
        elif use_qsv:
            encoder = "hevc_qsv" if target_codec in ("hevc", "h265", "youtube", "av1") else "h264_qsv"
            args.extend(["-c:v", encoder])
            if target_bitrate_kbps > 0:
                args.extend(["-b:v", f"{target_bitrate_kbps}k"])
            else:
                args.extend(["-global_quality", str(int(profile.crf))])
            args.extend(["-preset", profile.encoder_preset or "medium"])
        else:
            # Software Encoders
            enc_preset = profile.encoder_preset or "medium"
            if target_codec in ("youtube", "av1"):
                # SVT-AV1 high-efficiency next-generation codec
                args.extend(["-c:v", "libsvtav1"])
                if target_bitrate_kbps > 0:
                    args.extend([
                        "-b:v", f"{target_bitrate_kbps}k",
                        "-maxrate", f"{int(target_bitrate_kbps * 1.15)}k",
                        "-bufsize", f"{int(target_bitrate_kbps * 2)}k",
                    ])
                else:
                    args.extend(["-crf", str(int(profile.crf + 4))])
                svt_preset = enc_preset if enc_preset.isdigit() else "6"
                args.extend(["-preset", svt_preset])
                args.extend(["-pix_fmt", "yuv420p10le"])

            elif target_codec in ("hevc", "h265"):
                args.extend(["-c:v", "libx265"])
                if target_bitrate_kbps > 0:
                    args.extend([
                        "-b:v", f"{target_bitrate_kbps}k",
                        "-maxrate", f"{int(target_bitrate_kbps * 1.3)}k",
                        "-bufsize", f"{int(target_bitrate_kbps * 2)}k",
                    ])
                else:
                    args.extend(["-crf", str(profile.crf)])
                args.extend(["-preset", enc_preset])

                # 10-bit preservation or default
                if profile.pixel_format == "yuv420p10le" or media_info.get("bit_depth", 8) == 10:
                    args.extend(["-pix_fmt", "yuv420p10le"])
                else:
                    args.extend(["-pix_fmt", "yuv420p"])

                # Preserve HDR color metadata
                if profile.preserve_hdr and media_info.get("is_hdr"):
                    args.extend([
                        "-color_primaries", "bt2020",
                        "-color_trc", "smpte2084",
                        "-colorspace", "bt2020nc",
                    ])

            else:
                # Default H.264
                args.extend(["-c:v", "libx264"])
                if target_bitrate_kbps > 0:
                    args.extend([
                        "-b:v", f"{target_bitrate_kbps}k",
                        "-maxrate", f"{int(target_bitrate_kbps * 1.3)}k",
                        "-bufsize", f"{int(target_bitrate_kbps * 2)}k",
                    ])
                else:
                    args.extend(["-crf", str(profile.crf)])
                args.extend(["-preset", enc_preset])
                args.extend(["-pix_fmt", "yuv420p"])

        # Bitrate constraints if explicitly configured
        max_br = profile.max_bitrate_kbps or 0
        buf_br = profile.bufsize_kbps or 0
        if max_br > 0 and target_bitrate_kbps == 0:
            args.extend(["-maxrate", f"{max_br}k"])
        if buf_br > 0 and target_bitrate_kbps == 0:
            args.extend(["-bufsize", f"{buf_br}k"])

        return args

    def _get_target_height(self, mode: str, custom_height: int) -> int:
        mapping = {
            "2160p": 2160,
            "1440p": 1440,
            "1080p": 1080,
            "720p": 720,
            "480p": 480,
            "custom": custom_height,
        }
        return mapping.get(mode, 0)

ffmpeg_command_builder = FFmpegCommandBuilder()
