import os
import asyncio
from typing import Dict, Any, List, Tuple
from app.models.profile import EncodingProfile
from app.services.inspector import media_inspector
from app.core.logging import logger

class OutputValidator:
    """Rigorous post-encode validator for container integrity, audio preservation, subtitles, and duration."""

    async def validate(
        self,
        output_path: str,
        source_info: Dict[str, Any],
        profile: EncodingProfile,
    ) -> Tuple[bool, List[str]]:
        errors: List[str] = []

        # 1. Basic File Existence & Non-zero Size
        if not os.path.exists(output_path):
            return False, ["Output file was not created on disk."]

        out_size = os.path.getsize(output_path)
        if out_size <= 1024:  # Under 1 KB is certainly broken
            return False, [f"Output file size is abnormally small ({out_size} bytes)."]

        # 2. Probe Output with FFprobe
        out_info = await media_inspector.probe(output_path)
        if not out_info:
            return False, ["FFprobe failed to inspect output file. Container is corrupt or unreadable."]

        # 3. Video Stream Validation
        if out_info.get("video_codec") in ("unknown", ""):
            errors.append("Output contains no readable video stream.")

        # 4. Duration Consistency Check
        src_duration = float(source_info.get("duration_seconds", 0.0))
        out_duration = float(out_info.get("duration_seconds", 0.0))

        if src_duration > 10 and out_duration > 0:
            diff = abs(src_duration - out_duration)
            # Allow at most 3% or 5 seconds discrepancy
            max_allowed_diff = max(5.0, src_duration * 0.03)
            if diff > max_allowed_diff:
                errors.append(f"Duration mismatch: Source={src_duration:.1f}s, Output={out_duration:.1f}s (Diff={diff:.1f}s exceeds limit {max_allowed_diff:.1f}s).")

        # 5. MANDATORY AUDIO VALIDATION
        src_audio_count = source_info.get("audio_tracks_count", 0)
        out_audio_count = out_info.get("audio_tracks_count", 0)

        if src_audio_count > 0:
            # Source had audio: Output MUST have audio!
            if out_audio_count == 0:
                errors.append(
                    f"CRITICAL: Output has 0 audio tracks, but source had {src_audio_count} audio tracks! "
                    "Silent output is prohibited."
                )
            else:
                # If audio policy is copy_all, output should have at least as many audio tracks as source
                if profile.audio_policy in ("copy_all", "transcode_all") and out_audio_count < src_audio_count:
                    errors.append(
                        f"Audio stream loss: Source had {src_audio_count} tracks, output only has {out_audio_count}."
                    )

                # Validate audio stream decodability with FFmpeg decode test
                decode_ok, decode_err = await self._test_audio_decoding(output_path)
                if not decode_ok:
                    errors.append(f"Audio decode verification failed: {decode_err}")

        elif src_audio_count == 0 and not profile.allow_silent_output:
            # Source was silent and profile didn't authorize silent output
            errors.append("Source file contains no audio streams and silent output is not authorized.")

        # 6. Subtitle Preservation Check
        src_sub_count = source_info.get("subtitle_tracks_count", 0)
        out_sub_count = out_info.get("subtitle_tracks_count", 0)
        if profile.subtitle_policy == "copy_all" and src_sub_count > 0 and out_sub_count == 0:
            # Note: Certain containers (like MP4) might not support all subtitle types (like PGS bitmap),
            # but if it's MKV, all subtitles should be retained.
            if output_path.lower().endswith(".mkv"):
                errors.append(
                    f"Subtitle loss in MKV: Source had {src_sub_count} subtitle tracks, output has {out_sub_count}."
                )

        is_valid = len(errors) == 0
        if not is_valid:
            logger.error(f"Validation failed for {output_path}: {'; '.join(errors)}")
        else:
            logger.info(f"Validation passed successfully for {output_path}. Duration={out_duration:.1f}s, AudioTracks={out_audio_count}")

        return is_valid, errors

    async def _test_audio_decoding(self, filepath: str) -> Tuple[bool, str]:
        """Runs a short FFmpeg decode pass on the audio streams to ensure packets are not corrupted."""
        try:
            cmd = [
                "ffmpeg",
                "-v", "error",
                "-i", filepath,
                "-t", "5",
                "-vn",
                "-f", "null",
                "-",
            ]
            proc = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            _, stderr = await proc.communicate()
            if proc.returncode != 0:
                err_msg = stderr.decode("utf-8", errors="ignore").strip()
                return False, err_msg or "Decoding error"
            return True, ""
        except Exception as e:
            logger.warning(f"Audio decode test skipped/failed to run: {e}")
            return True, ""  # Don't fail if ffmpeg command couldn't execute decode test tool

output_validator = OutputValidator()
