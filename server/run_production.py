"""Production runner using Waitress (cross-platform: Windows and Linux).

A single self-contained command to serve the app with a production-grade WSGI
server instead of the Flask/Werkzeug dev server:

    python run_production.py

Configuration (environment variables):
    HOST            bind address          (default 0.0.0.0)
    FLASK_PORT      port                  (default 5000)
    WAITRESS_THREADS  worker threads      (default 8)

On Linux, gunicorn is an alternative:
    gunicorn --workers 4 --bind 0.0.0.0:5000 wsgi:app
"""
import os
import logging

from waitress import serve
from app import create_app

logger = logging.getLogger(__name__)


def main():
    app = create_app()
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("FLASK_PORT", "5000"))
    threads = int(os.getenv("WAITRESS_THREADS", "8"))
    logger.info("Starting Waitress on %s:%d (%d threads)", host, port, threads)
    serve(app, host=host, port=port, threads=threads)


if __name__ == "__main__":
    main()
