from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base

class AutomationRule(Base):
    __tablename__ = "automation_rules"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(256), nullable=False)
    
    # Scope definition: 'all', 'library', 'series'
    scope_type = Column(String(32), nullable=False, default="all")
    target_library = Column(String(64), nullable=True)         # 'movies', 'tv', 'anime'
    target_series_name = Column(String(256), nullable=True)    # e.g. 'SpongeBob SquarePants', 'Pokémon'

    # Target optimization profile & worker node
    profile_id = Column(Integer, ForeignKey("encoding_profiles.id"), nullable=False)
    assigned_node_id = Column(String(64), nullable=True)       # 'windows-node', 'local', or None/'any'
    assigned_node_name = Column(String(128), nullable=True)
    replacement_mode = Column(String(32), default="safe_backup") # 'safe_backup', 'in_place'
    priority = Column(Integer, default=5)

    # Automation behavior
    is_active = Column(Boolean, default=True)
    auto_encode_new = Column(Boolean, default=True)            # auto-queue future newly scanned items
    auto_encode_existing = Column(Boolean, default=True)       # queue previous/existing unoptimized items

    # Telemetry and statistics
    last_run_at = Column(DateTime, nullable=True)
    matched_count = Column(Integer, default=0)
    queued_count = Column(Integer, default=0)
    completed_count = Column(Integer, default=0)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    profile = relationship("EncodingProfile", lazy="joined")
