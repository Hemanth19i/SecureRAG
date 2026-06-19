# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in SecureRAG, please report it
privately. **Do not open a public issue for security reports.**

- Email the maintainer with the subject line `SECURITY: SecureRAG`.
- Include: affected component, reproduction steps, impact, and any PoC.
- Expect an acknowledgement within a few business days and a remediation
  timeline once the report is triaged.

Please give us reasonable time to remediate before any public disclosure.

## Automated Security Controls

Every push / PR runs in CI:
- **bandit** — static security analysis of the Python source (fails the build on
  medium-or-higher findings).
- **pip-audit** — dependency CVE scanning against `server/requirements.txt`.

Run them locally:
```bash
cd server
bandit -r api intelligence rag eval app.py run_production.py wsgi.py --severity-level medium
pip-audit -r requirements.txt --ignore-vuln CVE-2026-45829 --ignore-vuln PYSEC-2025-217 --ignore-vuln CVE-2026-1839
```

## Security Response Headers

Set on every response via an `after_request` hook (toggle with
`SECURITY_HEADERS_ENABLED`):

| Header | Value | Purpose |
|---|---|---|
| `X-Content-Type-Options` | `nosniff` | Stop browsers MIME-sniffing responses. |
| `X-Frame-Options` | `DENY` | Block framing (clickjacking). |
| `Referrer-Policy` | `no-referrer` | Don't leak URLs in the `Referer` header. |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` | Force HTTPS (honoured by browsers over TLS). |
| `Content-Security-Policy` | `default-src 'self'; frame-ancestors 'none'` | Lock content sources. The API serves JSON and the SPA is a separate origin, so this does not affect the frontend. |

## Rate Limiting

Flask-Limiter applies a global default (`RATELIMIT_DEFAULT`, 200/min) plus a
stricter `/auth/login` limit (`RATELIMIT_LOGIN`, 5/min), layered on top of the
existing in-memory login throttle. Exceeding a limit returns `429` with a JSON
body. Storage is in-memory by default (`RATELIMIT_STORAGE_URI`); use Redis for
multi-process deployments.

## Bandit Suppressions (documented `# nosec`)

All suppressions are line-specific (`# nosec <ID>`), so new occurrences elsewhere
still fail the build. Verified with `--ignore-nosec` that each genuinely maps to
the finding it suppresses.

| Test | Locations | Why suppressed |
|---|---|---|
| **B608** (SQL string-build) | `correlator.py`, `sqlite_store.py` (5 sites) | Parameterized queries: only `?` placeholders and fixed, code-controlled column names are interpolated; every user value is bound via `cursor.execute(sql, params)`. No injection vector. |
| **B104** (bind 0.0.0.0) | `app.py`, `run_production.py` | Intentional bind for container/LAN deployment; configurable via `HOST`. Restrict at the reverse proxy in production. |
| **B310** (urllib urlopen) | `threat_intel.py` | Fixed `https://api.abuseipdb.com` endpoint; only the query string varies. No scheme/host injection. |

Low-severity findings (e.g. B110 defensive `try/except`) are reported but do not
fail the build (`--severity-level medium`).

## Dependency CVE Risk Register

### Remediated
| Package | CVE | Action |
|---|---|---|
| flask 3.0.3 → **3.1.3** | CVE-2026-27205 | Upgraded. (Not reachable anyway — we use JWT, not Flask `session` — but the bump is clean.) |
| python-dotenv 1.0.1 → **1.2.2** | CVE-2026-28684 | Upgraded. (Not reachable anyway — we only call `load_dotenv()` (read), never `set_key()`/`unset_key()` — but the bump is clean.) |

### Accepted with reasoned assessment (no clean upstream fix)
Each is **ignored in pip-audit with a documented justification**, not silently.

**chromadb 1.5.9 — CVE-2026-45829** (no fix released)
- *What it is:* pre-authentication remote code execution in ChromaDB's **HTTP
  server**, via a malicious model repository with `trust_remote_code=true` on the
  `/api/v2/.../collections` endpoint.
- *Reachability in SecureRAG:* **Not reachable.** We use the embedded
  `chromadb.PersistentClient` (in-process, local file store). We do **not** run
  the Chroma HTTP server, do **not** expose `/api/v2`, and never set
  `trust_remote_code`. The vulnerable code path is never invoked.
- *Residual risk:* effectively none for our embedded usage.
- *Revisit when:* we adopt ChromaDB client/server mode, **or** an upstream fix is
  published (re-run pip-audit without the ignore).

**transformers 4.57.6 — PYSEC-2025-217** (no fix released)
- *What it is:* RCE via deserialization of untrusted data during **X-CLIP
  checkpoint conversion** (parsing an attacker-supplied checkpoint/file).
- *Reachability in SecureRAG:* **Not reachable.** `transformers` is a transitive
  dependency of `sentence-transformers`, used only to load the fixed, trusted
  `all-MiniLM-L6-v2` model for embeddings. We never run X-CLIP checkpoint
  conversion or load untrusted checkpoints.
- *Residual risk:* effectively none for our inference-only usage.
- *Revisit when:* an upstream fix is published.

**transformers 4.57.6 — CVE-2026-1839** (fix: 5.0.0rc3)
- *What it is:* RCE in the `Trainer` class — `_load_rng_state()` calls
  `torch.load()` without `weights_only=True`, so a malicious `rng_state.pth`
  checkpoint can execute code.
- *Reachability in SecureRAG:* **Not reachable.** We perform inference only
  (embeddings); we never use the `transformers` `Trainer` or load RNG-state
  checkpoints.
- *Residual risk:* effectively none for our usage.
- *Why not fixed now:* the fix (`transformers>=5.0.0rc3`) is a pre-release major
  version that is incompatible with the pinned `sentence-transformers==2.7.0` and
  would break the embedding pipeline.
- *Revisit when:* `sentence-transformers` supports `transformers>=5`, or a
  backported fix lands on the 4.x line.
