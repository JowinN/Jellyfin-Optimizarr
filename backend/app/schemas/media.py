from datetime import datetime
from typing import Optional, List, Any, Dict
from pydantic import BaseModel, Field

class MediaItemOut(BaseModel):
    id: int
    path: str
    filename: str
    library: str
    media_type: str
    title: Optional[str] = None
    series_name: Optional[str] = None
    season_number: Optional[int] = None
    episode_number: Optional[int] = None
    jellyfin_item_id: Optional[str] = None

    size_bytes: int
    duration_seconds: float
    container_format: str
    video_codec: str
    resolution: str
    width: int
    height: int
    fps: float
    bitrate_kbps: int
    bit_depth: int
    is_hdr: bool
    hdr_format: str

    audio_tracks_count: int
    audio_codecs: str
    audio_languages: str
    subtitle_tracks_count: int
    subtitle_languages: str

    mb_per_minute: float
    efficiency_score: float
    estimated_savings_bytes: int
    is_candidate_for_optimization: bool

    optimization_status: str
    last_optimized_at: Optional[datetime] = None
    applied_profile_name: Optional[str] = None
    last_scanned_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class MediaDetailOut(MediaItemOut):
    streams_detail: Optional[Dict[str, Any]] = None
    mtime: float
    fingerprint_sha256: Optional[str] = None

class MediaFilterParams(BaseModel):
    search: Optional[str] = None
    library: Optional[str] = None
    video_codec: Optional[str] = None
    resolution: Optional[str] = None
    optimization_status: Optional[str] = None
    min_mb_per_minute: Optional[float] = None
    is_candidate_only: Optional[bool] = False
    sort_by: str = "mb_per_minute"  # mb_per_minute, size_bytes, duration_seconds, filename
    sort_desc: bool = True
    page: int = 1
    page_size: int = 25

class ScanTriggerRequest(BaseModel):
    libraries: Optional[List[str]] = None  # None = all (movies, tv, anime)
    force_rescan: bool = False

class ScanStatusOut(BaseModel):
    is_scanning: bool
    current_library: Optional[str] = None
    current_file: Optional[str] = None
    scanned_count: int = 0
    total_found: int = 0
    errors_count: int = 0
