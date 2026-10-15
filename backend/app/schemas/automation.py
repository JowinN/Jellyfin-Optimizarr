from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field

class AutomationRuleCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=256)
    scope_type: str = Field("all", pattern="^(all|library|series)$")
    target_library: Optional[str] = None
    target_series_name: Optional[str] = None
    profile_id: int
    assigned_node_id: Optional[str] = None
    assigned_node_name: Optional[str] = None
    replacement_mode: str = Field("safe_backup", pattern="^(safe_backup|in_place)$")
    priority: int = Field(5, ge=1, le=10)
    is_active: bool = True
    auto_encode_new: bool = True
    auto_encode_existing: bool = True

class AutomationRuleUpdate(BaseModel):
    name: Optional[str] = None
    scope_type: Optional[str] = Field(None, pattern="^(all|library|series)$")
    target_library: Optional[str] = None
    target_series_name: Optional[str] = None
    profile_id: Optional[int] = None
    assigned_node_id: Optional[str] = None
    assigned_node_name: Optional[str] = None
    replacement_mode: Optional[str] = Field(None, pattern="^(safe_backup|in_place)$")
    priority: Optional[int] = Field(None, ge=1, le=10)
    is_active: Optional[bool] = None
    auto_encode_new: Optional[bool] = None
    auto_encode_existing: Optional[bool] = None

class AutomationRuleOut(BaseModel):
    id: int
    name: str
    scope_type: str
    target_library: Optional[str] = None
    target_series_name: Optional[str] = None
    profile_id: int
    profile_name: Optional[str] = None
    video_codec: Optional[str] = None
    assigned_node_id: Optional[str] = None
    assigned_node_name: Optional[str] = None
    replacement_mode: str
    priority: int
    is_active: bool
    auto_encode_new: bool
    auto_encode_existing: bool
    last_run_at: Optional[datetime] = None
    matched_count: int = 0
    queued_count: int = 0
    completed_count: int = 0
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class AutomationSeriesOut(BaseModel):
    series_name: str
    total_episodes: int
    unoptimized_episodes: int
    library: str

class AutomationLibraryOut(BaseModel):
    library: str
    total_items: int
    unoptimized_items: int

class AutomationEvaluateResult(BaseModel):
    rule_id: Optional[int] = None
    rule_name: Optional[str] = None
    queued_jobs: int
    matched_items: int
    message: str
