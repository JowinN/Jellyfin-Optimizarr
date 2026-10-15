from typing import List, Dict, Any, Optional
from pydantic import BaseModel

class LibraryAnalyticsOut(BaseModel):
    library: str
    total_files: int
    optimized_files: int
    total_source_bytes: int
    total_current_bytes: int
    total_saved_bytes: int
    savings_percent: float

class CodecDistributionItem(BaseModel):
    codec: str
    count: int
    total_size_bytes: int

class AnalyticsSummaryOut(BaseModel):
    total_files: int
    total_library_bytes: int
    total_optimized_count: int
    pending_optimization_count: int
    failed_count: int

    # Savings Distinctions
    realized_savings_bytes: int  # Gross storage saved by re-encodes
    backup_usage_bytes: int      # Space currently consumed by backups
    net_savings_bytes: int       # Realized savings minus active backups
    estimated_pending_savings_bytes: int

    average_compression_ratio: float
    total_encoding_seconds: float
    bytes_saved_per_hour: float

    libraries: List[LibraryAnalyticsOut]
    codec_distribution: List[CodecDistributionItem]
    recent_savings_timeline: List[Dict[str, Any]] = []
