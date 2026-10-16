import os
from pathlib import Path
from typing import List, Optional
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    # Application & Environment
    APP_NAME: str = "Jellyfin Media Optimizer"
    APP_VERSION: str = "1.0.0"
    APP_ENV: str = "production"
    DEBUG: bool = False
    PORT: int = 8080
    HOST: str = "0.0.0.0"
    SECRET_KEY: str = os.getenv("SECRET_KEY", "jmo_production_secret_key_change_me_min_32_chars_long")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days

    # Linux User & Group
    PUID: int = int(os.getenv("PUID", "1000"))
    PGID: int = int(os.getenv("PGID", "1000"))
    TZ: str = os.getenv("TZ", "Asia/Kolkata")

    # Storage Paths
    CONFIG_DIR: str = os.getenv("CONFIG_DIR", "/app/config")
    DATA_DIR: str = os.getenv("DATA_DIR", "/app/data")
    WORK_DIR: str = os.getenv("WORK_DIR", "/work")
    BACKUP_DIR: str = os.getenv("BACKUP_DIR", "/backups")

    # Media Library Paths (Strictly matching Jellyfin mounts)
    MOVIES_DIR: str = os.getenv("MOVIES_DIR", "/movies")
    TV_DIR: str = os.getenv("TV_DIR", "/tv")
    ANIME_DIR: str = os.getenv("ANIME_DIR", "/anime")

    # Allowed Media Directories for Security validation
    @property
    def allowed_media_paths(self) -> List[str]:
        return [
            os.path.abspath(self.MOVIES_DIR),
            os.path.abspath(self.TV_DIR),
            os.path.abspath(self.ANIME_DIR),
            os.path.abspath(self.WORK_DIR),
            os.path.abspath(self.BACKUP_DIR),
        ]

    # Database Path
    @property
    def DATABASE_URL(self) -> str:
        db_path = os.path.join(self.DATA_DIR, "optimizer.db")
        return f"sqlite+aiosqlite:///{db_path}"

    @property
    def SYNC_DATABASE_URL(self) -> str:
        db_path = os.path.join(self.DATA_DIR, "optimizer.db")
        return f"sqlite:///{db_path}"

    # Jellyfin Connection
    JELLYFIN_URL: str = os.getenv("JELLYFIN_URL", "http://jellyfin:8096")
    JELLYFIN_API_KEY: str = os.getenv("JELLYFIN_API_KEY", "")

    # Storage Pre-flight Constraints (in GB)
    MIN_FREE_SPACE_GB: float = float(os.getenv("MIN_FREE_SPACE_GB", "15.0"))
    MAX_TEMP_STORAGE_GB: float = float(os.getenv("MAX_TEMP_STORAGE_GB", "100.0"))

    # Worker Settings
    MAX_CONCURRENT_ENCODES: int = int(os.getenv("MAX_CONCURRENT_ENCODES", "1"))
    FFMPEG_THREADS: int = int(os.getenv("FFMPEG_THREADS", "0"))
    DEFAULT_REPLACEMENT_MODE: str = os.getenv("DEFAULT_REPLACEMENT_MODE", "in_place")
    BACKUP_RETENTION_DAYS: int = int(os.getenv("BACKUP_RETENTION_DAYS", "14"))

    # Hardware Acceleration
    HWACCEL_MODE: str = os.getenv("HWACCEL_MODE", "auto")  # auto, vaapi, qsv, nvenc, cpu
    DRI_DEVICE: str = os.getenv("DRI_DEVICE", "/dev/dri/renderD128")
    HWACCEL_FALLBACK_CPU: bool = os.getenv("HWACCEL_FALLBACK_CPU", "true").lower() in ("true", "1", "yes")

    # Notifications
    NTFY_ENABLED: bool = os.getenv("NTFY_ENABLED", "false").lower() in ("true", "1", "yes")
    NTFY_URL: str = os.getenv("NTFY_URL", "https://ntfy.sh")
    NTFY_TOPIC: str = os.getenv("NTFY_TOPIC", "")
    NTFY_TOKEN: str = os.getenv("NTFY_TOKEN", "")

    TELEGRAM_ENABLED: bool = os.getenv("TELEGRAM_ENABLED", "false").lower() in ("true", "1", "yes")
    TELEGRAM_BOT_TOKEN: str = os.getenv("TELEGRAM_BOT_TOKEN", "")
    TELEGRAM_CHAT_ID: str = os.getenv("TELEGRAM_CHAT_ID", "")

    SMTP_ENABLED: bool = os.getenv("SMTP_ENABLED", "false").lower() in ("true", "1", "yes")
    SMTP_HOST: str = os.getenv("SMTP_HOST", "")
    SMTP_PORT: int = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USER: str = os.getenv("SMTP_USER", "")
    SMTP_PASSWORD: str = os.getenv("SMTP_PASSWORD", "")
    SMTP_FROM: str = os.getenv("SMTP_FROM", "")
    SMTP_TO: str = os.getenv("SMTP_TO", "")
    SMTP_USE_TLS: bool = os.getenv("SMTP_USE_TLS", "true").lower() in ("true", "1", "yes")

    model_config = SettingsConfigDict(
        case_sensitive=True,
        env_file=".env",
        extra="allow",
    )

settings = Settings()
