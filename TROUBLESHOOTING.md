# Troubleshooting Guide: Jellyfin Media Optimizer

This guide covers common issues and resolutions when running Jellyfin Media Optimizer on an Ubuntu home server.

---

## 1. Hardware Acceleration Diagnostics

### Issue: "No DRI device found" or "VAAPI initialization failed"

**Cause:** The host GPU device `/dev/dri` is not accessible by the container user.

**Resolution:**
1. Check if `/dev/dri` exists on your host:
   ```bash
   ls -la /dev/dri
   ```
2. Check device permissions. Render devices usually belong to the `render` group:
   ```bash
   getent group render
   ```
3. Ensure the container runs with `PUID=1000` and `PGID=1000`, and that user 1000 belongs to the `video` and `render` groups on the host:
   ```bash
   sudo usermod -aG render,video $USER
   ```
4. If your system lacks Intel Quick Sync / VAAPI hardware, navigate to **Settings** in the dashboard and set **Hardware Acceleration Mode** to **CPU Software Only (libx265)**. The application will use multi-threaded CPU software encoding.

---

## 2. Jellyfin Connection & API Key

### Issue: "Could not connect to Jellyfin at http://jellyfin:8096"

**Cause:** Docker network configuration mismatch or incorrect hostname.

**Resolution:**
1. Ensure both containers share the `apps` network:
   ```bash
   docker network inspect apps
   ```
   Both `jellyfin` and `jellyfin-media-optimizer` should appear in the `Containers` section.
2. Inside the optimizer container, test internal connectivity:
   ```bash
   docker exec -it jellyfin-media-optimizer curl -I http://jellyfin:8096/System/Info/Public
   ```
3. If Jellyfin is running directly on the host rather than in Docker, configure `JELLYFIN_URL=http://172.17.0.1:8096` or your host server LAN IP.

### Issue: "Authentication failed: Invalid Jellyfin API Key"

**Resolution:**
1. Generate a new API key in Jellyfin: **Dashboard -> Advanced -> API Keys**.
2. Navigate to **Settings** in the Optimizer dashboard, paste the new key, and click **Test Connection**.

---

## 3. Storage & Disk Space Pre-flight Errors

### Issue: "Pre-flight failed: Insufficient space in /work"

**Cause:** The optimizer requires at least `MIN_FREE_SPACE_GB` (default: 15 GB) free disk space on the temporary encoding filesystem before launching an encode.

**Resolution:**
1. Verify free space on `/data/media/optimizer-work`:
   ```bash
   df -h /data/media/optimizer-work
   ```
2. Clean up any leftover temporary files from interrupted manual runs:
   ```bash
   rm -f /data/media/optimizer-work/encode_*.mkv
   ```
3. Adjust `MIN_FREE_SPACE_GB` in **Settings** if your disk layout uses smaller dedicated partitions.

---

## 4. File Permissions & Ownership

### Issue: "Permission denied" during replacement or scanning

**Resolution:**
Verify that your media directories and optimizer configuration share consistent ownership:

```bash
# Correct ownership matching PUID: 1000, PGID: 1000
sudo chown -R 1000:1000 /data/media/config/media-optimizer
sudo chown -R 1000:1000 /data/media/optimizer-work
sudo chown -R 1000:1000 /data/media/optimizer-backups
```

---

## 5. Inspecting Structured Logs

Structured logs are rotated automatically and written to `/data/media/config/media-optimizer/logs/optimizer.log`. Sensitive API keys and tokens are automatically redacted.

```bash
# View live container logs
docker compose logs -f media-optimizer

# Inspect the persistent rotating log file on host
tail -n 100 /data/media/config/media-optimizer/logs/optimizer.log
```

You can also export a complete, redacted diagnostic bundle from **Settings -> Export Diagnostic Bundle** in the web dashboard.
