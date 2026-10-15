import asyncio
from app.database import async_engine, Base, AsyncSessionLocal
from app.services.profile_manager import profile_manager
from app.core.logging import logger

async def initialize():
    logger.info("Initializing database tables...")
    async with async_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as session:
        logger.info("Seeding default encoding presets...")
        await profile_manager.seed_presets(session)

    await async_engine.dispose()
    logger.info("Database initialization completed successfully.")

if __name__ == "__main__":
    asyncio.run(initialize())
