from dotenv import load_dotenv
load_dotenv()

import os
import logging
import secrets
import traceback

# Configure application-wide logging before anything else emits output.
logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO").upper(),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

from flask import Flask
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from datetime import timedelta
from api.routes import api_bp
from api.auth import auth_bp
from rag.vectorstore import VectorStore
from intelligence.sqlite_store import SQLiteStore

def create_app():
    app = Flask(__name__)
    # Allow a comma-separated list of front-end origins (e.g. the deployed app
    # plus localhost during dev). Each must match scheme/host/port exactly.
    cors_origins = [o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",") if o.strip()]
    CORS(app, resources={r"/*": {"origins": cors_origins}})

    # Configure JWT. Fail closed: refuse to start without a STRONG secret rather
    # than running with a missing, short, or placeholder (guessable) key.
    jwt_secret = os.getenv("JWT_SECRET_KEY")
    if not jwt_secret:
        raise RuntimeError(
            "JWT_SECRET_KEY is not set. Refusing to start with an insecure default. "
            "Set JWT_SECRET_KEY in the environment (see .env.example)."
        )
    weak_jwt_secrets = {
        "your_random_secret_here", "generate_a_strong_random_secret",
        "change-me", "changeme", "secret", "password",
        "securerag-super-secret-key-change-in-prod-2024",
    }
    if len(jwt_secret) < 32 or jwt_secret.lower() in weak_jwt_secrets:
        raise RuntimeError(
            "JWT_SECRET_KEY is too weak. Use at least 32 random characters, e.g. "
            "python -c \"import secrets; print(secrets.token_urlsafe(48))\". "
            "Refusing to start."
        )
    app.config["JWT_SECRET_KEY"] = jwt_secret
    app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(minutes=15)
    app.config["JWT_REFRESH_TOKEN_EXPIRES"] = timedelta(days=30)

    # Cap request body size to prevent memory-exhaustion via oversized uploads.
    max_upload_mb = int(os.getenv("MAX_UPLOAD_MB", "50"))
    app.config["MAX_CONTENT_LENGTH"] = max_upload_mb * 1024 * 1024

    jwt = JWTManager(app)

    # Register blueprints
    app.register_blueprint(api_bp)
    app.register_blueprint(auth_bp, url_prefix='/auth')

    # Initialize ChromaDB on startup
    with app.app_context():
        try:
            db_path = os.getenv("CHROMA_DB_PATH", "./chroma_store")
            abs_chroma_path = os.path.abspath(db_path)
            app.vector_store = VectorStore(persist_directory=db_path)
            logger.info("Initialized ChromaDB at %s", abs_chroma_path)

            # Initialize SQLite store
            app.sqlite_store = SQLiteStore()
            abs_sqlite_path = os.path.abspath(app.sqlite_store.db_path)
            logger.info("Initialized SQLite SIEM Store at %s", abs_sqlite_path)

            # Create a default admin if none exists
            from werkzeug.security import generate_password_hash
            default_admin = app.sqlite_store.get_user_by_username("admin")
            if not default_admin:
                admin_password = os.getenv("DEFAULT_ADMIN_PASSWORD")
                # Reject weak bootstrap passwords: ignore them and generate a
                # strong random one rather than shipping guessable admin creds.
                weak_admin_passwords = {"admin", "admin123", "password", "123456", "changeme", "secret"}
                if admin_password and (len(admin_password) < 12 or admin_password.lower() in weak_admin_passwords):
                    logger.warning(
                        "DEFAULT_ADMIN_PASSWORD is weak; ignoring it and generating a "
                        "strong random password instead. Unset it or use >=12 strong chars."
                    )
                    admin_password = None
                if not admin_password:
                    admin_password = secrets.token_urlsafe(12)
                    logger.warning("\n" + "=" * 50)
                    logger.warning("  DEFAULT ADMIN ACCOUNT CREATED")
                    logger.warning("  Username: admin")
                    logger.warning("  Password: %s", admin_password)
                    logger.warning("  SAVE THIS NOW. It will not be shown again.")
                    logger.warning("  (Set DEFAULT_ADMIN_PASSWORD in .env to use a fixed password)")
                    logger.warning("=" * 50 + "\n")
                app.sqlite_store.create_user("admin", generate_password_hash(admin_password), "ADMIN")
                logger.info("Created default admin user. Change the password immediately in production.")
        except Exception as e:
            logger.error("Failed to initialize stores: %s", e)
            traceback.print_exc()
            raise RuntimeError(f"Startup failed: {e}")

    return app

if __name__ == "__main__":
    app = create_app()
    port = int(os.getenv("FLASK_PORT", 5000))
    debug_enabled = os.getenv("FLASK_DEBUG", "false").lower() in ("1", "true", "yes")
    app.run(debug=debug_enabled, host='0.0.0.0', port=port)  # nosec B104 - intentional bind for container/LAN; restrict at the proxy/HOST in prod
