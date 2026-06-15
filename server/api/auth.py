import os
import time
import logging
import threading
from collections import defaultdict
from flask import Blueprint, request, jsonify, current_app
from werkzeug.security import generate_password_hash, check_password_hash
from flask_jwt_extended import create_access_token, create_refresh_token, jwt_required, get_jwt_identity, get_jwt

logger = logging.getLogger(__name__)

auth_bp = Blueprint('auth', __name__)

# --- Simple in-memory login rate limiter (per client IP, sliding window) ---
# Dependency-free; suitable for a single-process deployment. For multi-worker
# setups this should be backed by a shared store (e.g. Redis).
_LOGIN_MAX_ATTEMPTS = int(os.getenv("LOGIN_RATE_LIMIT", "10"))
_LOGIN_WINDOW_SECONDS = int(os.getenv("LOGIN_RATE_WINDOW", "60"))
_login_attempts = defaultdict(list)
_login_lock = threading.Lock()

def _client_ip():
    # Honour the first proxy hop if present, else the direct peer.
    forwarded = request.headers.get("X-Forwarded-For", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.remote_addr or "unknown"

def _login_rate_limited(ip):
    now = time.time()
    with _login_lock:
        attempts = [t for t in _login_attempts[ip] if now - t < _LOGIN_WINDOW_SECONDS]
        if len(attempts) >= _LOGIN_MAX_ATTEMPTS:
            _login_attempts[ip] = attempts
            return True
        attempts.append(now)
        _login_attempts[ip] = attempts
        return False

@auth_bp.route('/register', methods=['POST'])
@jwt_required()
def register():
    claims = get_jwt()
    if claims.get("role") != "ADMIN":
        return jsonify({"error": "Admin privileges required"}), 403

    data = request.json
    if not data or not data.get('username') or not data.get('password') or not data.get('role'):
        return jsonify({"error": "Missing required fields"}), 400

    username = data['username']
    password = data['password']
    role = data['role']

    if role not in ["ADMIN", "ANALYST", "VIEWER"]:
        return jsonify({"error": "Invalid role"}), 400

    hashed_password = generate_password_hash(password)

    success = current_app.sqlite_store.create_user(username, hashed_password, role)
    if success:
        return jsonify({"message": f"User {username} created successfully"}), 201
    else:
        return jsonify({"error": "Username already exists"}), 409

@auth_bp.route('/login', methods=['POST'])
def login():
    ip = _client_ip()
    if _login_rate_limited(ip):
        logger.warning("Login rate limit exceeded for %s", ip)
        return jsonify({"error": "Too many login attempts. Please try again later."}), 429

    data = request.json
    if not data or not data.get('username') or not data.get('password'):
        return jsonify({"error": "Missing username or password"}), 400

    user = current_app.sqlite_store.get_user_by_username(data['username'])
    if not user or not check_password_hash(user['password_hash'], data['password']):
        return jsonify({"error": "Invalid credentials"}), 401

    additional_claims = {"role": user['role']}
    access_token = create_access_token(identity=user['username'], additional_claims=additional_claims)
    refresh_token = create_refresh_token(identity=user['username'], additional_claims=additional_claims)

    return jsonify({
        "access_token": access_token,
        "refresh_token": refresh_token,
        "role": user['role']
    }), 200

@auth_bp.route('/refresh', methods=['POST'])
@jwt_required(refresh=True)
def refresh():
    identity = get_jwt_identity()
    claims = get_jwt()

    # We pass the role from the refresh token to the new access token
    additional_claims = {"role": claims.get("role")}
    access_token = create_access_token(identity=identity, additional_claims=additional_claims)

    return jsonify({"access_token": access_token}), 200
