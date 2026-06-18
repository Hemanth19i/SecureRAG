"""Shared pytest fixtures.

Keeps the suite OFFLINE and DETERMINISTIC:
- Stubs the SentenceTransformer model so importing the app never downloads
  weights (the real model is preserved for the opt-in integration test).
- Builds the app with a temp SQLite DB and temp Chroma store, so tests never
  touch the repo's ./securerag.db or ./chroma_store.
- Provides ADMIN / ANALYST / VIEWER JWTs and sample-log fixtures.

External calls (Gemini) are mocked per-test, not here.
"""
import os
import sys

# Make the server package importable (server/ is the parent of tests/).
SERVER_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if SERVER_DIR not in sys.path:
    sys.path.insert(0, SERVER_DIR)

# --- Offline stub: replace SentenceTransformer BEFORE the app imports it. -----
# routes.py instantiates Embedder() at import time, which would otherwise pull
# the all-MiniLM-L6-v2 weights from the network on first run.
import numpy as np  # noqa: E402
import rag.embedder as _emb_mod  # noqa: E402

REAL_SENTENCE_TRANSFORMER = _emb_mod.SentenceTransformer


class _StubSentenceTransformer:
    """Deterministic, offline stand-in. Returns fixed-dim vectors."""

    def __init__(self, *args, **kwargs):
        pass

    def encode(self, texts, *args, **kwargs):
        items = texts if isinstance(texts, (list, tuple)) else [texts]
        # Vectors vary by text length so they aren't all identical.
        return np.array(
            [[(len(str(t)) % 7) + i * 0.1 for i in range(8)] for t in items],
            dtype=float,
        )


_emb_mod.SentenceTransformer = _StubSentenceTransformer
# Stash the real class on the module so the opt-in integration test can restore it.
_emb_mod.REAL_SENTENCE_TRANSFORMER = REAL_SENTENCE_TRANSFORMER

import pytest  # noqa: E402


@pytest.fixture()
def app(tmp_path, monkeypatch):
    """A fresh Flask app backed by temp stores (no repo-state side effects)."""
    monkeypatch.setenv("JWT_SECRET_KEY", "test-secret-key-" + "x" * 40)
    monkeypatch.setenv("DEFAULT_ADMIN_PASSWORD", "Test-Admin-Pass-123")
    monkeypatch.setenv("CHROMA_DB_PATH", str(tmp_path / "chroma"))

    import app as app_module

    # Inject a temp SQLite path; create_app() otherwise hardcodes ./securerag.db.
    orig_store_cls = app_module.SQLiteStore
    monkeypatch.setattr(
        app_module,
        "SQLiteStore",
        lambda *a, **k: orig_store_cls(db_path=str(tmp_path / "securerag.db")),
    )

    application = app_module.create_app()
    application.config.update(TESTING=True)
    return application


@pytest.fixture()
def client(app):
    return app.test_client()


def _token(app, role, identity="tester"):
    from flask_jwt_extended import create_access_token

    with app.app_context():
        return create_access_token(identity=identity, additional_claims={"role": role})


@pytest.fixture()
def admin_token(app):
    return _token(app, "ADMIN", "admin")


@pytest.fixture()
def analyst_token(app):
    return _token(app, "ANALYST", "analyst")


@pytest.fixture()
def viewer_token(app):
    return _token(app, "VIEWER", "viewer")


@pytest.fixture()
def auth_header(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture()
def sample_log():
    """One document that triggers every analysis dimension.

    Contains: an attacker IP (repeated brute force then success), an MD5 hash,
    a CVE, a domain, an email, and an outbound transfer — so IOC extraction,
    MITRE mapping, timeline, and correlation all produce non-trivial output.
    """
    return (
        "2026-06-15 02:11:03 Failed password for admin from 203.0.113.45 port 22 ssh2\n"
        "2026-06-15 02:11:05 Failed password for admin from 203.0.113.45 port 22 ssh2\n"
        "2026-06-15 02:11:07 Failed password for root from 203.0.113.45 port 22 ssh2\n"
        "2026-06-15 02:11:20 Accepted password for admin from 203.0.113.45 port 22 ssh2\n"
        "2026-06-15 03:05:00 malware hash 44d88612fea8a8f36de82e1278abb02f CVE-2021-44228 exploit attempt\n"
        "2026-06-15 03:06:00 outbound 250 MB transferred to evil-domain.example contact admin@corp.example\n"
    )
