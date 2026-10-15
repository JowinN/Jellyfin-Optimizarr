import pytest
from sqlalchemy import select
from app.models.profile import EncodingProfile
from app.services.profile_manager import profile_manager, DEFAULT_PRESETS

@pytest.mark.asyncio
async def test_seed_presets_includes_youtube(test_session):
    stmt = select(EncodingProfile).where(EncodingProfile.video_codec == "youtube")
    res = await test_session.execute(stmt)
    yt_profile = res.scalar_one_or_none()
    assert yt_profile is not None
    assert yt_profile.name == "YouTube Space Saver (AV1 + Opus)"
    assert yt_profile.preferred_audio_codec == "opus"
    assert yt_profile.scale_down_percent == 50

@pytest.mark.asyncio
async def test_seed_presets_includes_smart_target_size(test_session):
    stmt = select(EncodingProfile).where(EncodingProfile.name == "Smart Target Size (8.5 MB/min • 720p AV1 + Opus)")
    res = await test_session.execute(stmt)
    smart_profile = res.scalar_one_or_none()
    assert smart_profile is not None
    assert smart_profile.video_codec == "av1"
    assert smart_profile.preferred_audio_codec == "opus"
    assert smart_profile.target_mb_per_minute == 8.5
    assert smart_profile.resolution_mode == "720p"

@pytest.mark.asyncio
async def test_delete_builtin_profile(test_session):
    stmt = select(EncodingProfile).where(EncodingProfile.name == "Maximum Quality")
    profile = (await test_session.execute(stmt)).scalar_one_or_none()
    assert profile is not None
    assert profile.is_preset is True

    # User deletes the built-in profile
    await test_session.delete(profile)
    await test_session.commit()

    # Verify it is deleted
    stmt2 = select(EncodingProfile).where(EncodingProfile.name == "Maximum Quality")
    profile_after = (await test_session.execute(stmt2)).scalar_one_or_none()
    assert profile_after is None

    # Verify seed_presets does not resurrect deleted preset
    await profile_manager.seed_presets(test_session)
    profile_recheck = (await test_session.execute(stmt2)).scalar_one_or_none()
    assert profile_recheck is None

    # Verify restore_default_presets restores it
    await profile_manager.restore_default_presets(test_session)
    profile_restored = (await test_session.execute(stmt2)).scalar_one_or_none()
    assert profile_restored is not None
    assert profile_restored.name == "Maximum Quality"
