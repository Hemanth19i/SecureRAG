"""Security-layer tests: rate limiting (Part B). Offline, no external calls."""
import pytest


@pytest.fixture()
def ratelimited_client(tmp_path, monkeypatch):
    """App with rate limiting ENABLED and a tiny default limit, so we can prove
    a 429 without thousands of requests. Separate from the conftest `app` fixture
    (which disables limiting for the rest of the suite)."""
    monkeypatch.setenv("JWT_SECRET_KEY", "test-secret-key-" + "x" * 40)
    monkeypatch.setenv("DEFAULT_ADMIN_PASSWORD", "Test-Admin-Pass-123")
    monkeypatch.setenv("CHROMA_DB_PATH", str(tmp_path / "chroma"))
    monkeypatch.setenv("RATELIMIT_ENABLED", "true")
    monkeypatch.setenv("RATELIMIT_DEFAULT", "2 per minute")

    import app as app_module
    orig_store_cls = app_module.SQLiteStore
    monkeypatch.setattr(
        app_module, "SQLiteStore",
        lambda *a, **k: orig_store_cls(db_path=str(tmp_path / "securerag.db")),
    )
    return app_module.create_app().test_client()


def test_rate_limit_returns_429_when_exceeded(ratelimited_client):
    # Default limit "2 per minute" applies to every route; the limiter runs in a
    # before-request hook, so it triggers before auth (unauthenticated is fine).
    statuses = [ratelimited_client.get("/stats").status_code for _ in range(3)]
    assert statuses[-1] == 429, statuses
    body = ratelimited_client.get("/stats").get_json()
    assert body["error"] == "Too many requests"


def test_rate_limit_disabled_does_not_429(client):
    # The conftest `app` fixture disables limiting; many requests stay un-429'd.
    assert all(client.get("/stats").status_code != 429 for _ in range(10))


# --- security headers (Part C) ---------------------------------------------
def test_security_headers_present_on_every_response(client):
    # Headers must be set even on an unauthenticated (401) response.
    h = client.get("/stats").headers
    assert h.get("X-Content-Type-Options") == "nosniff"
    assert h.get("X-Frame-Options") == "DENY"
    assert h.get("Referrer-Policy") == "no-referrer"
    assert "max-age=" in (h.get("Strict-Transport-Security") or "")
    assert "default-src 'self'" in (h.get("Content-Security-Policy") or "")
