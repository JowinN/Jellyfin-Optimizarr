from datetime import datetime
from sqlalchemy import Column, Integer, BigInteger, String, Float, Boolean, DateTime, Text, ForeignKey, JSON
from sqlalchemy.orm import relationship
from app.database import Base

class MediaItem(Base):
    __tablename__ = "media_items"

    id = Column(Integer, primary_key=True, index=True)
    path = Column(String(1024), unique=True, index=True, nullable=False)
    filename = Column(String(512), index=True, nullable=False)
    library = Column(String(64), index=True, nullable=False)  # movies, tv, anime
    media_type = Column(String(32), default="unknown")  # movie, episode

    # Organization metadata
    title = Column(String(256), nullable=True)
    series_name = Column(String(256), nullable=True, index=True)
    season_number = Column(Integer, nullable=True)
    episode_number = Column(Integer, nullable=True)
    jellyfin_item_id = Column(String(128), nullable=True, index=True)

    # File and Technical attributes
    size_bytes = Column(BigInteger, nullable=False, default=0)
    duration_seconds = Column(Float, nullable=False, default=0.0)
    container_format = Column(String(64), default="")
    video_codec = Column(String(64), default="")
    resolution = Column(String(32), default="")  # e.g., 1080p, 4K, 720p
    width = Column(Integer, default=0)
    height = Column(Integer, default=0)
    fps = Column(Float, default=0.0)
    bitrate_kbps = Column(Integer, default=0)
    bit_depth = Column(Integer, default=8)
    pixel_format = Column(String(32), default="")
    is_hdr = Column(Boolean, default=False)
    hdr_format = Column(String(64), default="")

    # Audio & Subtitle summary
    audio_tracks_count = Column(Integer, default=0)
    audio_codecs = Column(String(256), default="")
    audio_languages = Column(String(256), default="")
    subtitle_tracks_count = Column(Integer, default=0)
    subtitle_languages = Column(String(256), default="")

    # Storage Efficiency & Recommendations
    mb_per_minute = Column(Float, default=0.0)
    efficiency_score = Column(Float, default=0.0)  # 0 to 100 rating (100 = very efficient)
    estimated_savings_bytes = Column(BigInteger, default=0)
    is_candidate_for_optimization = Column(Boolean, default=True)

    # Fingerprinting & Verification
    fingerprint_sha256 = Column(String(64), nullable=True)
    mtime = Column(Float, nullable=False, default=0.0)
    last_scanned_at = Column(DateTime, default=datetime.utcnow)

    # Optimization State
    optimization_status = Column(String(32), default="unoptimized", index=True)  # unoptimized, queued, processing, optimized, skipped, failed
    last_optimized_at = Column(DateTime, nullable=True)
    applied_profile_id = Column(Integer, ForeignKey("encoding_profiles.id"), nullable=True)
    applied_profile_name = Column(String(128), nullable=True)

    # Full technical details from FFprobe
    streams_detail = Column(JSON, nullable=True)

    # Relationships
    jobs = relationship("EncodingJob", back_populates="media_item", cascade="all, delete-orphan")
    rollback_records = relationship("RollbackRecord", back_populates="media_item", cascade="all, delete-orphan")
