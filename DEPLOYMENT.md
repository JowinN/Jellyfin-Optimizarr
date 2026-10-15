# Deployment Guide: Jellyfin Media Optimizer
### Ubuntu Home Server Co-Existence with Jellyfin

This guide outlines deployment steps specifically aligned with your existing Jellyfin container and filesystem structure.

---

## 1. Network & Infrastructure Verification

Your existing Jellyfin container runs on an external Docker bridge network named `apps`:

```bash
# Verify the apps network exists
docker network inspect apps >/dev/null 2>&1 && echo "Network 'apps' exists" || docker network create apps
```

Because both services join `apps`, the optimizer accesses Jellyfin directly over Docker internal DNS at:
`http://jellyfin:8096`

---

## 2. Directory Creation & Permissions

Create the optimizer host directories with ownership matching `PUID: 1000` and `PGID: 1000`:

```bash
# 1. Configuration & Persistent Database
sudo mkdir -p /data/media/config/media-optimizer/db

# 2. Temporary Workspace
sudo mkdir -p /data/media/optimizer-work

# 3. Reversible Backups Directory
sudo mkdir -p /data/media/optimizer-backups

# Set ownership
sudo chown -R 1000:1000 /data/media/config/media-optimizer /data/media/optimizer-work /data/media/optimizer-backups
sudo chmod -R 775 /data/media/optimizer-work /data/media/optimizer-backups
```

---

## 3. Intel Quick Sync & VAAPI Hardware Acceleration

Your existing Jellyfin container maps `/dev/dri:/dev/dri`.
The optimizer container includes its own `/dev/dri` device mapping.

To ensure non-root container users can access the GPU:

```bash
# Verify render device permissions
ls -la /dev/dri
# Output typically shows: crw-rw---- 1 root render ... /dev/dri/renderD128

# Add your host user to the render and video groups if not already present
sudo usermod -aG render,video $USER
```

The container automatically tests for VAAPI and Intel Quick Sync upon startup and gracefully falls back to high-efficiency CPU software encoding (`libx265`) if the hardware driver is not engaged.

---

## 4. Deploying with Docker Compose

1. Clone or copy this repository into `/data/media/config/media-optimizer/app` (or your chosen projects directory, e.g. `~/docker/jellyfin-optimizer`).
2. Configure `.env`:

```bash
cp .env.example .env
nano .env
```

Ensure:
```env
PUID=1000
PGID=1000
TZ=Asia/Kolkata
JELLYFIN_URL=http://jellyfin:8096
JELLYFIN_API_KEY=<your-jellyfin-api-key>
PORT=8097
```

3. Launch the container:

```bash
docker compose up -d --build
```

---

## 5. First-Run Setup & Jellyfin Verification

1. Open your browser and navigate to: **`http://<SERVER_IP>:8097`**
2. The **First-Run Setup Wizard** will prompt you to create your administrator username and password.
3. Test your Jellyfin connectivity directly inside the wizard.
4. Once completed, your dashboard will load and you can initiate your first library scan.

---

## 6. Service Management Commands

```bash
# View live logs
docker compose logs -f media-optimizer

# Restart service
docker compose restart media-optimizer

# Stop service
docker compose down

# Check container health status
docker inspect --format='{{json .State.Health}}' jellyfin-media-optimizer
```
