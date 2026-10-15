from datetime import datetime
from typing import Optional
from pydantic import BaseModel

class RollbackRecordOut(BaseModel):
    id: int
    job_id: Optional[int] = None
    media_item_id: int
    original_path: str
    backup_path: str
    optimized_path: str
    original_size_bytes: int
    optimized_size_bytes: int
    status: str
    created_at: datetime
    restored_at: Optional[datetime] = None
    notes: Optional[str] = None

    class Config:
        from_attributes = True

class RollbackRestoreRequest(BaseModel):
    record_id: int
    confirm: bool = True
