<div align="center">

# 🎬 Jellyfin-Optimizarr

### The Intelligent, Distributed, Safety-First Media Optimizer for Jellyfin
**Reclaim 40%–75% of your storage automatically while keeping pristine video quality, all audio tracks, and zero risk.**

[![License: MIT](https://img.shields.io/badge/License-MIT-purple.svg)](LICENSE)
[![Docker Hub](https://img.shields.io/badge/Docker%20Hub-jowinnadar%2Fjellyfin--optimizarr-blue?logo=docker&logoColor=white)](https://hub.docker.com/r/jowinnadar/jellyfin-optimizarr)
[![Docker Pulls](https://img.shields.io/docker/pulls/jowinnadar/jellyfin-optimizarr?logo=docker&logoColor=white)](https://hub.docker.com/r/jowinnadar/jellyfin-optimizarr)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.109+-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React 18](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![Jellyfin](https://img.shields.io/badge/Jellyfin-Native_Integration-00A4DC?logo=jellyfin&logoColor=white)](https://jellyfin.org)
[![GPU Accel](https://img.shields.io/badge/Hardware_Accel-NVENC%20%7C%20QSV%20%7C%20VAAPI-76B900?logo=nvidia&logoColor=white)](#hardware-acceleration--distributed-workers)
[![Mobile Friendly](https://img.shields.io/badge/Mobile-100%25_Responsive-10B981)](#modern-mobile-friendly-dashboard)

[Features](#-key-features) • [Comparison](#-why-jellyfin-optimizarr) • [Quick Start](#-quick-start-in-2-minutes) • [Distributed Workers](#-remote-worker-nodes-gpu-offload) • [Automation](#-automated-scheduling--catch-up) • [Marketing Kit](#-community--launch-kit)

---

</div>

## 💡 What is Jellyfin-Optimizarr?

If you run a home media server with Jellyfin, Sonarr, and Radarr, you know the struggle: your hard drives fill up rapidly with uncompressed, bloated H.264, MPEG-2, or raw camera rips taking up 40–90 MB per minute.

**Jellyfin-Optimizarr** is the missing piece in the \*arr ecosystem. It monitors your media libraries, identifies high-payoff bloat, and optimizes video using modern codecs (HEVC, AV1) with distributed GPU acceleration—all without risking your media library.

### 🛡️ The Zero-Risk Media Protection Guarantee
1. **Never Overwrite In-Place**: Re-encoding happens in an isolated scratch workspace outside your library.
2. **Mandatory Audio & Subtitle Preservation**: Every original language track, multi-channel surround track (5.1/7.1), commentary, and subtitle track is verified and preserved. Silent or corrupted outputs are strictly rejected.
3. **1-Click Rollback Engine**: Original media files are safely stored in reversible backup vaults. Made a mistake? Restore with a single click and automatic Jellyfin library refresh.
4. **Pre-flight Safety Checks**: Validates available temporary disk space, file integrity, and container health before encoding begins.

---

## ⚡ Why Jellyfin-Optimizarr?

| Feature | Jellyfin-Optimizarr | Tdarr | Unmanic | Handbrake / Scripts |
| :--- | :---: | :---: | :---: | :---: |
| **Native Jellyfin Integration** | **Yes (Direct API & Metadata Sync)** | Complex Webhooks | No | No |
| **Distributed Remote Workers** | **Yes (1-click Windows/Linux Node)** | Complex Plugins | Extra Setup | No |
| **Scheduled Series Automation** | **Yes (e.g. Auto-Encode SpongeBob)** | Filter Scripts | Limited | Manual Cron |
| **Instant Rollback & Backups** | **Yes (1-Click Reversible)** | Manual Backup | No | No |
| **Safety Pre-Flight & Audio Verify** | **Mandatory (Zero Silent Outputs)** | Config Dependent | Partial | None |
| **Modern Glassmorphic Mobile UI** | **Yes (100% Mobile Responsive)** | Outdated / Clunky | Basic | Desktop Only |
| **Hardware GPU Auto-Fallback** | **Yes (NVENC / QSV / VAAPI / CPU)** | Plugin Matrix | Manual | Manual |

---

## 🚀 Key Features

### 🌐 Automated Scheduling & Backlog Catch-Up
- **Scope by Series, Library, or Server**: Set targeted rules such as *"Auto-encode SpongeBob SquarePants to AV1"* or *"Auto-encode all Movies with Balanced HEVC"*.
- **Backlog & Upcoming Dual-Engine**:
  - Automatically identifies and queues your existing unoptimized episodes.
  - Intercepts newly downloaded media the moment Sonarr/Radarr or a Jellyfin scan discovers them.
- **Priority & Worker Assignment**: Assign high-priority TV series directly to a fast desktop GPU node while keeping lower-priority movies on background server compute.

### 💻 Remote Worker Nodes (Distributed Compute Cluster)
- Keep your Jellyfin server on a quiet, low-power Mini PC (Intel N100 / Celeron).
- Connect your powerful gaming PC or desktop with an NVIDIA GPU (`h264_nvenc`, `hevc_nvenc`) to act as a remote transcode worker.
- Includes a background Windows Service (`windows_worker.py`) that auto-starts on boot, polls jobs, transcodes locally, and uploads verified results back to the server.

### 🎨 Modern Mobile-Friendly Dashboard
- Built with React 18, Vite, and custom CSS glassmorphism.
- Scaled for seamless navigation on phones, tablets, and ultrawide desktop displays.
- Real-time Server-Sent Events (SSE) telemetry: live encoding speed (fps, x-factor), ETA, percentage, and bandwidth savings counters.

### 📊 Smart Savings Recommendation Engine
- Analyzes library files using FFprobe to calculate exact **MB/Minute density** and efficiency scores.
- Dry-run simulation tool: preview estimated storage savings, required workspace bytes, and proposed FFmpeg arguments before encoding a single frame.

### 🎛️ Tuned Encoding Presets
- **YouTube Space Saver (AV1 + Opus)**: Cutting-edge space efficiency for animated and web content.
- **Balanced HEVC (H.265 / 10-bit)**: Optimal trade-off between visual fidelity and 50%+ storage reduction.
- **Anime Optimized**: Fine-tuned for flat color fields, linework, and grain preservation.
- **High Quality & 4K HDR**: Preserves HDR10, HLG, and Dolby Vision metadata.

---

## 🏗️ Architecture

```
                       ┌────────────────────────────────────────┐
                       │        Docker Network: "apps"          │
                       │                                        │
                       │  ┌──────────────────────────────────┐  │
                       │  │   Jellyfin Media Server (8096)   │  │
                       │  └─────────────────▲────────────────┘  │
                       │                    │ Metadata & Sync   │
                       │  ┌─────────────────▼────────────────┐  │
Clients / Mobile  ────┼─►│   Jellyfin-Optimizarr (8097)     │  │
 (Port 8097:8080)      │  │  ├─ React 18 SPA UI              │  │
                       │  │  ├─ FastAPI Async Core           │  │
                       │  │  ├─ Automation Scheduler         │  │
                       │  │  └─ Reversible Rollback Vault    │  │
                       │  └────────┬───────────────────┬─────┘  │
                       └───────────┼───────────────────┼────────┘
                                   │                   │
                  Volume Mounts    │                   │ Cluster REST API
            ┌──────────────────────▼───────┐     ┌─────▼─────────────────────────┐
            │ Host Media (/data/media)     │     │ Remote Worker Node            │
            │  ├─ /movies   ├─ /tv         │     │  (e.g. Windows PC w/ NVIDIA)  │
            │  ├─ /optimizer-work (Temp)   │     │  ├─ windows_worker.py         │
            │  └─ /optimizer-backups       │     │  └─ NVENC / QSV / VAAPI       │
            └──────────────────────────────┘     └───────────────────────────────┘
```

---

## ⚡ Quick Start in 2 Minutes

### 1. Pull Image directly from Docker Hub
```bash
docker pull jowinnadar/jellyfin-optimizarr:latest
```

### 2. `docker-compose.yml`

Create or add Jellyfin-Optimizarr to your Docker Compose setup:

```yaml
version: "3.8"

services:
  jellyfin-optimizarr:
    container_name: jellyfin-optimizarr
    image: jowinnadar/jellyfin-optimizarr:latest
    restart: unless-stopped
    ports:
      - "8097:8080"
    environment:
      - PUID=1000
      - PGID=1000
      - TZ=UTC
      - JELLYFIN_URL=http://jellyfin:8096
      - JELLYFIN_API_KEY=your_jellyfin_api_key_here
      - SECRET_KEY=generate_a_secure_random_key_here
      - HWACCEL_MODE=auto
      - MIN_FREE_SPACE_GB=15
      - MAX_CONCURRENT_ENCODES=1
    devices:
      - /dev/dri:/dev/dri # Optional Intel/AMD GPU VAAPI passthrough
    volumes:
      - /data/media/config/optimizarr/db:/app/data
      - /data/media/config/optimizarr/config:/app/config
      - /data/media/optimizer-work:/work
      - /data/media/optimizer-backups:/backups
      - /data/media/movies:/movies
      - /data/media/tv:/tv
      - /data/media/anime:/anime
    networks:
      - apps

networks:
  apps:
    external: true
```

### 2. Launch the Application

```bash
docker compose up -d
```

Open your browser to `http://<your-server-ip>:8097`. The setup wizard will guide you through creating your initial administrator account.

---

## 🖥️ Remote Worker Nodes (GPU Offload)

Want to encode using your gaming desktop or another PC on your local network?

1. Copy the `worker/` directory to the worker machine.
2. Ensure Python 3.10+ and [FFmpeg](https://ffmpeg.org/download.html) are installed.
3. Run the worker:
   ```cmd
   python windows_worker.py --server http://192.168.1.7:8097 --prefer-gpu
   ```
4. **Run as a Windows Background Service**:
   Right-click `install_service.bat` and select **Run as Administrator**. The worker will automatically start on system boot without requiring any user to log in!

---

## ⚙️ Configuration Reference

| Environment Variable | Default | Description |
| :--- | :--- | :--- |
| `PORT` | `8097` | Web dashboard & API port exposed on the host. |
| `JELLYFIN_URL` | `http://jellyfin:8096` | Internal URL to your Jellyfin instance. |
| `JELLYFIN_API_KEY` | *(None)* | API key created in Jellyfin Dashboard > API Keys. |
| `HWACCEL_MODE` | `auto` | Acceleration mode: `auto`, `nvenc`, `qsv`, `vaapi`, `cpu`. |
| `HWACCEL_FALLBACK_CPU`| `true` | Automatically retry on CPU if hardware transcode fails. |
| `MIN_FREE_SPACE_GB` | `15` | Minimum free disk space before refusing new jobs. |
| `DEFAULT_REPLACEMENT_MODE`| `safe_backup` | `safe_backup` (keep backup) or `in_place` (direct overwrite). |
| `BACKUP_RETENTION_DAYS` | `14` | Days to keep reversible backups before auto-pruning. |
| `NTFY_ENABLED` | `false` | Enable push notifications via ntfy.sh or self-hosted instance. |
| `TELEGRAM_ENABLED` | `false` | Enable job completion notifications via Telegram Bot. |

---

## 📢 Community & Launch Kit

Want to share or announce Jellyfin-Optimizarr to the community? Check out [`COMMUNITY_LAUNCH.md`](COMMUNITY_LAUNCH.md) for ready-to-use launch templates for:
- **Reddit** (`r/selfhosted`, `r/jellyfin`, `r/homelab`)
- **Hacker News** (*Show HN*)
- **X (Twitter)** Announcement Thread
- **Discord & Lemmy** Community Posts

---

## 🤝 Contributing

Contributions are welcome! If you'd like to implement new encoders, add subtitle language filters, or improve presets:
1. Fork the repository: `https://github.com/JowinN/Jellyfin-Optimizarr.git`
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m "Add amazing feature"`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request.

---

## 📄 License

Distributed under the MIT License. See [`LICENSE`](LICENSE) for details.
