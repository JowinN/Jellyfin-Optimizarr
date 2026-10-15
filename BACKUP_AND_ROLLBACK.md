# Reversible Media Management & Rollback Guide

Data safety is the fundamental design principle of Jellyfin Media Optimizer. Your media library is irreplaceable, and this document details the safety architecture that guarantees zero data loss.

---

## 1. Transactional Safe Replacement Architecture

When an encoding job runs, the original file is **never modified in-place**. The lifecycle strictly follows an 8-step transaction:

```
[Source File] ──► Pre-flight Checks (Lock, Disk Space, Fingerprint)
                         │
                         ▼
[Work Directory] ──► Encode to /work/encode_{id}_file.mkv
                         │
                         ▼
[Validation] ────► 6-Point Integrity Check (Duration, Audio, Subtitles)
                         │
                   Passed?
                   ├── NO  ──► Abort. Delete temp. Original untouched.
                   └── YES
                         ▼
[Fingerprint] ───► Verify source mtime/size unchanged during encode
                         │
                   Changed?
                   ├── YES ──► Abort. Source was modified. Original untouched.
                   └── NO
                         ▼
[Backup Creation]► Move original to /backups/<library>/file.<timestamp>.bak
                         │
                         ▼
[Atomic Install] ─► Move /work/encode.mkv to /library/file.mkv
                         │
                         ▼
[Jellyfin Sync] ──► Refresh Jellyfin Item via API
```

---

## 2. Replacement Modes

### A. Replace with Backup (Default & Recommended)
- Replaces the original media file in the active library **only** after all 6 validation checks pass.
- Moves the original file to `/data/media/optimizer-backups/<library>/`.
- Creates a `RollbackRecord` in the database with timestamps and file sizes.
- Provides immediate one-click restoration.

### B. Create Optimized Copy
- Leaves the original file completely untouched in place.
- Writes the compressed output alongside the original as `<filename>.optimized.<ext>`.
- Allows manual side-by-side video player comparison before deciding to keep it.

### C. Manual Approval
- Encodes the media to `/work/approved/`.
- Leaves the original file untouched and marks the job status as `awaiting_approval`.
- File is replaced only after you inspect the telemetry and click **Approve** in the web dashboard.

---

## 3. How Rollback Works

To revert an optimized file:

1. Open the dashboard and navigate to the **Rollback & Backups** page.
2. Locate the media item in the audit table.
3. Click **Restore**.
4. The system executes:
   - Acquires a file lock on the target media file.
   - Verifies the backup file exists in `/backups`.
   - Moves the backup file back into your media directory.
   - Updates the database item to `unoptimized`.
   - Dispatches a library refresh signal to Jellyfin over its API.

---

## 4. Backup Retention & Storage Reclaim

Because backups consume physical disk space, the dashboard clearly distinguishes between:
- **Gross Savings**: Storage saved by compression.
- **Backup Usage**: Temporary space occupied by safety copies.
- **Net Reclaimed**: Actual physical free space gained on your storage drives.

### Purging Backups
Once you have validated that an optimized file plays smoothly across your Jellyfin client devices:
1. Navigate to **Rollback & Backups**.
2. Click the trash icon next to any backup record to purge the `.bak` file and permanently reclaim disk space.
3. Configurable retention policies (`BACKUP_RETENTION_DAYS`) automatically clean backups older than the configured threshold (default: 14 days).
