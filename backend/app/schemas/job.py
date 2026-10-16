from datetime import datetime
from typing import Optional, List, Any, Dict
from pydantic import BaseModel, Field

class JobCreate(BaseModel):
    media_item_id: int
    profile_id: int
    replacement_mode: str = "in_place"  # in_place, safe_backup, replace_with_backup, optimized_copy, manual_approval
    priority: int = 10
    is_dry_run: bool = False
    assigned_node_id: Optional[str] = None

class JobBatchCreate(BaseModel):
    media_item_ids: List[int] = Field(..., min_length=1)
    profile_id: int
    replacement_mode: str = "in_place"
    priority: int = 10
    is_dry_run: bool = False
    assigned_node_id: Optional[str] = None

class JobLogOut(BaseModel):
    id: int
    timestamp: datetime
    level: str
    message: str

    class Config:
        from_attributes = True

class JobOut(BaseModel):
    id: int
    media_item_id: int
    profile_id: int
    status: str
    stage: str
    priority: int
    is_dry_run: bool

    progress_percent: float
    current_fps: float
    current_speed: float
    eta_seconds: int
    out_time_seconds: float
    encoder_used: str
    assigned_node_id: Optional[str] = "local"
    assigned_node_name: Optional[str] = "Ubuntu Server"

    source_path: str
    temp_output_path: Optional[str] = None
    backup_path: Optional[str] = None
    replacement_mode: str

    source_size_bytes: int
    output_size_bytes: int
    savings_bytes: int
    savings_percent: float

    error_message: Optional[str] = None
    retry_count: int
    max_retries: int

    created_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class JobDetailOut(JobOut):
    ffmpeg_command_args: Optional[List[str]] = None
    logs: List[JobLogOut] = []

class DryRunResultOut(BaseModel):
    media_item_id: int
    source_path: str
    source_size_bytes: int
    estimated_output_size_bytes: int
    estimated_savings_bytes: int
    estimated_savings_percent: float
    selected_profile_name: str
    hardware_accel: str
    proposed_ffmpeg_args: List[str]
    required_work_space_bytes: int
    potential_risks: List[str] = []
