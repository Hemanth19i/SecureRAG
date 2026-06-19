"""Shared Flask extensions.

The rate limiter is created unbound here so routes can decorate specific
endpoints (e.g. a stricter limit on /auth/login); create_app() binds it via
init_app() and reads all tunables from app config, so tests can disable limiting
per-app. This layers ON TOP of the existing in-memory login throttle in auth.py
(it does not replace it).
"""
import os
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

# Stricter, login-specific limit (in addition to the global default).
LOGIN_RATELIMIT = os.getenv("RATELIMIT_LOGIN", "5 per minute")
