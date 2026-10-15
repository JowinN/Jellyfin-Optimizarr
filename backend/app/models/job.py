from datetime import datetime
from sqlalchemy import Column, Integer, BigInteger, String, Float, Boolean, DateTime, Text, ForeignKey, JSON
from sqlalchemy.orm import relationship
from app.database import Base

class EncodingJob(Base):
    __tablename__ = "encoding_jobs"

    id = Column(Integer, primary_key=True, index=True)
    media_item_id = Column(Integer, ForeignKey("media_items.id"), nullable=False, index=True)
    profile_id = Column(Integer, ForeignKey("encoding_profiles.id"), nullable=False, index=True)

    # Job lifecycle & Queue
    status = Column(String(32), default="pending", index=True)  # pending, running, paused, validating, replacing, completed, failed, cancelled
    stage = Column(String(64), default="queued")  # queued, probing, encoding, validating, replacing, finished
    priority = Column(Integer, default=10, index=True)  # higher executes sooner
    is_dry_run = Column(Boolean, default=False)

    # Execution tracking & Metrics
    progress_percent = Column(Float, default=0.0)
    current_fps = Column(Float, default=0.0)
    current_speed = Column(Float, default=0.0)  # e.g. 1.75x
    eta_seconds = Column(Integer, default=0)
    out_time_seconds = Column(Float, default=0.0)
    encoder_used = Column(String(64), default="")
    process_pid = Column(Integer, nullable=True)
    assigned_node_id = Column(String(64), nullable=True, default="local")
    assigned_node_name = Column(String(128), nullable=True, default="Ubuntu Server")

    # File & Path handling
    source_path = Column(String(1024), nullable=False)
    temp_output_path = Column(String(1024), nullable=True)
    backup_path = Column(String(1024), nullable=True)
    replacement_mode = Column(String(64), default="replace_with_backup")

    # Size and Savings
    source_size_bytes = Column(BigInteger, default=0)
    output_size_bytes = Column(BigInteger, default=0)
    savings_bytes = Column(BigInteger, default=0)
    savings_percent = Column(Float, default=0.0)

    # Diagnostics & Logs
    ffmpeg_command_args = Column(JSON, nullable=True)
    error_message = Column(Text, nullable=True)
    retry_count = Column(Integer, default=0)
    max_retries = Column(Integer, default=2)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)

    # Relationships
    media_item = relationship("MediaItem", back_populates="jobs")
    profile = relationship("EncodingProfile")
    logs = relationship("JobLog", back_populates="job", cascade="all, delete-orphan")
    rollback_record = relationship("RollbackRecord", back_populates="job", uselist=False)

class JobLog(Base):
    __tablename__ = "job_logs"

    id = Column(Integer, primary_key=True, index=True)
    job_id = Column(Integer, ForeignKey("encoding_jobs.id"), nullable=False, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow)
    level = Column(String(16), default="INFO")
    message = Column(Text, nullable=False)

    job = relationship("EncodingJob", back_populates="logs")
