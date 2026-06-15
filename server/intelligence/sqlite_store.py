import sqlite3
import os
import traceback

class SQLiteStore:
    def __init__(self, db_path="./securerag.db"):
        self.db_path = db_path
        self._init_db()

    def get_connection(self):
        conn = sqlite3.connect(self.db_path, check_same_thread=False)
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA synchronous=NORMAL")
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self):
        try:
            conn = self.get_connection()
            cursor = conn.cursor()
            
            # 1. Core Event Table
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS log_chunks (
                chunk_id TEXT PRIMARY KEY,
                upload_id TEXT NOT NULL,
                source_file TEXT,
                raw_text TEXT NOT NULL,
                timestamp_ingested DATETIME DEFAULT CURRENT_TIMESTAMP
            )
            """)
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_upload_id ON log_chunks(upload_id)")

            # 2. Global IOC Ledger
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS extracted_iocs (
                ioc_value TEXT PRIMARY KEY,
                ioc_type TEXT NOT NULL,
                global_risk_score TEXT DEFAULT 'UNKNOWN'
            )
            """)
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_ioc_type ON extracted_iocs(ioc_type)")

            # 3. Correlation Engine Mapping
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS chunk_ioc_mapping (
                chunk_id TEXT,
                ioc_value TEXT,
                context_role TEXT,
                PRIMARY KEY (chunk_id, ioc_value),
                FOREIGN KEY (chunk_id) REFERENCES log_chunks(chunk_id),
                FOREIGN KEY (ioc_value) REFERENCES extracted_iocs(ioc_value)
            )
            """)
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_mapping_ioc ON chunk_ioc_mapping(ioc_value)")

            # 4. MITRE ATT&CK Matrix Mapping
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS chunk_mitre_mapping (
                mapping_id INTEGER PRIMARY KEY AUTOINCREMENT,
                chunk_id TEXT,
                technique_id TEXT NOT NULL,
                tactic TEXT NOT NULL,
                confidence TEXT NOT NULL,
                FOREIGN KEY (chunk_id) REFERENCES log_chunks(chunk_id)
            )
            """)
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_mitre_technique ON chunk_mitre_mapping(technique_id)")

            # 5. Chronological Threat Timeline
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS timeline_events (
                event_id INTEGER PRIMARY KEY AUTOINCREMENT,
                chunk_id TEXT,
                event_timestamp DATETIME NOT NULL,
                event_description TEXT NOT NULL,
                severity TEXT NOT NULL,
                FOREIGN KEY (chunk_id) REFERENCES log_chunks(chunk_id)
            )
            """)
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_timeline_time ON timeline_events(event_timestamp)")

            # 6. File Uploads (Duplicate Prevention)
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS file_uploads (
                file_hash TEXT PRIMARY KEY,
                upload_id TEXT NOT NULL,
                filename TEXT NOT NULL,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
            )
            """)
            
            # 7. Users (Authentication & RBAC)
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                user_id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                role TEXT NOT NULL
            )
            """)

            # 8. Global Correlations
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS global_correlations (
                ioc_value TEXT PRIMARY KEY,
                correlation_data TEXT NOT NULL
            )
            """)

            conn.commit()
            conn.close()
            print(f"Initialized SQLite SIEM Store at {self.db_path}")
        except Exception as e:
            print(f"Error initializing SQLite: {e}")
            traceback.print_exc()

    def store_log_chunk(self, chunk_id, upload_id, source_file, raw_text):
        try:
            conn = self.get_connection()
            cursor = conn.cursor()
            cursor.execute("""
            INSERT OR IGNORE INTO log_chunks (chunk_id, upload_id, source_file, raw_text)
            VALUES (?, ?, ?, ?)
            """, (chunk_id, upload_id, source_file, raw_text))
            conn.commit()
            conn.close()
        except Exception as e:
            print(f"Error storing log chunk in SQLite: {e}")

    def store_ioc(self, ioc_value, ioc_type, chunk_id, context_role="UNKNOWN"):
        try:
            conn = self.get_connection()
            cursor = conn.cursor()
            # Insert into global ledger
            cursor.execute("""
            INSERT OR IGNORE INTO extracted_iocs (ioc_value, ioc_type)
            VALUES (?, ?)
            """, (ioc_value, ioc_type))
            
            # Insert into mapping
            cursor.execute("""
            INSERT OR IGNORE INTO chunk_ioc_mapping (chunk_id, ioc_value, context_role)
            VALUES (?, ?, ?)
            """, (chunk_id, ioc_value, context_role))
            
            conn.commit()
            conn.close()
        except Exception as e:
            print(f"Error storing IOC in SQLite: {e}")

    def update_ioc_role(self, chunk_id, ioc_value, context_role):
        try:
            conn = self.get_connection()
            cursor = conn.cursor()
            cursor.execute("""
            UPDATE chunk_ioc_mapping 
            SET context_role = ? 
            WHERE chunk_id = ? AND ioc_value = ?
            """, (context_role, chunk_id, ioc_value))
            conn.commit()
            conn.close()
        except Exception as e:
            print(f"Error updating IOC role in SQLite: {e}")

    def store_mitre_mapping(self, chunk_id, technique_id, tactic, confidence):
        try:
            conn = self.get_connection()
            cursor = conn.cursor()
            cursor.execute("""
            INSERT INTO chunk_mitre_mapping (chunk_id, technique_id, tactic, confidence)
            VALUES (?, ?, ?, ?)
            """, (chunk_id, technique_id, tactic, confidence))
            conn.commit()
            conn.close()
        except Exception as e:
            print(f"Error storing MITRE in SQLite: {e}")

    def store_timeline_event(self, chunk_id, event_timestamp, event_description, severity):
        try:
            conn = self.get_connection()
            cursor = conn.cursor()
            cursor.execute("""
            INSERT INTO timeline_events (chunk_id, event_timestamp, event_description, severity)
            VALUES (?, ?, ?, ?)
            """, (chunk_id, event_timestamp, event_description, severity))
            conn.commit()
            conn.close()
        except Exception as e:
            print(f"Error storing timeline event in SQLite: {e}")

    def check_file_exists(self, file_hash):
        try:
            conn = self.get_connection()
            cursor = conn.cursor()
            cursor.execute("SELECT upload_id FROM file_uploads WHERE file_hash = ?", (file_hash,))
            row = cursor.fetchone()
            conn.close()
            return row["upload_id"] if row else None
        except Exception as e:
            print(f"Error checking file_hash: {e}")
            return None

    def store_file_upload(self, file_hash, upload_id, filename):
        try:
            conn = self.get_connection()
            cursor = conn.cursor()
            cursor.execute("""
            INSERT INTO file_uploads (file_hash, upload_id, filename)
            VALUES (?, ?, ?)
            """, (file_hash, upload_id, filename))
            conn.commit()
            conn.close()
        except Exception as e:
            print(f"Error storing file upload: {e}")

    def create_user(self, username, password_hash, role):
        try:
            conn = self.get_connection()
            cursor = conn.cursor()
            cursor.execute("""
            INSERT INTO users (username, password_hash, role)
            VALUES (?, ?, ?)
            """, (username, password_hash, role))
            conn.commit()
            conn.close()
            return True
        except sqlite3.IntegrityError:
            return False
        except Exception as e:
            print(f"Error creating user: {e}")
            return False

    def get_user_by_username(self, username):
        try:
            conn = self.get_connection()
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM users WHERE username = ?", (username,))
            row = cursor.fetchone()
            conn.close()
            return dict(row) if row else None
        except Exception as e:
            print(f"Error getting user: {e}")
            return None

    def get_all_extracted_iocs(self):
        try:
            conn = self.get_connection()
            cursor = conn.cursor()
            cursor.execute("SELECT ioc_value, ioc_type FROM extracted_iocs")
            rows = cursor.fetchall()
            conn.close()
            
            iocs = {
                "ips": [],
                "domains": [],
                "hashes": [],
                "cves": [],
                "emails": []
            }
            for row in rows:
                val = row["ioc_value"]
                t = row["ioc_type"]
                if t == "ip": iocs["ips"].append(val)
                elif t == "domain": iocs["domains"].append(val)
                elif t == "hash": iocs["hashes"].append(val)
                elif t == "cve": iocs["cves"].append(val)
                elif t == "email": iocs["emails"].append(val)
                
            return iocs
        except Exception as e:
            print(f"Error getting all IOCs: {e}")
            return {}

    def store_global_correlation(self, correlation_dict):
        import json
        try:
            conn = self.get_connection()
            cursor = conn.cursor()
            cursor.execute("DELETE FROM global_correlations")
            for ioc_value, data in correlation_dict.items():
                cursor.execute("""
                INSERT INTO global_correlations (ioc_value, correlation_data)
                VALUES (?, ?)
                """, (ioc_value, json.dumps(data)))
            conn.commit()
            conn.close()
        except Exception as e:
            print(f"Error storing global correlations: {e}")

    def get_global_correlation(self):
        import json
        try:
            conn = self.get_connection()
            cursor = conn.cursor()
            cursor.execute("SELECT ioc_value, correlation_data FROM global_correlations")
            rows = cursor.fetchall()
            conn.close()
            return {row["ioc_value"]: json.loads(row["correlation_data"]) for row in rows}
        except Exception as e:
            print(f"Error getting global correlations: {e}")
            return {}

