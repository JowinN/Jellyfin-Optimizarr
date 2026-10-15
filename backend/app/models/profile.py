from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Text, JSON
from app.database import Base

class EncodingProfile(Base):
    __tablename__ = "encoding_profiles"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(128), unique=True, index=True, nullable=False)
    description = Column(Text, nullable=True)
    is_preset = Column(Boolean, default=False)

    # Video Settings
    video_codec = Column(String(32), default="hevc", nullable=False)  # hevc, h264, av1, copy
    rate_control_mode = Column(String(32), default="crf")  # crf, target_bitrate, two_pass
    crf = Column(Float, default=21.0)
    target_bitrate_kbps = Column(Integer, default=0)
    max_bitrate_kbps = Column(Integer, default=0)
    bufsize_kbps = Column(Integer, default=0)
    encoder_preset = Column(String(32), default="medium")  # ultrafast -> veryslow
    pixel_format = Column(String(32), default="yuv420p10le")  # yuv420p, yuv420p10le, auto

    # Resolution & Scaling
    resolution_mode = Column(String(32), default="original")  # original, 2160p, 1440p, 1080p, 720p, 480p, custom
    max_width = Column(Integer, default=0)
    max_height = Column(Integer, default=0)
    deinterlace = Column(Boolean, default=False)
    denoise = Column(String(32), default="none")  # none, light, hqdn3d

    # Audio Policies (Preserve audio is mandatory by default)
    audio_policy = Column(String(64), default="copy_all")  # copy_all, transcode_all, keep_surround_add_aac, keep_lossless_add_aac
    preferred_audio_codec = Column(String(32), default="aac")  # copy, aac, ac3, eac3, opus, flac
    audio_bitrate_kbps = Column(Integer, default=192)
    stereo_downmix_compatibility = Column(Boolean, default=False)
    allow_silent_output = Column(Boolean, default=False)  # Strictly False by default

    # Subtitle Policies
    subtitle_policy = Column(String(32), default="copy_all")  # copy_all, text_only, extract_sidecar, none

    # HDR & Color Space
    preserve_hdr = Column(Boolean, default=True)
    hdr_to_sdr_tonemap = Column(Boolean, default=False)

    # Hardware Acceleration Configuration
    hwaccel_type = Column(String(32), default="auto")  # auto, vaapi, qsv, nvenc, cpu_only

    # Distributed Fleet Node Routing
    preferred_node_id = Column(String(64), nullable=True, default=None)  # e.g. "windows-node", "local", "any", or None

    # Target constraints
    target_mb_per_minute = Column(Float, default=0.0)
    min_storage_saving_percent = Column(Float, default=10.0)
    scale_down_percent = Column(Integer, default=0)  # 0 to 100 percentage. If 50, output is half size of original file.

    # Additional custom parameters safely checked
    custom_ffmpeg_flags = Column(JSON, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
