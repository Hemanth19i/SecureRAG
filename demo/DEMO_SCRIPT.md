# SecureRAG — Demo Script

A ~10-minute guided walkthrough that exercises every major capability using the
bundled sample logs in [`sample_logs/`](sample_logs/).

## 0. Prerequisites

- Backend running on `http://localhost:5000`, frontend on `http://localhost:5173`
  (see the root [README](../README.md) → Setup).
- Log in as `admin` (password printed once at first backend start, or set via
  `DEFAULT_ADMIN_PASSWORD`).

The three sample logs tell one coherent intrusion story:

| File | Stage | What it demonstrates |
|---|---|---|
| `03_recon_portscan.log` | Reconnaissance | Port scan from `198.51.100.77` → attacker IP, T1046 |
| `01_ssh_bruteforce.log` | Initial access | SSH brute force from `203.0.113.45` ending in success → **CRITICAL** alert, privilege escalation, new user |
| `02_malware_c2_exfil.log` | Impact | Malware hash, C2 beacon to `198.51.100.23`, Log4Shell (CVE-2021-44228), 100 MB exfil |

> Tip: upload in the order recon → brute force → C2 to mirror the kill chain.

## 1. Ingest (INGEST view)

Upload each file from `demo/sample_logs/`. Each returns `chunks_stored`. The
pipeline runs automatically: chunk → embed → IOC extraction → MITRE mapping →
timeline → correlation → **alert generation**.

**Expected:** 3 successful uploads. Re-uploading the same file returns `409 File
already ingested` (SHA-256 dedup).

## 2. Dashboard (DASHBOARD view)

**Expected readouts:** DOCS.INDEXED, IOC.EXTRACTED (IPs, a hash, a CVE, a
domain, URLs), THREAT.CRITICAL > 0, MITRE.MAPPED > 0. The **live ALERT STREAM**
shows alerts including a **CRITICAL `BRUTE_FORCE_SUCCESS`** for `203.0.113.45`
plus `HIGH_RISK_IOC` entries for the C2 IP, malware hash, and attacker IP.

## 3. Investigation (INVESTIGATION view)

Ask:
- *"Was there a brute force attack and did it succeed?"*
- *"What malware or C2 activity is present?"*
- *"Was any data exfiltrated?"*

**Expected:** AI analysis (Gemini, or rule-based fallback if no key) with severity,
threats, recommendations, plus the IOCs, correlation, MITRE techniques, and
timeline used to answer.

## 4. IOC Explorer (IOC EXPLORER view)

**Expected:** indicators table. Click **enrich** on a public IP (e.g.
`198.51.100.23`) to pull AbuseIPDB reputation (requires `ABUSEIPDB_API_KEY`;
degrades gracefully otherwise).

## 5. MITRE / Timeline / Attack Graph

- **MITRE ATT&CK:** techniques such as Brute Force (T1110), Valid Accounts,
  Exploitation (Log4Shell), Exfiltration.
- **TIMELINE:** chronological reconstruction across recon → access → impact.
- **ATTACK GRAPH:** select an upload to view the node/edge relationship graph.

## 6. Cases (CASES view)

Create a case from the investigation (title/severity auto-fill from the snapshot).
Set status `IN_PROGRESS`, add an investigation note. Re-open to confirm it persists.

## 7. Alerts lifecycle

In the ALERT STREAM, click **ACK** on an alert. **Expected:** the row dims, the
UNACKED count drops, and the state persists across a page refresh.

## 8. RAG Eval (RAG EVAL view)

Enter a query (e.g. *"brute force ssh login"*), set TOP_K = 5, click **RETRIEVE**.

**Expected:** per-stage latency (embed / search / total ms) and a ranked table of
retrieved chunks with similarity, distance, source file, and evidence — isolating
the retrieval step from analysis.

## 9. Live ingestion (API)

Simulate a streaming agent:

```bash
curl -X POST http://localhost:5000/monitor/feed \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"source":"edr-agent-07","content":"2026-06-15 04:00:00 sshd: Failed password for admin from 203.0.113.45 port 22 ssh2\n2026-06-15 04:00:03 sshd: Accepted password for admin from 203.0.113.45 port 22 ssh2"}'
```

**Expected:** `{ "upload_id": ..., "chunks_stored": N, "alerts_created": N }`, and
new alerts appear in the dashboard stream within one poll interval (~10s).

## Reset (optional)

Stop the backend, delete `server/securerag.db*` and `server/chroma_store/`, then
restart for a clean slate.
