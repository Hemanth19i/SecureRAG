from dotenv import load_dotenv
load_dotenv()

import os
import secrets
import traceback
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
    CORS(app, resources={r"/*": {"origins": os.getenv("CORS_ORIGINS", "http://localhost:5173")}})

    # Configure JWT
    app.config["JWT_SECRET_KEY"] = os.getenv("JWT_SECRET_KEY", "super-secret-default-key") # Change in prod
    app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(minutes=15)
    app.config["JWT_REFRESH_TOKEN_EXPIRES"] = timedelta(days=30)
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
            print(f"Initialized ChromaDB at {abs_chroma_path}")
            
            # Initialize SQLite store
            app.sqlite_store = SQLiteStore()
            abs_sqlite_path = os.path.abspath(app.sqlite_store.db_path)
            print(f"Initialized SQLite SIEM Store at {abs_sqlite_path}")
            
            # Create a default admin if none exists
            from werkzeug.security import generate_password_hash
            default_admin = app.sqlite_store.get_user_by_username("admin")
            if not default_admin:
                admin_password = os.getenv("DEFAULT_ADMIN_PASSWORD")
                if not admin_password:
                    admin_password = secrets.token_urlsafe(12)
                    print("\n" + "=" * 50)
                    print("  DEFAULT ADMIN ACCOUNT CREATED")
                    print(f"  Username: admin")
                    print(f"  Password: {admin_password}")
                    print("  SAVE THIS NOW. It will not be shown again.")
                    print("  (Set DEFAULT_ADMIN_PASSWORD in .env to use a fixed password)")
                    print("=" * 50 + "\n")
                app.sqlite_store.create_user("admin", generate_password_hash(admin_password), "ADMIN")
                print("Created default admin user (admin/admin). Change this immediately in production.")
        except Exception as e:
            print(f"Failed to initialize stores: {e}")
            traceback.print_exc()
            raise RuntimeError(f"Startup failed: {e}")
            
    return app

if __name__ == "__main__":
    app = create_app()
    port = int(os.getenv("FLASK_PORT", 5000))
    app.run(debug=True, host='0.0.0.0', port=port)
