from datetime import datetime
from sqlalchemy import Column, Integer, BigInteger, String, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.database import Base

class RollbackRecord(Base):
    __tablename__ = "rollback_records"

    id = Column(Integer, primary_key=True, index=True)
    job_id = Column(Integer, ForeignKey("encoding_jobs.id"), nullable=True, unique=True)
    media_item_id = Column(Integer, ForeignKey("media_items.id"), nullable=False, index=True)

    original_path = Column(String(1024), nullable=False)
    backup_path = Column(String(1024), nullable=False)
    optimized_path = Column(String(1024), nullable=False)

    original_size_bytes = Column(BigInteger, nullable=False, default=0)
    optimized_size_bytes = Column(BigInteger, nullable=False, default=0)
    original_checksum = Column(String(64), nullable=True)

    # Status: available, restored, purged
    status = Column(String(32), default="available", index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    restored_at = Column(DateTime, nullable=True)
    notes = Column(Text, nullable=True)

    # Relationships
    job = relationship("EncodingJob", back_populates="rollback_record")
    media_item = relationship("MediaItem", back_populates="rollback_records")
