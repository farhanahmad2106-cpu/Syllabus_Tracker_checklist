# Multi-platform production container for Syllabus Tracker FastAPI backend
FROM python:3.12-slim

# Prevent Python from writing .pyc files and buffer stdout/stderr
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app \
    PORT=8000 \
    DATABASE_URL=sqlite:///./data/syllabus_tracker.db

WORKDIR /app

# Install system dependencies:
# - curl: container health checks on Railway/Render/Fly.io
# - libreoffice-writer-nogui: optional headless conversion of legacy .doc to .docx
RUN apt-get update && \
    (apt-get install -y --no-install-recommends curl libreoffice-writer-nogui || \
     apt-get install -y --no-install-recommends curl libreoffice-writer) && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Install Python dependencies first for caching
COPY backend/requirements.txt /app/backend/requirements.txt
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r /app/backend/requirements.txt

# Copy backend application source code
COPY backend/ /app/backend/

# Create persistent storage directory for SQLite database + WAL files
RUN mkdir -p /app/data

# Declare volume mount for persistent SQLite storage
VOLUME ["/app/data"]

EXPOSE 8000

# Healthcheck for container orchestrators (Railway / Render / Docker Swarm)
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f "http://localhost:${PORT:-8000}/api/health" || exit 1

# Launch uvicorn bound to 0.0.0.0 using dynamic $PORT injected by cloud provider
CMD ["sh", "-c", "uvicorn backend.app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
