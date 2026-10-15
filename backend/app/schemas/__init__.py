from app.schemas.auth import (
    LoginRequest,
    TokenResponse,
    UserOut,
    SetupRequest,
    ChangePasswordRequest,
)
from app.schemas.media import (
    MediaItemOut,
    MediaDetailOut,
    MediaFilterParams,
    ScanTriggerRequest,
    ScanStatusOut,
)
from app.schemas.profile import (
    EncodingProfileCreate,
    EncodingProfileUpdate,
    EncodingProfileOut,
)
from app.schemas.job import (
    JobCreate,
    JobBatchCreate,
    JobOut,
    JobDetailOut,
    DryRunResultOut,
)
from app.schemas.jellyfin import (
    JellyfinTestRequest,
    JellyfinTestResponse,
    JellyfinLibraryOut,
)
from app.schemas.rollback import (
    RollbackRecordOut,
    RollbackRestoreRequest,
)
from app.schemas.analytics import (
    AnalyticsSummaryOut,
    LibraryAnalyticsOut,
)
from app.schemas.settings import (
    SettingsOut,
    SettingsUpdate,
    HardwareDiagnosticsOut,
)

__all__ = [
    "LoginRequest",
    "TokenResponse",
    "UserOut",
    "SetupRequest",
    "ChangePasswordRequest",
    "MediaItemOut",
    "MediaDetailOut",
    "MediaFilterParams",
    "ScanTriggerRequest",
    "ScanStatusOut",
    "EncodingProfileCreate",
    "EncodingProfileUpdate",
    "EncodingProfileOut",
    "JobCreate",
    "JobBatchCreate",
    "JobOut",
    "JobDetailOut",
    "DryRunResultOut",
    "JellyfinTestRequest",
    "JellyfinTestResponse",
    "JellyfinLibraryOut",
    "RollbackRecordOut",
    "RollbackRestoreRequest",
    "AnalyticsSummaryOut",
    "LibraryAnalyticsOut",
    "SettingsOut",
    "SettingsUpdate",
    "HardwareDiagnosticsOut",
]
