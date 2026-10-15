# Distributed Transcoding Worker for Jellyfin Media Optimizer

This worker allows your Windows PC (Intel Core i5-4440S + NVIDIA Quadro K620) to act as a high-performance compute node for the Jellyfin Media Optimizer server (`192.168.1.7`).

---

## Why use this worker?

| System | CPU | GPU / HW Accel | Encoding Speed |
| :--- | :--- | :--- | :--- |
| **Ubuntu Server** (`192.168.1.7`) | 2-core mobile i5-6300U | Intel HD 520 (VAAPI H.264 only) | ~1 fps (0.05x speed) |
| **Windows PC** (This Machine) | 4-core desktop i5-4440S (AVX2) | Quadro K620 NVENC (`h264_nvenc`) | **~130 - 165 fps (~5x - 7x speed)** |

Transcoding on this Windows PC is **up to 100x faster** than the Ubuntu server when using NVIDIA NVENC hardware acceleration!

---

## How it works

1. **Auto-Registration & Heartbeat**: The worker registers with `http://192.168.1.7:8097/api/nodes/register`. It sends heartbeats every 5 seconds to report telemetry and listen for real-time cancellation commands.
2. **Job Leasing**: The worker polls for pending optimization queue jobs assigned to this node.
3. **High-Speed LAN Download**: The worker streams the source media file from the server at full network speed (~90-110 MB/s over Gigabit LAN).
4. **Local Hardware Encoding**: Local `ffmpeg.exe` encodes the video:
   - GPU Mode: Fast NVIDIA NVENC (`h264_nvenc`) on the Quadro K620.
   - CPU Mode: AVX2-optimized `libx265 -preset faster`.
   - Audio: Preserves surround tracks untouched, or transcodes to Opus for YouTube profile.
   - Subtitles, chapters, and metadata are preserved untouched.
5. **Real-Time Telemetry**: Real-time progress, FPS, speed multiplier, and ETA are transmitted to the server and displayed on the web dashboard via Server-Sent Events (SSE).
6. **Instant Cancellation**: If cancelled in the Web UI, the worker immediately terminates the local FFmpeg process tree (<1 second), cleans up scratch files, and resumes idle polling.
7. **Upload & 6-Point Verification**: Once encoded, the file is uploaded to the server, where the server's 6-point validator verifies audio stream counts, duration, and container integrity before performing an atomic replacement with a backup.

---

## How to Run

### Option 1: Run as a Windows Background System Service (Recommended)
To run the worker automatically in the background 24/7 without needing to open any window:
1. Double-click [`install_service.bat`](file:///c:/Users/Jowin/Desktop/Jellyfin%20Optimizer/worker/install_service.bat).
   - Automatically requests Administrator elevation (UAC).
   - Registers a Windows Scheduled Task (`JellyfinMediaOptimizerWorker`) running as `NT AUTHORITY\SYSTEM`.
   - **Starts at PC boot** before ANY user logs in (sitting at the lock screen).
   - **Auto-starts when ANY user logs in** to the PC.
   - **Single-instance protection** ensures no duplicate instances or GPU collisions.
   - **24/7 execution**: 72-hour task kill timeout disabled; auto-restarts if ever terminated.
   - Runs 100% silently in the background (Session 0) with zero desktop windows.
2. To monitor live worker logs and transcode activity at any time, double-click [`view_logs.bat`](file:///c:/Users/Jowin/Desktop/Jellyfin%20Optimizer/worker/view_logs.bat).
3. To stop and completely remove the service at any time, double-click [`uninstall_service.bat`](file:///c:/Users/Jowin/Desktop/Jellyfin%20Optimizer/worker/uninstall_service.bat).

---

### Option 2: Interactive Terminal Window
If you prefer seeing the console output in an interactive terminal window:
1. Double-click [`start_worker.bat`](file:///c:/Users/Jowin/Desktop/Jellyfin%20Optimizer/worker/start_worker.bat).
