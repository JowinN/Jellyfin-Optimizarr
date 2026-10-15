# ==========================================
# Stage 1: Build Frontend (React + Vite)
# ==========================================
FROM node:20-alpine AS frontend-builder
WORKDIR /build

COPY frontend/package*.json ./
RUN npm install

COPY frontend/ ./
RUN npm run build

# ==========================================
# Stage 2: Production Application Runtime
# ==========================================
FROM python:3.11-slim-bookworm AS production

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    DEBIAN_FRONTEND=noninteractive \
    PUID=1000 \
    PGID=1000 \
    PORT=8080

WORKDIR /app

# Install system dependencies: FFmpeg, FFprobe, VAAPI drivers, curl, gosu for clean privilege dropping
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    vainfo \
    va-driver-all \
    intel-media-va-driver \
    curl \
    gosu \
    procps \
    && rm -rf /var/lib/apt/lists/*

# Install Python requirements
COPY backend/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

# Copy built frontend assets
COPY --from=frontend-builder /build/dist /app/frontend_dist

# Copy backend application
COPY backend/app /app/app
COPY backend/scripts /app/scripts

# Create necessary mount points
RUN mkdir -p /app/config /app/data /work /backups /movies /tv /anime

# Copy and prepare entrypoint
COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
    CMD curl -f http://127.0.0.1:8080/api/health || exit 1

ENTRYPOINT ["/app/entrypoint.sh"]
