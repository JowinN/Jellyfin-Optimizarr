from fastapi import APIRouter, Depends, Response
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models.user import User
from app.schemas.analytics import AnalyticsSummaryOut
from app.services.analytics_service import analytics_service
from app.api.deps import get_current_user

router = APIRouter(prefix="/analytics", tags=["Analytics"])

@router.get("/overview", response_model=AnalyticsSummaryOut)
async def get_analytics_overview(
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Calculates storage analytics, net vs gross savings, and library statistics."""
    data = await analytics_service.get_overview(session)
    return AnalyticsSummaryOut(**data)

@router.get("/export/csv")
async def export_csv(
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Generates and downloads a CSV export of media library efficiency and optimization history."""
    csv_content = await analytics_service.export_report_csv(session)
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=jellyfin_optimizer_report.csv"},
    )
