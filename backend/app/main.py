import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from app.config import settings
from app.database import async_engine, Base, AsyncSessionLocal
from app.services.profile_manager import profile_manager
from app.services.queue_worker import queue_worker
from app.services.automation_service import automation_service
from app.core.logging import logger

# Import API routers
from app.api.routes import (
    auth,
    media,
    profiles,
    queue,
    recommendations,
    rollback,
    hardware,
    analytics,
    settings as settings_route,
    events,
    nodes,
    automation,
)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Ensure database tables are created and default presets seeded
    logger.info("Initializing database schema...")
    async with async_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Safe column migration using separate connection
    try:
        async with async_engine.connect() as conn:
            await conn.execute(text("ALTER TABLE encoding_profiles ADD COLUMN scale_down_percent INTEGER DEFAULT 0"))
            await conn.commit()
            logger.info("Migrated encoding_profiles schema: added scale_down_percent column.")
    except Exception:
        pass  # Column already exists

    async with AsyncSessionLocal() as session:
        await profile_manager.seed_presets(session)

    # Start queue background worker and automation scheduler
    queue_worker.start()
    automation_service.start()

    yield

    # Shutdown: Stop worker gracefully
    logger.info("Shutting down Automation Service & Queue Worker...")
    automation_service.stop()
    await queue_worker.cancel_current_job()
    queue_worker.stop()
    await async_engine.dispose()
    logger.info("Shutdown complete.")

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

# Enable CORS for local Vite development and Docker integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API Routers under /api
app.include_router(auth.router, prefix="/api")
app.include_router(media.router, prefix="/api")
app.include_router(profiles.router, prefix="/api")
app.include_router(queue.router, prefix="/api")
app.include_router(recommendations.router, prefix="/api")
app.include_router(rollback.router, prefix="/api")
app.include_router(hardware.router, prefix="/api")
app.include_router(analytics.router, prefix="/api")
app.include_router(settings_route.router, prefix="/api")
app.include_router(events.router, prefix="/api")
app.include_router(nodes.router, prefix="/api")
app.include_router(automation.router, prefix="/api")

@app.get("/api/health", tags=["Health"])
async def health_check():
    """Liveness probe for Docker container health check."""
    return {
        "status": "healthy",
        "service": settings.APP_NAME,
        "version": settings.APP_VERSION,
    }

@app.get("/api/ready", tags=["Health"])
async def readiness_check():
    """Readiness probe checking database connectivity."""
    try:
        async with async_engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        return {"status": "ready", "database": "connected"}
    except Exception as e:
        return JSONResponse(status_code=503, content={"status": "not_ready", "error": str(e)})

# Mount built frontend assets if present (production container path or local dev)
frontend_dist_paths = [
    "/app/frontend_dist",
    os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "dist")),
]

static_dist = None
for p in frontend_dist_paths:
    if os.path.exists(p) and os.path.isdir(p):
        static_dist = p
        break

if static_dist:
    logger.info(f"Serving frontend static assets from: {static_dist}")
    app.mount("/assets", StaticFiles(directory=os.path.join(static_dist, "assets")), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_spa_frontend(request: Request, full_path: str):
        # Allow /api routes to be handled by FastAPI
        if full_path.startswith("api/"):
            return JSONResponse(status_code=404, content={"detail": "Not found"})

        file_path = os.path.join(static_dist, full_path)
        if os.path.exists(file_path) and os.path.isfile(file_path):
            return FileResponse(file_path)

        index_file = os.path.join(static_dist, "index.html")
        if os.path.exists(index_file):
            return FileResponse(index_file)

        return JSONResponse(status_code=404, content={"detail": "Frontend assets not found"})
else:
    @app.get("/", include_in_schema=False)
    async def index_root():
        return {
            "message": "Jellyfin Media Optimizer API is running. Frontend build not mounted.",
            "docs": "/api/docs",
            "health": "/api/health",
        }
