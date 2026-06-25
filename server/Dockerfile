# SecureRAG backend - production image (Waitress WSGI)
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1     PYTHONUNBUFFERED=1

WORKDIR /app

# build-essential is needed to compile some native deps (e.g. chromadb/hnswlib)
RUN apt-get update && apt-get install -y --no-install-recommends build-essential     && rm -rf /var/lib/apt/lists/*

COPY server/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pre-cache the embedding model so the first request is fast and startup does
# not require a model download at runtime.
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('all-MiniLM-L6-v2')"

COPY server/ .
EXPOSE 5000
ENV HOST=0.0.0.0     FLASK_PORT=5000

# Data (SQLite + Chroma) lives in /data, mounted as a volume by compose.
CMD ["python", "run_production.py"]
