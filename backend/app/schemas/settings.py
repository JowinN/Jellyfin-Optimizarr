from typing import Optional, Dict, Any, List
from pydantic import BaseModel

class SettingsOut(BaseModel):
    jellyfin_url: str
    jellyfin_api_key_set: bool
    server_connected: bool
    server_name: Optional[str] = None
    server_version: Optional[str] = None

    movies_dir: str
    tv_dir: str
    anime_dir: str
    work_dir: str
    backup_dir: str

    min_free_space_gb: float
    max_temp_storage_gb: float
    max_concurrent_encodes: int
    ffmpeg_threads: int
    default_replacement_mode: str
    backup_retention_days: int

    hwaccel_mode: str
    hwaccel_available: bool
    detected_gpu_driver: str
    hwaccel_fallback_cpu: bool

    ntfy_enabled: bool
    ntfy_topic: Optional[str] = None
    telegram_enabled: bool
    smtp_enabled: bool

class SettingsUpdate(BaseModel):
    jellyfin_url: Optional[str] = None
    jellyfin_api_key: Optional[str] = None
    min_free_space_gb: Optional[float] = None
    max_temp_storage_gb: Optional[float] = None
    max_concurrent_encodes: Optional[int] = None
    ffmpeg_threads: Optional[int] = None
    default_replacement_mode: Optional[str] = None
    backup_retention_days: Optional[int] = None
    hwaccel_mode: Optional[str] = None
    hwaccel_fallback_cpu: Optional[bool] = None

    ntfy_enabled: Optional[bool] = None
    ntfy_url: Optional[str] = None
    ntfy_topic: Optional[str] = None
    ntfy_token: Optional[str] = None

    telegram_enabled: Optional[bool] = None
    telegram_bot_token: Optional[str] = None
    telegram_chat_id: Optional[str] = None

    smtp_enabled: Optional[bool] = None
    smtp_host: Optional[str] = None
    smtp_port: Optional[int] = None
    smtp_user: Optional[str] = None
    smtp_password: Optional[str] = None
    smtp_from: Optional[str] = None
    smtp_to: Optional[str] = None
    smtp_use_tls: Optional[bool] = None

class HardwareDiagnosticsOut(BaseModel):
    dri_device_present: bool
    dri_device_path: str
    dri_device_permissions: str
    vaapi_supported: bool
    qsv_supported: bool
    nvenc_supported: bool
    available_video_encoders: List[str]
    available_audio_encoders: List[str]
    ffmpeg_version: str
    recommended_encoder: str
    notes: List[str]
