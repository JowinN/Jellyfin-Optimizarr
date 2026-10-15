# 🚀 Jellyfin-Optimizarr: Community Launch Kit

Use the copy-paste templates below to announce **Jellyfin-Optimizarr** across Reddit, Hacker News, X (Twitter), and self-hosted Discord communities.

---

## 1. Reddit: r/selfhosted & r/jellyfin & r/homelab

**Post Title**:
> *Show Reddit: I built Jellyfin-Optimizarr – An automated, distributed media optimizer with safety-first rollbacks and GPU offload*

**Post Body**:
```markdown
Hey r/selfhosted / r/jellyfin!

Like many of you, my Jellyfin libraries were eating up terabytes of storage due to older, uncompressed H.264 camera rips, TV episode bloat (40–80 MB/minute), and legacy MPEG-2/VC-1 files.

I looked at existing solutions like Tdarr and Unmanic, but I wanted something that:
1. **Understands Jellyfin natively**: Directly queries libraries, inspects streams with FFprobe, and triggers instant metadata refreshes when an item is optimized.
2. **Prioritizes zero-risk safety**: Never encodes in-place, guarantees 100% preservation of all audio tracks/dubs/commentaries (preventing silent outputs), and features a 1-click reversible rollback vault.
3. **Supports Distributed GPU Workers**: Keep the main server on a low-power Mini PC, and offload heavy encodes to a gaming PC / desktop GPU over the network.
4. **Has Scheduled Series & Library Rules**: Define a rule like "Auto-encode SpongeBob SquarePants to AV1" or "Auto-optimize all new TV downloads", and it automatically processes both your backlog and incoming files.
5. **A modern, mobile-friendly UI**: Fast, responsive glassmorphic dashboard with live SSE encoding telemetry.

So I built **Jellyfin-Optimizarr**.

### ✨ Highlights
- **Distributed Worker Nodes**: Offload encoding to Windows/Linux machines with NVIDIA NVENC, Intel QSV, or Apple Silicon. Windows background service installs with one click.
- **Automated Scheduling Engine**: Target by Series, Library (Movies/TV/Anime), or whole server.
- **Smart Recommendation Engine**: Visualizes MB/minute density to highlight exactly which files will free up the most gigabytes.
- **Dry-Run Simulation**: Preview estimated savings and inspect exact FFmpeg arguments before encoding a single frame.
- **Tuned Presets**: Includes AV1 + Opus (YouTube Space Saver), Balanced HEVC 10-bit, and Anime-tuned presets.
- **100% Open Source (MIT)**.

GitHub: https://github.com/JowinN/Jellyfin-Optimizarr

Docker Compose:
```yaml
services:
  jellyfin-optimizarr:
    image: ghcr.io/jowinn/jellyfin-optimizarr:latest
    container_name: jellyfin-optimizarr
    ports:
      - "8097:8080"
    environment:
      - JELLYFIN_URL=http://jellyfin:8096
      - JELLYFIN_API_KEY=your_api_key
      - MIN_FREE_SPACE_GB=15
```

Would love to hear your feedback, feature ideas, and experiences with it!
```

---

## 2. Hacker News: Show HN

**Title**:
> *Show HN: Jellyfin-Optimizarr – Automated, distributed media optimizer for Jellyfin*

**Text**:
```markdown
Hi HN! I built Jellyfin-Optimizarr (https://github.com/JowinN/Jellyfin-Optimizarr), an open-source media compression and library management tool for self-hosted Jellyfin instances.

The core motivation was building a video compression tool with strict transactional guarantees:
- Re-encoding happens in an isolated scratch workspace outside the library.
- Audio and subtitle preservation is enforced via post-encode decode checks, preventing accidental silent files.
- Original files are held in a rollback vault so any operation can be instantly reversed.
- Distributed compute nodes allow a low-power home server to offload encoding to higher-power GPU workstations across the LAN.

Stack: Python 3.11 / FastAPI backend with SQLite WAL and FFmpeg, React 18 / Vite frontend with Server-Sent Events.

Feedback and PRs are warmly welcomed!
```

---

## 3. X (Twitter) Launch Thread

**Tweet 1**:
> Tired of bloated video files eating up your Jellyfin storage? 🎬
> 
> Introducing **Jellyfin-Optimizarr**: The intelligent, distributed media optimizer with safety-first rollbacks and GPU offload.
> 
> Reclaim 40%–75% disk space automatically. 🧵👇
> https://github.com/JowinN/Jellyfin-Optimizarr

**Tweet 2**:
> 🛡️ **Zero-Risk Guarantee**:
> Most encoders overwrite files in place. If it fails, your file is ruined.
> Optimizarr encodes in an isolated workspace, checks audio decodability, and moves the original to a 1-click rollback vault.

**Tweet 3**:
> ⚡ **Distributed Worker Cluster**:
> Running your server on a low-power mini PC? Optimizarr lets you connect your Windows/Linux desktop GPU as a remote compute worker with one command.

**Tweet 4**:
> 🌐 **Rule-Based Automation**:
> Set rules like "Auto-encode SpongeBob to AV1" or "Optimize all upcoming TV downloads". It automatically cleans up both your backlog and incoming media.
> 
> Check it out & star on GitHub: https://github.com/JowinN/Jellyfin-Optimizarr ⭐

---

## 4. Discord & Lemmy Communities

**Message**:
> 🚀 **Jellyfin-Optimizarr** has just been open-sourced!
> An automated, distributed media compression platform for Jellyfin.
> Features:
> • Reclaim 40–75% storage with HEVC & AV1
> • Distributed GPU worker nodes (NVIDIA / QSV / VAAPI)
> • Automated rules for series or entire libraries
> • Guaranteed multi-audio track retention & 1-click rollbacks
> • Mobile-friendly glassmorphism UI
> 
> Repo: https://github.com/JowinN/Jellyfin-Optimizarr
