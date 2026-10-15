import os
import psutil
from typing import Dict, Any, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models.settings import AppSetting
from app.models.user import User
from app.config import settings
from app.schemas.settings import SettingsOut, SettingsUpdate
from app.schemas.jellyfin import JellyfinTestRequest, JellyfinTestResponse, JellyfinLibraryOut
from app.services.jellyfin_client import jellyfin_client
from app.services.hardware_detector import hardware_detector
from app.api.deps import get_current_user

router = APIRouter(prefix="/settings", tags=["Settings"])

@router.get("", response_model=SettingsOut)
async def get_settings(
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retrieves current application settings, Jellyfin connection status, and directories."""
    conn_test = await jellyfin_client.test_connection()
    hw_info = await hardware_detector.detect_capabilities()

    return SettingsOut(
        jellyfin_url=settings.JELLYFIN_URL,
        jellyfin_api_key_set=bool(settings.JELLYFIN_API_KEY),
        server_connected=conn_test.get("success", False),
        server_name=conn_test.get("server_name"),
        server_version=conn_test.get("server_version"),
        movies_dir=settings.MOVIES_DIR,
        tv_dir=settings.TV_DIR,
        anime_dir=settings.ANIME_DIR,
        work_dir=settings.WORK_DIR,
        backup_dir=settings.BACKUP_DIR,
        min_free_space_gb=settings.MIN_FREE_SPACE_GB,
        max_temp_storage_gb=settings.MAX_TEMP_STORAGE_GB,
        max_concurrent_encodes=settings.MAX_CONCURRENT_ENCODES,
        ffmpeg_threads=settings.FFMPEG_THREADS,
        default_replacement_mode=settings.DEFAULT_REPLACEMENT_MODE,
        backup_retention_days=settings.BACKUP_RETENTION_DAYS,
        hwaccel_mode=settings.HWACCEL_MODE,
        hwaccel_available=hw_info.get("dri_device_present", False),
        detected_gpu_driver=hw_info.get("recommended_encoder", "cpu"),
        hwaccel_fallback_cpu=settings.HWACCEL_FALLBACK_CPU,
        ntfy_enabled=settings.NTFY_ENABLED,
        ntfy_topic=settings.NTFY_TOPIC,
        telegram_enabled=settings.TELEGRAM_ENABLED,
        smtp_enabled=settings.SMTP_ENABLED,
    )

@router.put("", response_model=SettingsOut)
async def update_settings(
    req: SettingsUpdate,
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Updates application settings in runtime and persists in database."""
    update_data = req.model_dump(exclude_unset=True)

    for k, v in update_data.items():
        if v is not None:
            # Update in-memory settings
            attr_name = k.upper()
            if hasattr(settings, attr_name):
                setattr(settings, attr_name, v)

            # Persist key in database
            stmt = select(AppSetting).where(AppSetting.key == k)
            record = (await session.execute(stmt)).scalar_one_or_none()
            if not record:
                record = AppSetting(key=k, value=str(v))
                session.add(record)
            else:
                record.value = str(v)

    await session.commit()
    return await get_settings(session=session, current_user=current_user)

@router.post("/jellyfin/test", response_model=JellyfinTestResponse)
async def test_jellyfin_connection(
    req: JellyfinTestRequest,
    current_user: User = Depends(get_current_user),
):
    """Tests connection and credentials against a specified Jellyfin server URL."""
    result = await jellyfin_client.test_connection(url=req.url, api_key=req.api_key)
    return JellyfinTestResponse(**result)

@router.get("/jellyfin/libraries", response_model=List[JellyfinLibraryOut])
async def get_jellyfin_libraries(current_user: User = Depends(get_current_user)):
    """Queries virtual folders and libraries configured in the Jellyfin server."""
    libs = await jellyfin_client.get_libraries()
    return [JellyfinLibraryOut(**l) for l in libs]

@router.get("/diagnostics")
async def get_diagnostic_bundle(current_user: User = Depends(get_current_user)):
    """Exports a diagnostic bundle with sensitive credentials and tokens safely redacted."""
    hw = await hardware_detector.detect_capabilities()
    disk_work = psutil.disk_usage(settings.WORK_DIR)
    disk_data = psutil.disk_usage(settings.DATA_DIR)

    return {
        "version": settings.APP_VERSION,
        "environment": settings.APP_ENV,
        "puid": settings.PUID,
        "pgid": settings.PGID,
        "tz": settings.TZ,
        "jellyfin_url": settings.JELLYFIN_URL,
        "jellyfin_api_key_configured": bool(settings.JELLYFIN_API_KEY),
        "hardware_acceleration": hw,
        "storage": {
            "work_dir": settings.WORK_DIR,
            "work_dir_free_gb": round(disk_work.free / (1024 ** 3), 2),
            "data_dir": settings.DATA_DIR,
            "data_dir_free_gb": round(disk_data.free / (1024 ** 3), 2),
        },
        "system": {
            "cpu_cores": psutil.cpu_count(),
            "cpu_percent": psutil.cpu_percent(),
            "memory_percent": psutil.virtual_memory().percent,
        }
    }
