import os
import pytest
from unittest.mock import AsyncMock, patch
from app.models.profile import EncodingProfile
from app.services.validator import output_validator

@pytest.mark.asyncio
async def test_validator_fails_missing_file():
    profile = EncodingProfile(name="Test", allow_silent_output=False)
    is_valid, errors = await output_validator.validate(
        output_path="/nonexistent/file.mkv",
        source_info={"duration_seconds": 120.0, "audio_tracks_count": 1},
        profile=profile,
    )
    assert not is_valid
    assert any("not created on disk" in e for e in errors)

@pytest.mark.asyncio
async def test_validator_fails_missing_audio_when_source_had_audio():
    profile = EncodingProfile(name="Test", allow_silent_output=False, audio_policy="copy_all")

    # Mock FFprobe returning output without audio
    mock_probe = {
        "duration_seconds": 120.0,
        "video_codec": "hevc",
        "audio_tracks_count": 0,  # Missing audio!
        "subtitle_tracks_count": 1,
    }

    with patch("os.path.exists", return_value=True), \
         patch("os.path.getsize", return_value=50 * 1024 * 1024), \
         patch("app.services.inspector.media_inspector.probe", new_callable=AsyncMock) as mock_probe_fn:
        mock_probe_fn.return_value = mock_probe

        is_valid, errors = await output_validator.validate(
            output_path="/work/silent_output.mkv",
            source_info={"duration_seconds": 120.0, "audio_tracks_count": 2},
            profile=profile,
        )

        assert not is_valid
        assert any("Silent output is prohibited" in e or "Output has 0 audio tracks" in e for e in errors)

@pytest.mark.asyncio
async def test_validator_fails_duration_mismatch():
    profile = EncodingProfile(name="Test", allow_silent_output=False, audio_policy="copy_all")

    mock_probe = {
        "duration_seconds": 45.0,  # Truncated! Source was 120s
        "video_codec": "hevc",
        "audio_tracks_count": 1,
        "subtitle_tracks_count": 0,
    }

    with patch("os.path.exists", return_value=True), \
         patch("os.path.getsize", return_value=30 * 1024 * 1024), \
         patch("app.services.inspector.media_inspector.probe", new_callable=AsyncMock) as mock_probe_fn, \
         patch.object(output_validator, "_test_audio_decoding", new_callable=AsyncMock) as mock_decode:
        mock_probe_fn.return_value = mock_probe
        mock_decode.return_value = (True, "")

        is_valid, errors = await output_validator.validate(
            output_path="/work/truncated.mkv",
            source_info={"duration_seconds": 120.0, "audio_tracks_count": 1},
            profile=profile,
        )

        assert not is_valid
        assert any("Duration mismatch" in e for e in errors)
