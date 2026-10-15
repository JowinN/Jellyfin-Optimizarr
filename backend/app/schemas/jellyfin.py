from typing import Optional, List, Dict, Any
from pydantic import BaseModel

class JellyfinTestRequest(BaseModel):
    url: str
    api_key: str

class JellyfinTestResponse(BaseModel):
    success: bool
    server_name: Optional[str] = None
    server_version: Optional[str] = None
    operating_system: Optional[str] = None
    error_message: Optional[str] = None

class JellyfinLibraryOut(BaseModel):
    id: str
    name: str
    collection_type: str  # movies, tvshows, anime, etc.
    item_count: int = 0
    path: Optional[str] = None
