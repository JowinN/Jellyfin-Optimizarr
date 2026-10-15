import pytest
from app.models.profile import EncodingProfile
from app.services.ffmpeg_builder import ffmpeg_command_builder

def test_ffmpeg_builder_basic_structure():
    profile = EncodingProfile(
        name="Test Balanced",
        video_codec="hevc",
        crf=22.0,
        encoder_preset="medium",
        pixel_format="yuv420p10le",
        resolution_mode="original",
        audio_policy="copy_all",
        subtitle_policy="copy_all",
        preserve_hdr=True,
        hwaccel_type="cpu_only",
        allow_silent_output=False,
    )

    media_info = {
        "width": 1920,
        "height": 1080,
        "is_hdr": False,
        "bit_depth": 8,
        "streams_detail": {
            "audio": [
                {"index": 1, "codec": "dts", "channels": 6, "language": "eng"},
                {"index": 2, "codec": "ac3", "channels": 2, "language": "spa"},
            ],
            "subtitles": [
                {"index": 3, "codec": "subrip", "language": "eng"},
            ],
        },
    }

    cmd = ffmpeg_command_builder.build_command(
        input_path="/movies/test_movie.mkv",
        output_path="/work/output_test.mkv",
        profile=profile,
        media_info=media_info,
    )

    # 1. Assert command is a list of strings
    assert isinstance(cmd, list)
    assert all(isinstance(arg, str) for arg in cmd)

    # 2. Assert no audio-disabling option (-an) is used
    assert "-an" not in cmd

    # 3. Assert explicit video mapping
    assert "-map" in cmd
    v_idx = cmd.index("-map")
    assert cmd[v_idx + 1] == "0:v:0"

    # 4. Assert all audio tracks are mapped
    assert "-map" in cmd
    assert "0:a:0" in cmd
    assert "0:a:1" in cmd
    assert "-c:a:0" in cmd
    assert cmd[cmd.index("-c:a:0") + 1] == "copy"
    assert cmd[cmd.index("-c:a:1") + 1] == "copy"

    # 5. Assert subtitle preservation
    assert "0:s?" in cmd
    assert "-c:s" in cmd
    assert cmd[cmd.index("-c:s") + 1] == "copy"

    # 6. Assert metadata & chapters
    assert "-map_chapters" in cmd
    assert "-map_metadata" in cmd

    # 7. Assert codec and CRF
    assert "-c:v" in cmd
    assert cmd[cmd.index("-c:v") + 1] == "libx265"
    assert "-crf" in cmd
    assert cmd[cmd.index("-crf") + 1] == "22.0"

def test_ffmpeg_builder_never_upscales():
    profile = EncodingProfile(
        name="Downscale 1080p",
        video_codec="hevc",
        resolution_mode="1080p",
        audio_policy="copy_all",
        subtitle_policy="copy_all",
        hwaccel_type="cpu_only",
    )

    # 720p source should NOT be scaled up to 1080p
    media_info_720p = {
        "width": 1280,
        "height": 720,
        "streams_detail": {"audio": [{"index": 1, "codec": "aac"}]},
    }

    cmd = ffmpeg_command_builder.build_command(
        input_path="/tv/show_720p.mkv",
        output_path="/work/out_720p.mkv",
        profile=profile,
        media_info=media_info_720p,
    )

    # Ensure no scale filter was added to upscale
    if "-vf" in cmd:
        vf_val = cmd[cmd.index("-vf") + 1]
        assert "1080" not in vf_val

def test_ffmpeg_builder_transcode_audio_policy():
    profile = EncodingProfile(
        name="Transcode AAC",
        video_codec="hevc",
        resolution_mode="original",
        audio_policy="transcode_all",
        preferred_audio_codec="aac",
        audio_bitrate_kbps=192,
        subtitle_policy="copy_all",
        hwaccel_type="cpu_only",
    )

    media_info = {
        "width": 1920,
        "height": 1080,
        "streams_detail": {
            "audio": [
                {"index": 1, "codec": "truehd", "channels": 8},
            ]
        },
    }

    cmd = ffmpeg_command_builder.build_command(
        input_path="/movies/input.mkv",
        output_path="/work/out.mkv",
        profile=profile,
        media_info=media_info,
    )

    assert "-c:a:0" in cmd
    assert cmd[cmd.index("-c:a:0") + 1] == "aac"
    assert "-b:a:0" in cmd
    assert cmd[cmd.index("-b:a:0") + 1] == "192k"

def test_ffmpeg_builder_youtube_preset():
    profile = EncodingProfile(
        name="YouTube Space Saver",
        video_codec="youtube",
        scale_down_percent=50,
        rate_control_mode="target_bitrate",
        resolution_mode="original",
        audio_policy="transcode_all",
        preferred_audio_codec="opus",
        audio_bitrate_kbps=128,
        subtitle_policy="copy_all",
        hwaccel_type="cpu_only",
    )

    # 1 hour movie, 2 GB source
    media_info = {
        "width": 1920,
        "height": 1080,
        "size_bytes": 2 * 1024 * 1024 * 1024,
        "duration_seconds": 3600.0,
        "streams_detail": {
            "audio": [{"index": 1, "codec": "aac", "channels": 2}]
        },
    }

    cmd = ffmpeg_command_builder.build_command(
        input_path="/movies/input.mkv",
        output_path="/work/out_youtube.mkv",
        profile=profile,
        media_info=media_info,
    )

    # 1. Video codec must be libsvtav1 (YouTube's standard high-efficiency video)
    assert "-c:v" in cmd
    assert cmd[cmd.index("-c:v") + 1] == "libsvtav1"

    # 2. Audio codec must be libopus (YouTube's standard space-efficient audio)
    assert "-c:a:0" in cmd
    assert cmd[cmd.index("-c:a:0") + 1] == "libopus"
    assert "-b:a:0" in cmd
    assert cmd[cmd.index("-b:a:0") + 1] == "128k"

    # 3. 50% scale-down produces target video bitrate for half the size
    # Total target = 1GB in 3600s = (1024*1024*1024*8)/(3600*1000) = 2386 kbps
    # Video target = 2386 - 128 = 2258 kbps
    assert "-b:v" in cmd
    bitrate_arg = cmd[cmd.index("-b:v") + 1]
    assert bitrate_arg.endswith("k")
    kbps = int(bitrate_arg[:-1])
    assert 2200 <= kbps <= 2300

def test_ffmpeg_builder_scale_down_half_size():
    profile = EncodingProfile(
        name="Half Size HEVC",
        video_codec="hevc",
        scale_down_percent=50,
        resolution_mode="original",
        audio_policy="copy_all",
        preferred_audio_codec="copy",
        subtitle_policy="copy_all",
        hwaccel_type="cpu_only",
    )

    media_info = {
        "width": 1920,
        "height": 1080,
        "size_bytes": 1000 * 1000 * 1000,  # 1 GB
        "duration_seconds": 1000.0,        # 1000 seconds
        "streams_detail": {
            "audio": [{"index": 1, "codec": "aac", "channels": 2}]
        },
    }

    cmd = ffmpeg_command_builder.build_command(
        input_path="/movies/input.mkv",
        output_path="/work/out_hevc.mkv",
        profile=profile,
        media_info=media_info,
    )

    assert "-c:v" in cmd
    assert cmd[cmd.index("-c:v") + 1] == "libx265"
    assert "-b:v" in cmd
    bitrate_arg = cmd[cmd.index("-b:v") + 1]
    kbps = int(bitrate_arg[:-1])
    # Total target = 500 MB in 1000s = (500*1000*1000*8)/(1000*1000) = 4000 kbps
    # Video target = 4000 - 192 = 3808 kbps
    assert 3700 <= kbps <= 3900

def test_ffmpeg_builder_smart_target_size_4k_downscale():
    profile = EncodingProfile(
        name="Smart Target Size (8.5 MB/min • 720p AV1 + Opus)",
        video_codec="av1",
        target_mb_per_minute=8.5,
        resolution_mode="720p",
        audio_policy="transcode_all",
        preferred_audio_codec="opus",
        audio_bitrate_kbps=96,
        subtitle_policy="copy_all",
        hwaccel_type="cpu_only",
    )

    # 4K Movie source (3840x2160), 2 hours (7200 seconds), 15 GB
    media_info_4k = {
        "width": 3840,
        "height": 2160,
        "size_bytes": 15 * 1024 * 1024 * 1024,
        "duration_seconds": 7200.0,
        "streams_detail": {
            "audio": [{"index": 1, "codec": "dts_hd", "channels": 6}]
        },
    }

    cmd = ffmpeg_command_builder.build_command(
        input_path="/movies/4k_movie.mkv",
        output_path="/work/out_720p_av1.mkv",
        profile=profile,
        media_info=media_info_4k,
    )

    # 1. 4K must be scaled down to 720p
    assert "-vf" in cmd
    vf_val = cmd[cmd.index("-vf") + 1]
    assert "720" in vf_val

    # 2. Codec is SVT-AV1
    assert "-c:v" in cmd
    assert cmd[cmd.index("-c:v") + 1] == "libsvtav1"

    # 3. Audio is Opus @ 96k
    assert "-c:a:0" in cmd
    assert cmd[cmd.index("-c:a:0") + 1] == "libopus"
    assert "-b:a:0" in cmd
    assert cmd[cmd.index("-b:a:0") + 1] == "96k"

    # 4. Strict 8.5 MB/min rate control:
    # 8.5 MB/min = 8.5 * 1024 * 1024 * 8 / 60000 = 1188 kbps total
    # Video target = 1188 - 96 = 1092 kbps
    assert "-b:v" in cmd
    bitrate_arg = cmd[cmd.index("-b:v") + 1]
    assert bitrate_arg.endswith("k")
    kbps = int(bitrate_arg[:-1])
    assert 1050 <= kbps <= 1120
    assert "-maxrate" in cmd
    assert "-bufsize" in cmd

