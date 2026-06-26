# Render / Docker build from repo root (no Root Directory set).
# Prefer backend/Dockerfile with Root Directory = backend when possible.
FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ .

ENV ENV=production
ENV PYTHONUNBUFFERED=1

EXPOSE 8000

CMD ["uvicorn", "app.main:app_fastapi", "--host", "0.0.0.0", "--port", "8000"]
