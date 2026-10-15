from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field

class EncodingProfileBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=128)
    description: Optional[str] = None

    # Video Settings
    video_codec: str = "hevc"  # hevc, h264, av1, copy
    rate_control_mode: str = "crf"  # crf, target_bitrate, two_pass
    crf: float = Field(21.0, ge=0.0, le=51.0)
    target_bitrate_kbps: int = Field(0, ge=0)
    max_bitrate_kbps: int = Field(0, ge=0)
    bufsize_kbps: int = Field(0, ge=0)
    encoder_preset: str = "medium"
    pixel_format: str = "yuv420p10le"

    # Resolution & Scaling
    resolution_mode: str = "original"  # original, 2160p, 1440p, 1080p, 720p, 480p, custom
    max_width: int = Field(0, ge=0)
    max_height: int = Field(0, ge=0)
    deinterlace: bool = False
    denoise: str = "none"

    # Audio Policies
    audio_policy: str = "copy_all"  # copy_all, transcode_all, keep_surround_add_aac, keep_lossless_add_aac
    preferred_audio_codec: str = "aac"
    audio_bitrate_kbps: int = Field(192, ge=64, le=1024)
    stereo_downmix_compatibility: bool = False
    allow_silent_output: bool = False

    # Subtitle Policies
    subtitle_policy: str = "copy_all"  # copy_all, text_only, extract_sidecar, none

    # HDR & Color Space
    preserve_hdr: bool = True
    hdr_to_sdr_tonemap: bool = False

    # Hardware Acceleration
    hwaccel_type: str = "auto"  # auto, vaapi, qsv, nvenc, cpu_only

    # Distributed Fleet Node Routing
    preferred_node_id: Optional[str] = None  # e.g. "windows-node", "local", "any", or None

    # Target constraints
    target_mb_per_minute: float = 0.0
    min_storage_saving_percent: float = 10.0
    scale_down_percent: int = Field(0, ge=0, le=100, description="Scale down percentage (0-100). 50 = half size of original file.")
    custom_ffmpeg_flags: Optional[Dict[str, Any]] = None

class EncodingProfileCreate(EncodingProfileBase):
    pass

class EncodingProfileUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    video_codec: Optional[str] = None
    rate_control_mode: Optional[str] = None
    crf: Optional[float] = None
    target_bitrate_kbps: Optional[int] = None
    max_bitrate_kbps: Optional[int] = None
    bufsize_kbps: Optional[int] = None
    encoder_preset: Optional[str] = None
    pixel_format: Optional[str] = None
    resolution_mode: Optional[str] = None
    max_width: Optional[int] = None
    max_height: Optional[int] = None
    deinterlace: Optional[bool] = None
    denoise: Optional[str] = None
    audio_policy: Optional[str] = None
    preferred_audio_codec: Optional[str] = None
    audio_bitrate_kbps: Optional[int] = None
    stereo_downmix_compatibility: Optional[bool] = None
    allow_silent_output: Optional[bool] = None
    subtitle_policy: Optional[str] = None
    preserve_hdr: Optional[bool] = None
    hdr_to_sdr_tonemap: Optional[bool] = None
    hwaccel_type: Optional[str] = None
    preferred_node_id: Optional[str] = None
    target_mb_per_minute: Optional[float] = None
    min_storage_saving_percent: Optional[float] = None
    scale_down_percent: Optional[int] = Field(None, ge=0, le=100)
    custom_ffmpeg_flags: Optional[Dict[str, Any]] = None

class EncodingProfileOut(EncodingProfileBase):
    id: int
    is_preset: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
