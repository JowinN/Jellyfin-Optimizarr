import os
import shutil
import pytest
from unittest.mock import patch, MagicMock
from app.models.media import MediaItem
from app.services.replacement_manager import replacement_manager

@pytest.mark.asyncio
async def test_replacement_aborts_if_source_modified(test_session):
    item = MediaItem(
        path="/movies/sample_modified.mkv",
        filename="sample_modified.mkv",
        library="movies",
        size_bytes=1000000,
        mtime=100.0,
    )
    test_session.add(item)
    await test_session.commit()

    with patch("os.path.exists", return_value=True), \
         patch("os.stat") as mock_stat:
        # Simulate source modified during encode (mtime shifted to 200.0)
        mock_stat.return_value = MagicMock(st_mtime=200.0, st_size=1000000)

        success, msg, backup_path = await replacement_manager.execute_replacement(
            session=test_session,
            media_item=item,
            temp_encoded_path="/work/out.mkv",
            replacement_mode="replace_with_backup",
            pre_encode_mtime=100.0,
            pre_encode_size=1000000,
            job_id=1,
        )

        assert not success
        assert "modified or replaced during encoding" in msg
        assert backup_path is None

@pytest.mark.asyncio
async def test_replacement_optimized_copy_mode(test_session):
    item = MediaItem(
        path="/movies/sample_copy.mkv",
        filename="sample_copy.mkv",
        library="movies",
        size_bytes=1000000,
        mtime=100.0,
    )
    test_session.add(item)
    await test_session.commit()

    with patch("os.path.exists", return_value=True), \
         patch("os.stat", return_value=MagicMock(st_mtime=100.0, st_size=1000000)), \
         patch("os.path.getsize", return_value=500000), \
         patch("shutil.copy2") as mock_copy, \
         patch.object(replacement_manager, "check_disk_space", return_value=(True, 50.0)):

        success, msg, backup_path = await replacement_manager.execute_replacement(
            session=test_session,
            media_item=item,
            temp_encoded_path="/work/out.mkv",
            replacement_mode="optimized_copy",
            pre_encode_mtime=100.0,
            pre_encode_size=1000000,
            job_id=1,
        )

        assert success
        mock_copy.assert_called_once_with("/work/out.mkv", "/movies/sample_copy.optimized.mkv")

@pytest.mark.asyncio
async def test_replacement_aborts_if_output_larger_than_source(test_session):
    """Verify that replacement is aborted if optimized size is larger than or equal to pre_encode_size."""
    item = MediaItem(
        path="/tv/Phineas and Ferb.mkv",
        filename="Phineas and Ferb.mkv",
        library="tv",
        size_bytes=200000000,
        mtime=100.0,
    )
    test_session.add(item)
    await test_session.commit()

    with patch("os.path.exists", return_value=True), \
         patch("os.stat", return_value=MagicMock(st_mtime=100.0, st_size=200000000)), \
         patch("os.path.getsize", return_value=570000000), \
         patch("shutil.move") as mock_move, \
         patch.object(replacement_manager, "check_disk_space", return_value=(True, 50.0)):

        success, msg, backup_path = await replacement_manager.execute_replacement(
            session=test_session,
            media_item=item,
            temp_encoded_path="/work/bloated.mkv",
            replacement_mode="replace_with_backup",
            pre_encode_mtime=100.0,
            pre_encode_size=200000000,
            job_id=99,
        )

        assert not success
        assert "Zero-Bloat Protection" in msg
        assert ">= original" in msg
        assert backup_path is None
        mock_move.assert_not_called()
