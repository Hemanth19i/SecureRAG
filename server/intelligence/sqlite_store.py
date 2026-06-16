import sqlite3
import os
import logging
import traceback
from contextlib import contextmanager

logger = logging.getLogger(__name__)

# Confidence/severity rank -> label, single source of truth shared by
# get_evidence_log and get_mitre_for_upload (both rank a text confidence
# column via the same CASE-based MAX() trick and need to map it back).
CONFIDENCE_RANK_LABEL = {3: "HIGH", 2: "MEDIUM", 1: "LOW", 0: "NONE"}

class SQLiteStore:
    def __init__(self, db_path="./securerag.db"):
        self.db_path = db_path
        self._init_db()

    def get_connection(self):
        conn = sqlite3.connect(self.db_path, check_same_thread=False)
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA synchronous=NORMAL")
        conn.execute("PRAGMA foreign_keys=ON")
        conn.row_factory = sqlite3.Row
        return conn

    @contextmanager
    def transaction(self):
        """Yield a single connection whose writes commit atomically.

        All work performed inside the ``with`` block shares one connection and
        one transaction: it commits on clean exit and rolls back if any
        exception propagates. Pass the yielded connection to the ``store_*``
        methods via their ``conn=`` argument so they enlist in this transaction
        instead of committing independently.
        """
        conn = self.get_connection()
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()

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
            logger.info("Initialized SQLite SIEM Store at %s", self.db_path)
        except Exception as e:
            logger.error("Error initializing SQLite: %s", e)
            traceback.print_exc()

    def store_log_chunk(self, chunk_id, upload_id, source_file, raw_text, conn=None):
        managed = conn is None
        own_conn = None
        try:
            if managed:
                own_conn = self.get_connection()
                conn = own_conn
            conn.execute("""
            INSERT OR IGNORE INTO log_chunks (chunk_id, upload_id, source_file, raw_text)
            VALUES (?, ?, ?, ?)
            """, (chunk_id, upload_id, source_file, raw_text))
            if managed:
                conn.commit()
        except Exception as e:
            logger.error("Error storing log chunk in SQLite: %s", e)
            if not managed:
                raise
        finally:
            if own_conn is not None:
                own_conn.close()

    def store_ioc(self, ioc_value, ioc_type, chunk_id, context_role="UNKNOWN", conn=None):
        managed = conn is None
        own_conn = None
        try:
            if managed:
                own_conn = self.get_connection()
                conn = own_conn
            # Insert into global ledger
            conn.execute("""
            INSERT OR IGNORE INTO extracted_iocs (ioc_value, ioc_type)
            VALUES (?, ?)
            """, (ioc_value, ioc_type))

            # Insert into mapping
            conn.execute("""
            INSERT OR IGNORE INTO chunk_ioc_mapping (chunk_id, ioc_value, context_role)
            VALUES (?, ?, ?)
            """, (chunk_id, ioc_value, context_role))

            if managed:
                conn.commit()
        except Exception as e:
            logger.error("Error storing IOC in SQLite: %s", e)
            if not managed:
                raise
        finally:
            if own_conn is not None:
                own_conn.close()

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
            logger.error("Error updating IOC role in SQLite: %s", e)

    def store_mitre_mapping(self, chunk_id, technique_id, tactic, confidence, conn=None):
        managed = conn is None
        own_conn = None
        try:
            if managed:
                own_conn = self.get_connection()
                conn = own_conn
            conn.execute("""
            INSERT INTO chunk_mitre_mapping (chunk_id, technique_id, tactic, confidence)
            VALUES (?, ?, ?, ?)
            """, (chunk_id, technique_id, tactic, confidence))
            if managed:
                conn.commit()
        except Exception as e:
            logger.error("Error storing MITRE in SQLite: %s", e)
            if not managed:
                raise
        finally:
            if own_conn is not None:
                own_conn.close()

    def store_timeline_event(self, chunk_id, event_timestamp, event_description, severity, conn=None):
        managed = conn is None
        own_conn = None
        try:
            if managed:
                own_conn = self.get_connection()
                conn = own_conn
            conn.execute("""
            INSERT INTO timeline_events (chunk_id, event_timestamp, event_description, severity)
            VALUES (?, ?, ?, ?)
            """, (chunk_id, event_timestamp, event_description, severity))
            if managed:
                conn.commit()
        except Exception as e:
            logger.error("Error storing timeline event in SQLite: %s", e)
            if not managed:
                raise
        finally:
            if own_conn is not None:
                own_conn.close()

    def check_file_exists(self, file_hash):
        try:
            conn = self.get_connection()
            cursor = conn.cursor()
            cursor.execute("SELECT upload_id FROM file_uploads WHERE file_hash = ?", (file_hash,))
            row = cursor.fetchone()
            conn.close()
            return row["upload_id"] if row else None
        except Exception as e:
            logger.error("Error checking file_hash: %s", e)
            return None

    def store_file_upload(self, file_hash, upload_id, filename, conn=None):
        managed = conn is None
        own_conn = None
        try:
            if managed:
                own_conn = self.get_connection()
                conn = own_conn
            conn.execute("""
            INSERT INTO file_uploads (file_hash, upload_id, filename)
            VALUES (?, ?, ?)
            """, (file_hash, upload_id, filename))
            if managed:
                conn.commit()
        except Exception as e:
            logger.error("Error storing file upload: %s", e)
            if not managed:
                raise
        finally:
            if own_conn is not None:
                own_conn.close()

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
            logger.error("Error creating user: %s", e)
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
            logger.error("Error getting user: %s", e)
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
                "emails": [],
                "ipv6": [],
                "urls": []
            }
            for row in rows:
                val = row["ioc_value"]
                t = row["ioc_type"]
                if t == "ip": iocs["ips"].append(val)
                elif t == "domain": iocs["domains"].append(val)
                elif t == "hash": iocs["hashes"].append(val)
                elif t == "cve": iocs["cves"].append(val)
                elif t == "email": iocs["emails"].append(val)
                elif t == "ipv6": iocs["ipv6"].append(val)
                elif t in ("url", "urls"): iocs["urls"].append(val)

            return iocs
        except Exception as e:
            logger.error("Error getting all IOCs: %s", e)
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
            logger.error("Error storing global correlations: %s", e)

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
            logger.error("Error getting global correlations: %s", e)
            return {}

    def get_dashboard_readouts(self):
        try:
            conn = self.get_connection()
            cursor = conn.cursor()

            cursor.execute("SELECT COUNT(*) AS n FROM file_uploads")
            docs_indexed = cursor.fetchone()["n"]

            cursor.execute("SELECT COUNT(*) AS n FROM extracted_iocs")
            iocs_extracted = cursor.fetchone()["n"]

            cursor.execute("SELECT COUNT(DISTINCT technique_id) AS n FROM chunk_mitre_mapping")
            mitre_mapped = cursor.fetchone()["n"]

            cursor.execute(
                "SELECT COUNT(DISTINCT chunk_id) AS n FROM chunk_mitre_mapping WHERE confidence = 'HIGH'"
            )
            threats_critical = cursor.fetchone()["n"]

            conn.close()
            return {
                "docs_indexed": docs_indexed,
                "iocs_extracted": iocs_extracted,
                "mitre_mapped": mitre_mapped,
                "threats_critical": threats_critical,
            }
        except Exception as e:
            logger.error("Error getting dashboard readouts: %s", e)
            return {"docs_indexed": 0, "iocs_extracted": 0, "mitre_mapped": 0, "threats_critical": 0}

    def get_evidence_log(self):
        try:
            conn = self.get_connection()
            cursor = conn.cursor()
            cursor.execute("""
            SELECT
              fu.upload_id,
              fu.filename,
              fu.timestamp AS ingested_at,
              COALESCE(ioc.cnt, 0) AS ioc_count,
              COALESCE(mitre.cnt, 0) AS mitre_count,
              COALESCE(mitre.max_sev_rank, 0) AS severity_rank
            FROM file_uploads fu
            LEFT JOIN (
              SELECT lc.upload_id, COUNT(DISTINCT cim.ioc_value) AS cnt
              FROM log_chunks lc
              JOIN chunk_ioc_mapping cim ON cim.chunk_id = lc.chunk_id
              GROUP BY lc.upload_id
            ) ioc ON ioc.upload_id = fu.upload_id
            LEFT JOIN (
              SELECT lc.upload_id,
                     COUNT(DISTINCT cmm.technique_id) AS cnt,
                     MAX(CASE cmm.confidence
                           WHEN 'HIGH' THEN 3
                           WHEN 'MEDIUM' THEN 2
                           WHEN 'LOW' THEN 1
                           ELSE 0 END) AS max_sev_rank
              FROM log_chunks lc
              JOIN chunk_mitre_mapping cmm ON cmm.chunk_id = lc.chunk_id
              GROUP BY lc.upload_id
            ) mitre ON mitre.upload_id = fu.upload_id
            ORDER BY fu.timestamp DESC
            """)
            rows = cursor.fetchall()
            conn.close()

            return [
                {
                    "upload_id": row["upload_id"],
                    "filename": row["filename"],
                    "severity": CONFIDENCE_RANK_LABEL.get(row["severity_rank"], "NONE"),
                    "ioc_count": row["ioc_count"],
                    "mitre_count": row["mitre_count"],
                    "ingested_at": row["ingested_at"],
                }
                for row in rows
            ]
        except Exception as e:
            logger.error("Error getting evidence log: %s", e)
            return []

    def get_upload_info(self, upload_id):
        try:
            conn = self.get_connection()
            cursor = conn.cursor()
            cursor.execute(
                "SELECT upload_id, filename, timestamp FROM file_uploads WHERE upload_id = ?",
                (upload_id,)
            )
            row = cursor.fetchone()
            conn.close()
            return dict(row) if row else None
        except Exception as e:
            logger.error("Error getting upload info: %s", e)
            return None

    def get_iocs_for_upload(self, upload_id):
        try:
            conn = self.get_connection()
            cursor = conn.cursor()
            cursor.execute("""
            SELECT DISTINCT e.ioc_value, e.ioc_type, m.context_role
            FROM chunk_ioc_mapping m
            JOIN log_chunks lc ON lc.chunk_id = m.chunk_id
            JOIN extracted_iocs e ON e.ioc_value = m.ioc_value
            WHERE lc.upload_id = ?
            """, (upload_id,))
            rows = cursor.fetchall()
            conn.close()
            return [
                {"ioc_value": row["ioc_value"], "ioc_type": row["ioc_type"], "context_role": row["context_role"]}
                for row in rows
            ]
        except Exception as e:
            logger.error("Error getting IOCs for upload: %s", e)
            return []

    def get_mitre_for_upload(self, upload_id):
        try:
            conn = self.get_connection()
            cursor = conn.cursor()
            cursor.execute("""
            SELECT cmm.technique_id, cmm.tactic,
                   MAX(CASE cmm.confidence
                         WHEN 'HIGH' THEN 3
                         WHEN 'MEDIUM' THEN 2
                         WHEN 'LOW' THEN 1
                         ELSE 0 END) AS conf_rank
            FROM chunk_mitre_mapping cmm
            JOIN log_chunks lc ON lc.chunk_id = cmm.chunk_id
            WHERE lc.upload_id = ?
            GROUP BY cmm.technique_id, cmm.tactic
            """, (upload_id,))
            rows = cursor.fetchall()
            conn.close()
            return [
                {
                    "technique_id": row["technique_id"],
                    "tactic": row["tactic"],
                    "confidence": CONFIDENCE_RANK_LABEL.get(row["conf_rank"], "NONE"),
                }
                for row in rows
            ]
        except Exception as e:
            logger.error("Error getting MITRE techniques for upload: %s", e)
            return []

    def get_co_occurring_iocs(self, upload_id):
        try:
            conn = self.get_connection()
            cursor = conn.cursor()
            cursor.execute("""
            SELECT DISTINCT m1.ioc_value AS ioc_a, m2.ioc_value AS ioc_b
            FROM chunk_ioc_mapping m1
            JOIN chunk_ioc_mapping m2
              ON m1.chunk_id = m2.chunk_id AND m1.ioc_value < m2.ioc_value
            JOIN log_chunks lc ON lc.chunk_id = m1.chunk_id
            WHERE lc.upload_id = ?
            """, (upload_id,))
            rows = cursor.fetchall()
            conn.close()
            return [{"ioc_a": row["ioc_a"], "ioc_b": row["ioc_b"]} for row in rows]
        except Exception as e:
            logger.error("Error getting co-occurring IOCs for upload: %s", e)
            return []
