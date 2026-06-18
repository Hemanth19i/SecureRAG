"""WSGI entrypoint for production servers.

Exposes the ``app`` callable built by the application factory so a production
WSGI server can serve it directly:

    # Linux (gunicorn):
    gunicorn --workers 4 --bind 0.0.0.0:5000 wsgi:app

    # Cross-platform (waitress):
    waitress-serve --listen=0.0.0.0:5000 wsgi:app

For a single self-contained command (waitress, works on Windows and Linux) use
``run_production.py`` instead.
"""
from app import create_app

app = create_app()
