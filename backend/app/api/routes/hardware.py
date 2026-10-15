from fastapi import APIRouter, Depends
from app.models.user import User
from app.schemas.settings import HardwareDiagnosticsOut
from app.services.hardware_detector import hardware_detector
from app.api.deps import get_current_user

router = APIRouter(prefix="/hardware", tags=["Hardware Acceleration"])

@router.get("/diagnostics", response_model=HardwareDiagnosticsOut)
async def get_hardware_diagnostics(current_user: User = Depends(get_current_user)):
    """Inspects container environment for /dev/dri, VAAPI, Intel Quick Sync, and NVENC."""
    data = await hardware_detector.detect_capabilities(force_refresh=True)
    return HardwareDiagnosticsOut(**data)
