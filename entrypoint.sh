#!/bin/sh
set -e

PUID=${PUID:-1000}
PGID=${PGID:-1000}

echo "=== Starting Jellyfin Media Optimizer ==="
echo "Configuring user/group with PUID: $PUID, PGID: $PGID"

# Ensure group exists or create it
if ! getent group optimizer >/dev/null; then
    groupadd -g "$PGID" optimizer 2>/dev/null || true
fi

# Ensure user exists or create it
if ! id -u optimizer >/dev/null 2>&1; then
    useradd -u "$PUID" -g "$PGID" -d /app -s /bin/sh -M optimizer 2>/dev/null || true
fi

# Ensure directories exist
mkdir -p /app/config /app/data /work /backups

# Set ownership of writable directories
chown -R "$PUID:$PGID" /app/config /app/data /work /backups 2>/dev/null || true

# Run database setup and default profile seeding
echo "Initializing database..."
gosu "$PUID:$PGID" python -m scripts.init_db

# Start application server
echo "Starting web server on port ${PORT:-8080}..."
exec gosu "$PUID:$PGID" uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8080}"
