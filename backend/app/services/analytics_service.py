import os
import csv
import io
import json
from typing import Dict, Any, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_, case
from app.models.media import MediaItem
from app.models.job import EncodingJob
from app.models.rollback import RollbackRecord
from app.config import settings
from app.core.logging import logger

class AnalyticsService:
    """Calculates storage analytics, net vs gross savings, and exports reporting data."""

    async def get_overview(self, session: AsyncSession) -> Dict[str, Any]:
        # 1. Media Items Totals
        stmt_media = select(
            func.count(MediaItem.id),
            func.sum(MediaItem.size_bytes),
        )
        res_media = await session.execute(stmt_media)
        total_files, total_library_bytes = res_media.one()
        total_files = total_files or 0
        total_library_bytes = total_library_bytes or 0

        # 2. Optimized & Pending counts (check both status and last_optimized_at)
        stmt_opt = select(func.count(MediaItem.id)).where(
            or_(
                MediaItem.optimization_status == "optimized",
                MediaItem.last_optimized_at.isnot(None),
            )
        )
        opt_count = (await session.execute(stmt_opt)).scalar_one() or 0

        stmt_pending = select(func.count(MediaItem.id)).where(
            and_(
                MediaItem.optimization_status != "optimized",
                MediaItem.last_optimized_at.is_(None),
            )
        )
        pending_count = (await session.execute(stmt_pending)).scalar_one() or 0

        stmt_failed = select(func.count(MediaItem.id)).where(MediaItem.optimization_status == "failed")
        failed_count = (await session.execute(stmt_failed)).scalar_one() or 0

        # 3. Gross Realized Savings
        # A. Query active completed EncodingJobs
        stmt_job_savings = select(
            func.sum(EncodingJob.savings_bytes),
            func.avg(EncodingJob.savings_percent),
            func.sum(
                func.strftime('%s', EncodingJob.completed_at) - func.strftime('%s', EncodingJob.started_at)
            ),
        ).where(
            and_(
                EncodingJob.status == "completed",
                EncodingJob.is_dry_run == False,
            )
        )
        res_job_savings = await session.execute(stmt_job_savings)
        job_gross_saved, job_avg_pct, total_encoding_secs = res_job_savings.one()
        job_gross_saved = job_gross_saved or 0
        job_avg_pct = job_avg_pct or 0.0
        total_encoding_secs = float(total_encoding_secs or 0.0)

        # B. Query RollbackRecords (permanent audit trail of every replacement, persists even after clearing queue history or purging backups)
        stmt_rollback_savings = select(
            func.sum(
                case(
                    (RollbackRecord.original_size_bytes > RollbackRecord.optimized_size_bytes, 
                     RollbackRecord.original_size_bytes - RollbackRecord.optimized_size_bytes),
                    else_=0
                )
            ),
            func.avg(
                case(
                    (and_(RollbackRecord.original_size_bytes > 0, 
                          RollbackRecord.original_size_bytes > RollbackRecord.optimized_size_bytes),
                     ((RollbackRecord.original_size_bytes - RollbackRecord.optimized_size_bytes) * 100.0 / RollbackRecord.original_size_bytes)),
                    else_=0.0
                )
            ),
        ).where(RollbackRecord.status.in_(["available", "purged"]))
        res_rollback = await session.execute(stmt_rollback_savings)
        rollback_gross_saved, rollback_avg_pct = res_rollback.one()
        rollback_gross_saved = rollback_gross_saved or 0
        rollback_avg_pct = rollback_avg_pct or 0.0

        # Use maximum of job records vs rollback audit trail to guarantee lifetime stats never drop to zero
        gross_saved = max(job_gross_saved, rollback_gross_saved)
        avg_savings_pct = job_avg_pct if job_gross_saved >= rollback_gross_saved and job_gross_saved > 0 else rollback_avg_pct

        # 4. Storage Consumed by Active Backups
        stmt_backups = select(func.sum(RollbackRecord.original_size_bytes)).where(RollbackRecord.status == "available")
        backup_usage = (await session.execute(stmt_backups)).scalar_one() or 0

        # Net Savings (Gross savings minus disk occupied by existing backups; when backups are purged, net = gross)
        net_saved = max(0, gross_saved - backup_usage)

        # Rate of savings: bytes saved per hour of encoding
        saved_per_hour = 0.0
        if total_encoding_secs > 60:
            saved_per_hour = (gross_saved / (total_encoding_secs / 3600.0))

        # 5. Library Breakdown
        libraries_data = []
        for lib in ["movies", "tv", "anime"]:
            stmt_lib = select(
                func.count(MediaItem.id),
                func.sum(MediaItem.size_bytes),
            ).where(MediaItem.library == lib)
            count, lib_bytes = (await session.execute(stmt_lib)).one()
            count = count or 0
            lib_bytes = lib_bytes or 0

            stmt_lib_opt = select(func.count(MediaItem.id)).where(
                and_(
                    MediaItem.library == lib,
                    or_(
                        MediaItem.optimization_status == "optimized",
                        MediaItem.last_optimized_at.isnot(None),
                    )
                )
            )
            lib_opt = (await session.execute(stmt_lib_opt)).scalar_one() or 0

            # Library savings from rollback records
            stmt_lib_saved = select(
                func.sum(
                    case(
                        (RollbackRecord.original_size_bytes > RollbackRecord.optimized_size_bytes,
                         RollbackRecord.original_size_bytes - RollbackRecord.optimized_size_bytes),
                        else_=0
                    )
                )
            ).select_from(RollbackRecord).join(MediaItem, RollbackRecord.media_item_id == MediaItem.id).where(
                and_(
                    MediaItem.library == lib,
                    RollbackRecord.status.in_(["available", "purged"]),
                )
            )
            lib_saved = (await session.execute(stmt_lib_saved)).scalar_one() or 0
            lib_savings_pct = round((lib_saved / (lib_bytes + lib_saved) * 100), 1) if (lib_bytes + lib_saved) > 0 and lib_saved > 0 else 0.0

            libraries_data.append({
                "library": lib,
                "total_files": count,
                "optimized_files": lib_opt,
                "total_source_bytes": lib_bytes + lib_saved,
                "total_current_bytes": lib_bytes,
                "total_saved_bytes": lib_saved,
                "savings_percent": lib_savings_pct,
            })

        # 6. Codec Distribution
        stmt_codecs = select(
            MediaItem.video_codec,
            func.count(MediaItem.id),
            func.sum(MediaItem.size_bytes),
        ).group_by(MediaItem.video_codec)
        codec_rows = (await session.execute(stmt_codecs)).all()
        codec_dist = [
            {"codec": row[0] or "unknown", "count": row[1], "total_size_bytes": row[2] or 0}
            for row in codec_rows
        ]

        return {
            "total_files": total_files,
            "total_library_bytes": total_library_bytes,
            "total_optimized_count": opt_count,
            "pending_optimization_count": pending_count,
            "failed_count": failed_count,
            "realized_savings_bytes": gross_saved,
            "backup_usage_bytes": backup_usage,
            "net_savings_bytes": net_saved,
            "estimated_pending_savings_bytes": int(total_library_bytes * 0.35) if pending_count > 0 else 0,
            "average_compression_ratio": round(avg_savings_pct, 1),
            "total_encoding_seconds": total_encoding_secs,
            "bytes_saved_per_hour": saved_per_hour,
            "libraries": libraries_data,
            "codec_distribution": codec_dist,
        }

    async def export_report_csv(self, session: AsyncSession) -> str:
        stmt = select(MediaItem)
        res = await session.execute(stmt)
        items = res.scalars().all()

        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow([
            "ID", "Filename", "Library", "Resolution", "VideoCodec",
            "SizeBytes", "SizeMB", "DurationSeconds", "MBPerMinute",
            "AudioTracks", "AudioCodecs", "OptimizationStatus", "LastOptimized"
        ])

        for item in items:
            size_mb = round(item.size_bytes / (1024 * 1024), 2)
            writer.writerow([
                item.id,
                item.filename,
                item.library,
                item.resolution,
                item.video_codec,
                item.size_bytes,
                size_mb,
                item.duration_seconds,
                item.mb_per_minute,
                item.audio_tracks_count,
                item.audio_codecs,
                item.optimization_status,
                item.last_optimized_at.isoformat() if item.last_optimized_at else "",
            ])

        return output.getvalue()

analytics_service = AnalyticsService()
