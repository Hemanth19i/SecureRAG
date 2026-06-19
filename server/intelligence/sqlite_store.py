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
        # busy handling: `timeout` is the Python-driver wait for a locked DB;
        # PRAGMA busy_timeout enforces the same at the SQLite level. Both guard
        # against "database is locked" under concurrent writers (e.g. /upload
        # and /monitor/feed) instead of failing immediately.
        timeout_s = float(os.getenv("SQLITE_TIMEOUT_SECONDS", "30"))
        conn = sqlite3.connect(self.db_path, check_same_thread=False, timeout=timeout_s)
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA synchronous=NORMAL")
        conn.execute("PRAGMA foreign_keys=ON")
        conn.execute("PRAGMA busy_timeout=%d" % int(timeout_s * 1000))
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

            # 9. Cases (Case Management). snapshot_json holds a json.dumps()
            # of the investigation result captured at promote time, following
            # the JSON-in-TEXT precedent set by global_correlations.
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS cases (
                case_id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'OPEN',
                severity TEXT NOT NULL DEFAULT 'LOW',
                summary TEXT,
                query TEXT,
                snapshot_json TEXT,
                created_by TEXT NOT NULL,
                assigned_to TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
            """)
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_cases_status ON cases(status)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_cases_severity ON cases(severity)")

            # 10. Case Notes (child of cases; cascade requires foreign_keys=ON,
            # which get_connection() sets per-connection).
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS case_notes (
                note_id INTEGER PRIMARY KEY AUTOINCREMENT,
                case_id TEXT NOT NULL,
                author TEXT NOT NULL,
                body TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (case_id) REFERENCES cases(case_id) ON DELETE CASCADE
            )
            """)
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_notes_case ON case_notes(case_id)")

            # 10b. Case Audit Trail (append-only). The forensic spine of a case:
            # every create/note/status_change/assignment/evidence_linked event is
            # recorded with author + timestamp. Hard immutability is enforced by
            # the triggers below (UPDATE/DELETE raise), not just by convention.
            # No ON DELETE CASCADE: the trail is permanent even if a case row is
            # removed (and there is no case-delete path).
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS case_audit (
                audit_id INTEGER PRIMARY KEY AUTOINCREMENT,
                case_id TEXT NOT NULL,
                author TEXT NOT NULL,
                entry_type TEXT NOT NULL,
                content TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (case_id) REFERENCES cases(case_id)
            )
            """)
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_audit_case ON case_audit(case_id)")
            cursor.execute("""
            CREATE TRIGGER IF NOT EXISTS case_audit_no_update
            BEFORE UPDATE ON case_audit
            BEGIN SELECT RAISE(ABORT, 'case_audit is append-only'); END
            """)
            cursor.execute("""
            CREATE TRIGGER IF NOT EXISTS case_audit_no_delete
            BEFORE DELETE ON case_audit
            BEGIN SELECT RAISE(ABORT, 'case_audit is append-only'); END
            """)

            # 10c. Case Evidence (append-only forensic snapshots). Stores an
            # immutable copy of linked intelligence (snapshot of a /query result,
            # or a specific IOC/technique/event reference) captured at link time.
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS case_evidence (
                evidence_id INTEGER PRIMARY KEY AUTOINCREMENT,
                case_id TEXT NOT NULL,
                evidence_type TEXT NOT NULL,
                payload_json TEXT NOT NULL,
                linked_by TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (case_id) REFERENCES cases(case_id) ON DELETE CASCADE
            )
            """)
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_evidence_case ON case_evidence(case_id)")

            # 11. IOC Enrichment cache (Threat Intelligence). enrichment_data
            # holds the provider JSON; expires_at drives TTL + negative caching.
            # Independent of global_correlations (which is wiped per upload).
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS ioc_enrichment (
                ioc_value TEXT PRIMARY KEY,
                ioc_type TEXT,
                source TEXT,
                reputation_score INTEGER,
                abuse_confidence INTEGER,
                verdict TEXT,
                enrichment_data TEXT,
                status TEXT,
                fetched_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                expires_at DATETIME
            )
            """)
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_enrich_verdict ON ioc_enrichment(verdict)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_enrich_expires ON ioc_enrichment(expires_at)")

            # 12. Alerts (Real-Time Monitoring). alert_id is the monotonic poll
            # cursor; details holds the evidence JSON. Generated from existing
            # analysis outputs during ingestion.
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS alerts (
                alert_id INTEGER PRIMARY KEY AUTOINCREMENT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                severity TEXT NOT NULL,
                alert_type TEXT NOT NULL,
                title TEXT NOT NULL,
                ioc_value TEXT,
                technique_id TEXT,
                source TEXT,
                upload_id TEXT,
                details TEXT,
                acknowledged INTEGER DEFAULT 0
            )
            """)
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_alerts_created ON alerts(created_at)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_alerts_ack ON alerts(acknowledged)")

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

    def get_correlations_for_values(self, ioc_values):
        import json
        if not ioc_values:
            return {}
        try:
            conn = self.get_connection()
            cursor = conn.cursor()
            placeholders = ','.join(['?'] * len(ioc_values))
            cursor.execute(
                f"SELECT ioc_value, correlation_data FROM global_correlations WHERE ioc_value IN ({placeholders})",  # nosec B608 - '?' placeholders only; ioc_values bound as params
                ioc_values
            )
            rows = cursor.fetchall()
            conn.close()
            return {row["ioc_value"]: json.loads(row["correlation_data"]) for row in rows}
        except Exception as e:
            logger.error("Error getting correlations for values: %s", e)
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

    # --- Case Management -------------------------------------------------

    def create_case(self, case_id, title, created_by, severity="LOW", summary="",
                    query="", snapshot=None, assigned_to=None, conn=None):
        """Insert a case. snapshot (any JSON-serialisable object) is stored as
        json.dumps() in snapshot_json, mirroring store_global_correlation. Honours
        the conn= convention so callers can enlist it in a transaction()."""
        import json
        managed = conn is None
        own_conn = None
        try:
            if managed:
                own_conn = self.get_connection()
                conn = own_conn
            conn.execute("""
            INSERT INTO cases (case_id, title, severity, summary, query, snapshot_json, created_by, assigned_to)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                case_id, title, severity, summary, query,
                json.dumps(snapshot) if snapshot is not None else None,
                created_by, assigned_to,
            ))
            if managed:
                conn.commit()
        except Exception as e:
            logger.error("Error creating case: %s", e)
            if not managed:
                raise
        finally:
            if own_conn is not None:
                own_conn.close()

    def get_case(self, case_id):
        """Return one case with snapshot_json parsed back into a 'snapshot'
        object, or None if it doesn't exist."""
        import json
        try:
            conn = self.get_connection()
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM cases WHERE case_id = ?", (case_id,))
            row = cursor.fetchone()
            conn.close()
            if not row:
                return None
            case = dict(row)
            raw = case.pop("snapshot_json", None)
            case["snapshot"] = json.loads(raw) if raw else None
            return case
        except Exception as e:
            logger.error("Error getting case: %s", e)
            return None

    def get_cases(self, status=None, severity=None, assigned_to=None):
        """List cases (newest first), excluding the heavy snapshot payload.
        Optional filters are applied via parameterised WHERE clauses."""
        try:
            conn = self.get_connection()
            cursor = conn.cursor()
            clauses = []
            params = []
            if status:
                clauses.append("status = ?"); params.append(status)
            if severity:
                clauses.append("severity = ?"); params.append(severity)
            if assigned_to:
                clauses.append("assigned_to = ?"); params.append(assigned_to)
            where = (" WHERE " + " AND ".join(clauses)) if clauses else ""
            cursor.execute(
                "SELECT case_id, title, status, severity, summary, query, "  # nosec B608 - WHERE built from fixed clauses; values bound as params
                "created_by, assigned_to, created_at, updated_at "
                "FROM cases" + where + " ORDER BY updated_at DESC",
                params,
            )
            rows = cursor.fetchall()
            conn.close()
            return [dict(r) for r in rows]
        except Exception as e:
            logger.error("Error listing cases: %s", e)
            return []

    def update_case(self, case_id, status=None, severity=None, assigned_to=None,
                    title=None, conn=None):
        """Patch mutable case fields and bump updated_at. Only non-None args are
        written. Returns the number of rows affected (0 -> case not found).
        Honours the conn= convention for transaction() enlistment."""
        managed = conn is None
        own_conn = None
        try:
            if managed:
                own_conn = self.get_connection()
                conn = own_conn
            sets, params = [], []
            if status is not None:
                sets.append("status = ?"); params.append(status)
            if severity is not None:
                sets.append("severity = ?"); params.append(severity)
            if assigned_to is not None:
                sets.append("assigned_to = ?"); params.append(assigned_to)
            if title is not None:
                sets.append("title = ?"); params.append(title)
            if not sets:
                return 0
            sets.append("updated_at = CURRENT_TIMESTAMP")
            params.append(case_id)
            cur = conn.execute(
                "UPDATE cases SET " + ", ".join(sets) + " WHERE case_id = ?",  # nosec B608 - SET built from fixed field names; values bound as params
                params,
            )
            if managed:
                conn.commit()
            return cur.rowcount
        except Exception as e:
            logger.error("Error updating case: %s", e)
            if not managed:
                raise
            return 0
        finally:
            if own_conn is not None:
                own_conn.close()

    def add_case_note(self, case_id, author, body, conn=None):
        """Append a note to a case. Honours the conn= convention so it can be
        enlisted in a transaction()."""
        managed = conn is None
        own_conn = None
        try:
            if managed:
                own_conn = self.get_connection()
                conn = own_conn
            conn.execute("""
            INSERT INTO case_notes (case_id, author, body)
            VALUES (?, ?, ?)
            """, (case_id, author, body))
            if managed:
                conn.commit()
        except Exception as e:
            logger.error("Error adding case note: %s", e)
            if not managed:
                raise
        finally:
            if own_conn is not None:
                own_conn.close()

    def get_case_notes(self, case_id):
        """Return a case's notes, newest first."""
        try:
            conn = self.get_connection()
            cursor = conn.cursor()
            cursor.execute(
                "SELECT note_id, case_id, author, body, created_at "
                "FROM case_notes WHERE case_id = ? ORDER BY note_id DESC",
                (case_id,),
            )
            rows = cursor.fetchall()
            conn.close()
            return [dict(r) for r in rows]
        except Exception as e:
            logger.error("Error getting case notes: %s", e)
            return []

    # --- Case audit trail (append-only) -----------------------------------

    def add_case_audit(self, case_id, author, entry_type, content=None, conn=None):
        """Append one immutable audit entry. content may be a string (e.g. a
        note) or a JSON-serialisable object (e.g. {"field","from","to"} for a
        status_change); objects are stored as json.dumps(). There is
        deliberately NO update/delete counterpart — the table is append-only and
        DB triggers reject mutation. Honours the conn= transaction convention."""
        import json
        managed = conn is None
        own_conn = None
        try:
            if managed:
                own_conn = self.get_connection()
                conn = own_conn
            stored = content if isinstance(content, str) or content is None else json.dumps(content)
            conn.execute("""
            INSERT INTO case_audit (case_id, author, entry_type, content)
            VALUES (?, ?, ?, ?)
            """, (case_id, author, entry_type, stored))
            if managed:
                conn.commit()
        except Exception as e:
            logger.error("Error adding case audit entry: %s", e)
            if not managed:
                raise
        finally:
            if own_conn is not None:
                own_conn.close()

    def get_case_audit(self, case_id):
        """Return a case's full audit trail, oldest first (chronological).
        content is returned as stored; typed events carry a JSON string."""
        try:
            conn = self.get_connection()
            cursor = conn.cursor()
            cursor.execute(
                "SELECT audit_id, case_id, author, entry_type, content, created_at "
                "FROM case_audit WHERE case_id = ? ORDER BY audit_id ASC",
                (case_id,),
            )
            rows = cursor.fetchall()
            conn.close()
            return [dict(r) for r in rows]
        except Exception as e:
            logger.error("Error getting case audit: %s", e)
            return []

    # --- Case evidence (append-only snapshots) ----------------------------

    def add_case_evidence(self, case_id, evidence_type, payload, linked_by, conn=None):
        """Append an immutable evidence snapshot. payload (any JSON-serialisable
        object) is stored as json.dumps() in payload_json."""
        import json
        managed = conn is None
        own_conn = None
        try:
            if managed:
                own_conn = self.get_connection()
                conn = own_conn
            conn.execute("""
            INSERT INTO case_evidence (case_id, evidence_type, payload_json, linked_by)
            VALUES (?, ?, ?, ?)
            """, (case_id, evidence_type, json.dumps(payload), linked_by))
            if managed:
                conn.commit()
        except Exception as e:
            logger.error("Error adding case evidence: %s", e)
            if not managed:
                raise
        finally:
            if own_conn is not None:
                own_conn.close()

    def get_case_evidence(self, case_id):
        """Return a case's linked evidence, oldest first, with payload parsed."""
        import json
        try:
            conn = self.get_connection()
            cursor = conn.cursor()
            cursor.execute(
                "SELECT evidence_id, case_id, evidence_type, payload_json, linked_by, created_at "
                "FROM case_evidence WHERE case_id = ? ORDER BY evidence_id ASC",
                (case_id,),
            )
            rows = cursor.fetchall()
            conn.close()
            out = []
            for r in rows:
                rec = dict(r)
                raw = rec.pop("payload_json", None)
                rec["payload"] = json.loads(raw) if raw else None
                out.append(rec)
            return out
        except Exception as e:
            logger.error("Error getting case evidence: %s", e)
            return []

    # --- Threat Intelligence enrichment cache -----------------------------

    def store_ioc_enrichment(self, record, ttl_seconds, conn=None):
        """Upsert an enrichment record. expires_at = now + ttl_seconds (computed
        in SQLite so time authority matches CURRENT_TIMESTAMP). enrichment_data
        is JSON-encoded. Honours the conn= convention."""
        import json
        managed = conn is None
        own_conn = None
        try:
            if managed:
                own_conn = self.get_connection()
                conn = own_conn
            conn.execute("""
            INSERT OR REPLACE INTO ioc_enrichment
            (ioc_value, ioc_type, source, reputation_score, abuse_confidence,
             verdict, enrichment_data, status, fetched_at, expires_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, datetime('now', ?))
            """, (
                record.get("ioc_value"),
                record.get("ioc_type"),
                record.get("source"),
                record.get("reputation_score"),
                record.get("abuse_confidence"),
                record.get("verdict"),
                json.dumps(record.get("enrichment_data") or {}),
                record.get("status"),
                "%+d seconds" % int(ttl_seconds),
            ))
            if managed:
                conn.commit()
        except Exception as e:
            logger.error("Error storing IOC enrichment: %s", e)
            if not managed:
                raise
        finally:
            if own_conn is not None:
                own_conn.close()

    def get_ioc_enrichment(self, ioc_value):
        """Return a cached enrichment with enrichment_data parsed and a computed
        'expired' boolean (expires_at <= now), or None if absent."""
        import json
        try:
            conn = self.get_connection()
            cursor = conn.cursor()
            cursor.execute(
                "SELECT *, (expires_at IS NOT NULL AND expires_at <= CURRENT_TIMESTAMP) AS expired "
                "FROM ioc_enrichment WHERE ioc_value = ?",
                (ioc_value,),
            )
            row = cursor.fetchone()
            conn.close()
            if not row:
                return None
            rec = dict(row)
            raw = rec.pop("enrichment_data", None)
            rec["enrichment_data"] = json.loads(raw) if raw else {}
            rec["expired"] = bool(rec.get("expired"))
            return rec
        except Exception as e:
            logger.error("Error getting IOC enrichment: %s", e)
            return None

    # --- Alerts (Real-Time Monitoring) ------------------------------------

    def store_alert(self, alert, conn=None):
        """Insert one alert. details is JSON-encoded. Honours the conn=
        convention for transaction() enlistment."""
        import json
        managed = conn is None
        own_conn = None
        try:
            if managed:
                own_conn = self.get_connection()
                conn = own_conn
            conn.execute("""
            INSERT INTO alerts
            (severity, alert_type, title, ioc_value, technique_id, source, upload_id, details)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                alert.get("severity"),
                alert.get("alert_type"),
                alert.get("title"),
                alert.get("ioc_value"),
                alert.get("technique_id"),
                alert.get("source"),
                alert.get("upload_id"),
                json.dumps(alert.get("details") or {}),
            ))
            if managed:
                conn.commit()
        except Exception as e:
            logger.error("Error storing alert: %s", e)
            if not managed:
                raise
        finally:
            if own_conn is not None:
                own_conn.close()

    def get_alerts(self, since_id=0, limit=50):
        """Return alerts with alert_id > since_id, newest first, details parsed.
        since_id supports cursor-based delta polling; default returns latest."""
        import json
        try:
            conn = self.get_connection()
            cursor = conn.cursor()
            cursor.execute(
                "SELECT * FROM alerts WHERE alert_id > ? ORDER BY alert_id DESC LIMIT ?",
                (since_id, limit),
            )
            rows = cursor.fetchall()
            conn.close()
            out = []
            for row in rows:
                rec = dict(row)
                raw = rec.pop("details", None)
                rec["details"] = json.loads(raw) if raw else {}
                rec["acknowledged"] = bool(rec.get("acknowledged"))
                out.append(rec)
            return out
        except Exception as e:
            logger.error("Error getting alerts: %s", e)
            return []

    def ack_alert(self, alert_id, conn=None):
        """Mark one alert acknowledged. Idempotent: re-acking an existing row
        still matches (rowcount 1); a missing alert_id returns 0 so the API can
        404. Reuses the existing acknowledged column — no schema change. Honours
        the conn= convention for transaction() enlistment."""
        managed = conn is None
        own_conn = None
        try:
            if managed:
                own_conn = self.get_connection()
                conn = own_conn
            cur = conn.execute(
                "UPDATE alerts SET acknowledged = 1 WHERE alert_id = ?",
                (alert_id,),
            )
            if managed:
                conn.commit()
            return cur.rowcount
        except Exception as e:
            logger.error("Error acknowledging alert %s: %s", alert_id, e)
            if not managed:
                raise
            return 0
        finally:
            if own_conn is not None:
                own_conn.close()
