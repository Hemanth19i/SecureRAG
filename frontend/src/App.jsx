import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence, animate, useInView, useReducedMotion } from "framer-motion";
import {
  LayoutDashboard,
  UploadCloud,
  Search,
  Fingerprint,
  Grid3x3,
  Clock,
  FileText,
  Database,
  Network,
  Crosshair,
  Menu,
  X,
  ArrowRight,
  AlertTriangle,
  Lock,
} from "lucide-react";

/* ================================================================== */
/*  Config                                                            */
/* ================================================================== */
const API = import.meta.env.VITE_API_BASE_URL || "/api";
const ENV = (import.meta.env.MODE || "development").toUpperCase();
const EASE = [0.16, 1, 0.3, 1];

/* ================================================================== */
/*  Auth & API plumbing                                               */
/* ================================================================== */
const TOKEN_KEY = "srag_token";

async function apiFetch(path, { token = "", method = "GET", body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = new Error(res.status === 401 ? "Unauthorized" : `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

function useAuth() {
  const [token, setToken] = useState(() => {
    try { return localStorage.getItem(TOKEN_KEY) || ""; } catch { return ""; }
  });
  const login = useCallback(async (username, password) => {
    const data = await apiFetch("/auth/login", { method: "POST", body: { username, password } });
    setToken(data.access_token);
    try { localStorage.setItem(TOKEN_KEY, data.access_token); } catch { /* ignore */ }
    return data;
  }, []);
  const logout = useCallback(() => {
    setToken("");
    try { localStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ }
  }, []);
  return { token, login, logout };
}

function mapCorrelations(dict) {
  return Object.entries(dict || {}).map(([value, d]) => ({
    value,
    category: d.category || "—",
    role: d.role || "—",
    risk: d.risk_level || "LOW",
    files: Array.isArray(d.seen_in_files) ? d.seen_in_files.length : 0,
    freq: d.frequency ?? 0,
  }));
}

async function fetchCorrelations(token) {
  const data = await apiFetch("/correlate", { token, method: "POST" });
  return mapCorrelations(data.correlations);
}

async function fetchMitreMap(token, text) {
  const data = await apiFetch("/mitre-map", { token, method: "POST", body: { text } });
  const techniques = data.techniques || [];
  return {
    techniques,
    killChain: data.kill_chain || [],
    total: data.total_techniques ?? techniques.length,
  };
}

async function fetchTimeline(token, text) {
  const data = await apiFetch("/timeline", { token, method: "POST", body: { text } });
  const events = data.timeline || [];
  return { events, total: data.total_events ?? events.length };
}

async function fetchQuery(token, query) {
  return apiFetch("/query", { token, method: "POST", body: { query } });
}

/* ================================================================== */
/*  Severity — single source of truth (colours used ONLY on severity) */
/* ================================================================== */
const SEVERITY_COLORS = { critical: "#ff4444", high: "#ff8c42", medium: "#ffd700", low: "#58a6ff" };
function severityColor(level) {
  return SEVERITY_COLORS[String(level).toLowerCase()] || "#7d8590";
}

/* ================================================================== */
/*  System control — navigation                                       */
/* ================================================================== */
const NAV = [
  { id: "dashboard", label: "DASHBOARD", icon: LayoutDashboard },
  { id: "upload", label: "INGEST", icon: UploadCloud },
  { id: "investigation", label: "INVESTIGATION", icon: Search },
  { id: "ioc", label: "IOC EXPLORER", icon: Fingerprint },
  { id: "mitre", label: "MITRE ATT&CK", icon: Grid3x3 },
  { id: "timeline", label: "TIMELINE", icon: Clock },
  { id: "reports", label: "REPORTS", icon: FileText },
];
const NAV_BY_ID = Object.fromEntries(NAV.map((n) => [n.id, n]));

/* ================================================================== */
/*  Mock data                                                         */
/* ================================================================== */
const READOUTS = [
  { id: "docs", label: "DOCS.INDEXED", value: 1287, delta: "+12%", up: true },
  { id: "ioc", label: "IOC.EXTRACTED", value: 4892, delta: "+318", up: true },
  { id: "crit", label: "THREAT.CRITICAL", value: 17, delta: "+3", up: true, critical: true },
  { id: "mitre", label: "MITRE.MAPPED", value: 38, delta: "+5", up: true },
];

const EVIDENCE = [
  { id: "E-7741", doc: "auth_ssh_2026-06-14.log", severity: "critical", iocs: 42, mitre: 6, ts: "06-14 02:11:44" },
  { id: "E-7738", doc: "firewall_edge_egress.csv", severity: "high", iocs: 28, mitre: 4, ts: "06-14 01:53:02" },
  { id: "E-7733", doc: "dns_exfil_capture.log", severity: "high", iocs: 19, mitre: 3, ts: "06-14 01:30:18" },
  { id: "E-7729", doc: "endpoint_av_quarantine.txt", severity: "medium", iocs: 11, mitre: 2, ts: "06-14 00:58:07" },
  { id: "E-7724", doc: "vpn_session_audit.log", severity: "low", iocs: 6, mitre: 1, ts: "06-13 23:12:55" },
  { id: "E-7719", doc: "web_access_proxy.log", severity: "medium", iocs: 14, mitre: 2, ts: "06-13 22:40:31" },
];

const MODULES = [
  { id: "ingest", label: "INGEST PIPELINE", icon: Database, code: "MOD.01" },
  { id: "correlate", label: "CORRELATION ENGINE", icon: Network, code: "MOD.02" },
  { id: "mitre", label: "MITRE MAPPER", icon: Crosshair, code: "MOD.03" },
  { id: "report", label: "REPORT BUILDER", icon: FileText, code: "MOD.04" },
];

/* Telemetry signal (deterministic) */
const DETECTED = [0.16, 0.3, 0.26, 0.48, 0.4, 0.64, 0.55, 0.8, 0.69, 0.92, 0.6, 0.82];
const BASELINE = [0.3, 0.28, 0.31, 0.29, 0.33, 0.3, 0.32, 0.31, 0.34, 0.3, 0.33, 0.31];

/* ================================================================== */
/*  Live time (paused when tab hidden / reduced motion)               */
/* ================================================================== */
const pad = (x) => String(x).padStart(2, "0");
function useTick() {
  const reduce = useReducedMotion();
  const [n, setN] = useState(0);
  useEffect(() => {
    if (reduce) return;
    let id = null;
    const start = () => { if (!id) id = setInterval(() => setN((x) => x + 1), 1000); };
    const stop = () => { if (id) { clearInterval(id); id = null; } };
    const onVis = () => (document.hidden ? stop() : start());
    start();
    document.addEventListener("visibilitychange", onVis);
    return () => { stop(); document.removeEventListener("visibilitychange", onVis); };
  }, [reduce]);
  return n;
}
function fmtClock(d) { return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`; }
function fmtUptime(s) { return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`; }

/* ================================================================== */
/*  Count-up readout value (starts on scroll-in)                      */
/* ================================================================== */
function Counter({ value }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-8% 0px" });
  const reduce = useReducedMotion();
  const [d, setD] = useState(0);
  useEffect(() => {
    if (reduce || !inView) return;
    const c = animate(0, value, { duration: 1.1, ease: "easeOut", onUpdate: (v) => setD(v) });
    return () => c.stop();
  }, [inView, value, reduce]);
  return <span ref={ref}>{Math.round(reduce ? value : d).toLocaleString()}</span>;
}

/* ================================================================== */
/*  Word-wipe headline                                                */
/* ================================================================== */
function WordWipe({ text, delay = 0 }) {
  const reduce = useReducedMotion();
  if (reduce) return <>{text}</>;
  const words = text.split(" ");
  return (
    <motion.span
      style={{ display: "inline" }}
      initial="hidden"
      animate="show"
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.12, delayChildren: delay } } }}
    >
      {words.map((w, i) => (
        <span className="ww-mask" key={i}>
          <motion.span
            className="ww-word"
            variants={{ hidden: { y: "110%" }, show: { y: 0, transition: { duration: 0.7, ease: EASE } } }}
          >
            {w}
          </motion.span>
          {i < words.length - 1 ? " " : ""}
        </span>
      ))}
    </motion.span>
  );
}

/* ================================================================== */
/*  System label  ( > TITLE · NN · STATUS )                           */
/* ================================================================== */
function SysLabel({ title, index, status }) {
  return (
    <span className="syslabel">
      <span className="g">&gt;</span> {title} <span className="dim">·</span> {index}
      {status && <> <span className="g">· {status}</span></>}
    </span>
  );
}

/* ================================================================== */
/*  Telemetry graph                                                   */
/* ================================================================== */
const PLOT = { w: 480, h: 210, l: 30, r: 14, t: 16, b: 26 };
const IW = PLOT.w - PLOT.l - PLOT.r;
const IH = PLOT.h - PLOT.t - PLOT.b;
const gx = (i, arr) => PLOT.l + (i / (arr.length - 1)) * IW;
const gy = (v) => PLOT.t + (1 - v) * IH;
const toPath = (arr) => arr.map((v, i) => `${i === 0 ? "M" : "L"} ${gx(i, arr).toFixed(1)} ${gy(v).toFixed(1)}`).join(" ");

function Telemetry() {
  const reduce = useReducedMotion();
  const detPath = toPath(DETECTED);
  const basePath = toPath(BASELINE);
  const last = DETECTED.length - 1;
  const area = `${detPath} L ${gx(last, DETECTED).toFixed(1)} ${gy(0).toFixed(1)} L ${gx(0, DETECTED).toFixed(1)} ${gy(0).toFixed(1)} Z`;
  const yticks = [1, 0.75, 0.5, 0.25, 0];
  const draw = (delay, dur) =>
    reduce ? { initial: { pathLength: 1 }, animate: { pathLength: 1 } } : { initial: { pathLength: 0 }, animate: { pathLength: 1 }, transition: { duration: dur, delay, ease: EASE } };

  return (
    <div className="telemetry">
      <div className="tele-head">
        <SysLabel title="THREAT TELEMETRY" index="01" status="LIVE" />
        <span className="tele-legend mono">
          <span><span className="g">—</span> DETECTED</span>
          <span><span className="dim">⋯</span> BASELINE</span>
        </span>
      </div>
      <svg viewBox={`0 0 ${PLOT.w} ${PLOT.h}`} role="img" aria-label="Threat activity telemetry, detected signal against baseline">
        <defs>
          <linearGradient id="tele-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#00ff88" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#00ff88" stopOpacity="0" />
          </linearGradient>
        </defs>
        {yticks.map((v) => (
          <g key={v}>
            <line x1={PLOT.l} y1={gy(v)} x2={PLOT.w - PLOT.r} y2={gy(v)} stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
            <text x={PLOT.l - 8} y={gy(v) + 3} textAnchor="end" className="tele-axis">{v.toFixed(2)}</text>
          </g>
        ))}
        <motion.path
          d={area}
          fill="url(#tele-fill)"
          initial={reduce ? { opacity: 1 } : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: reduce ? 0 : 0.9 }}
        />
        <motion.path d={basePath} fill="none" stroke="#484f58" strokeWidth="1.25" strokeDasharray="2 4" {...draw(reduce ? 0 : 1.0, 1.0)} />
        <motion.path d={detPath} fill="none" stroke="#00ff88" strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" {...draw(reduce ? 0 : 0.9, 1.4)} />
      </svg>
    </div>
  );
}

/* ================================================================== */
/*  System masthead                                                   */
/* ================================================================== */
function Masthead() {
  const reduce = useReducedMotion();
  return (
    <section className="masthead">
      <span className="stamp mono">[ x:00 ]</span>
      <div className="dotbar">
        <span className="cap mono">+</span>
        <span className="dotbar-txt mono">SECURERAG / THREAT-INTEL</span>
        <motion.span
          className="lead"
          initial={reduce ? false : { scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.8, ease: EASE }}
        />
        <span className="dotbar-txt mono"><span className="g">v3.0</span></span>
        <span className="cap mono">+</span>
      </div>

      <div className="masthead-grid">
        <h1 className="mega"><WordWipe text="THREAT INTELLIGENCE" delay={0.25} /></h1>
        <motion.div
          className="hazard"
          initial={reduce ? false : { opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: reduce ? 0 : 0.7, ease: EASE }}
        >
          <span className="hazard-stripes" aria-hidden="true" />
          <span className="hazard-label mono">// LIVE OPERATIONS · OPERATOR EYES ONLY</span>
        </motion.div>
        <div className="masthead-right">
          <Telemetry />
        </div>
      </div>
    </section>
  );
}

/* ================================================================== */
/*  Instrument cluster                                                */
/* ================================================================== */
function InstrumentCluster() {
  const reduce = useReducedMotion();
  useTick(); // drives the live refresh clock
  const now = new Date();
  return (
    <section className="panel cluster">
      <span className="stamp mono">[ x:01 ]</span>
      <div className="panel-head">
        <SysLabel title="SYSTEM READOUT" index="04" status="LIVE" />
        <span className="refresh mono">UPLINK {API} · LAST.REFRESH {fmtClock(now)}</span>
      </div>
      <motion.div
        className="readouts"
        initial="hidden"
        animate="show"
        variants={{ hidden: {}, show: { transition: reduce ? {} : { staggerChildren: 0.07, delayChildren: 0.9 } } }}
      >
        {READOUTS.map((r) => (
          <motion.div
            className="readout"
            key={r.id}
            variants={reduce ? { hidden: { opacity: 1 }, show: { opacity: 1 } } : { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } } }}
          >
            <span className="readout-label mono">{r.label}</span>
            <span className={`readout-value mono${r.critical ? " crit" : ""}`}><Counter value={r.value} /></span>
            <span className="readout-delta mono"><span className="tick">{r.up ? "▲" : "▾"}</span> {r.delta}</span>
          </motion.div>
        ))}
      </motion.div>
    </section>
  );
}

/* ================================================================== */
/*  Severity pill                                                     */
/* ================================================================== */
function Sev({ level }) {
  const c = severityColor(level);
  return (
    <span className="sev mono" style={{ color: c, background: `${c}1f`, borderColor: `${c}40` }}>
      {String(level).toUpperCase()}
    </span>
  );
}

/* ================================================================== */
/*  Evidence log                                                      */
/* ================================================================== */
function EvidenceLog() {
  const reduce = useReducedMotion();
  return (
    <motion.section
      className="panel"
      {...(reduce ? {} : { initial: { opacity: 0, y: 16 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, margin: "-10% 0px" }, transition: { duration: 0.6, ease: EASE } })}
    >
      <span className="stamp mono">[ x:02 ]</span>
      <div className="panel-head">
        <SysLabel title="EVIDENCE LOG" index="06" status="LIVE" />
        <span className="refresh mono">{EVIDENCE.length} RECORDS</span>
      </div>
      <div className="ev-wrap">
        <table className="ev">
          <thead>
            <tr>
              <th>REF</th>
              <th>ARTIFACT</th>
              <th>SEV</th>
              <th className="num">IOC</th>
              <th className="num">ATT&amp;CK</th>
              <th>LOGGED</th>
            </tr>
          </thead>
          <motion.tbody
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-6% 0px" }}
            variants={{ hidden: {}, show: { transition: reduce ? {} : { staggerChildren: 0.06 } } }}
          >
            {EVIDENCE.map((r) => (
              <motion.tr
                key={r.id}
                variants={reduce ? { hidden: { opacity: 1 }, show: { opacity: 1 } } : { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE } } }}
              >
                <td className="mono ref">{r.id}</td>
                <td className="mono artifact">{r.doc}</td>
                <td><Sev level={r.severity} /></td>
                <td className="mono num">{r.iocs}</td>
                <td className="mono num">{r.mitre}</td>
                <td className="mono logged">{r.ts}</td>
              </motion.tr>
            ))}
          </motion.tbody>
        </table>
      </div>
    </motion.section>
  );
}

/* ================================================================== */
/*  Module control rows                                               */
/* ================================================================== */
function ModuleRows() {
  const reduce = useReducedMotion();
  return (
    <motion.section
      className="panel"
      {...(reduce ? {} : { initial: { opacity: 0, y: 16 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, margin: "-10% 0px" }, transition: { duration: 0.6, ease: EASE } })}
    >
      <span className="stamp mono">[ x:03 ]</span>
      <div className="panel-head">
        <SysLabel title="SYSTEM MODULES" index="04" />
      </div>
      <ul className="modlist">
        {MODULES.map((m) => {
          const Icon = m.icon;
          return (
            <li key={m.id}>
              <button type="button" className="modrow" aria-label={`Open ${m.label}`}>
                <span className="mod-ico" aria-hidden="true"><Icon size={15} /></span>
                <span className="mod-code mono">{m.code}</span>
                <span className="mod-label">{m.label}</span>
                <ArrowRight size={16} className="mod-arrow" aria-hidden="true" />
              </button>
            </li>
          );
        })}
      </ul>
    </motion.section>
  );
}

/* ================================================================== */
/*  Navigation rail                                                   */
/* ================================================================== */
function Rail({ active, onSelect, open, onClose }) {
  const reduce = useReducedMotion();
  const tick = useTick();
  const indicator = reduce ? { duration: 0 } : { type: "spring", stiffness: 520, damping: 40 };
  return (
    <nav className={`rail${open ? " open" : ""}`} aria-label="System control">
      <div className="rail-top">
        <span className="logo mono">[ <span className="logo-name">Secure<span className="g">RAG</span></span> ]</span>
        <button className="icon-btn rail-close" type="button" aria-label="Close navigation" onClick={onClose}><X size={18} /></button>
      </div>

      <ul className="rail-list">
        {NAV.map((n, i) => {
          const Icon = n.icon;
          const isActive = active === n.id;
          return (
            <li key={n.id}>
              <button type="button" className={`rail-item${isActive ? " active" : ""}`} aria-current={isActive ? "page" : undefined} onClick={() => onSelect(n.id)}>
                {isActive && <motion.span layoutId="rail-ind" className="rail-ind" transition={indicator} />}
                <span className="rail-idx mono">{pad(i + 1)}</span>
                <Icon size={15} aria-hidden="true" />
                <span className="rail-label mono">{n.label}</span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="rail-status">
        <div className="rail-status-row">
          <span className="mono dim">SYS.UPTIME</span>
          <span className="mono">{fmtUptime(51863 + tick)}</span>
        </div>
        <div className="rail-status-row">
          <span className="status-led mono"><span className="led" aria-hidden="true" />ONLINE</span>
          <span className="mono dim">{ENV}</span>
        </div>
      </div>
    </nav>
  );
}

/* ================================================================== */
/*  Views                                                             */
/* ================================================================== */
function Workstation() {
  return (
    <div className="ws">
      <Masthead />
      <InstrumentCluster />
      <div className="ws-grid">
        <EvidenceLog />
        <ModuleRows />
      </div>
      <footer className="footer mono">
        <span>© 2026 SecureRAG</span>
        <span>Developed by Hemanth A R</span>
      </footer>
    </div>
  );
}

/* ================================================================== */
/*  IOC Explorer — live data from POST /correlate                     */
/* ================================================================== */
function LoginGate({ onLogin }) {
  const [u, setU] = useState("");
  const [p, setP] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      await onLogin(u, p);
    } catch (e2) {
      setErr(e2.status === 401 ? "Invalid credentials" : (e2.message || "Login failed"));
    } finally {
      setBusy(false);
    }
  };
  return (
    <form className="ioc-login" onSubmit={submit}>
      <p className="mono load-msg"><Lock size={13} aria-hidden="true" /> AUTHENTICATION REQUIRED — connect an ADMIN or ANALYST session.</p>
      <div className="ioc-fields">
        <input className="ioc-input mono" placeholder="username" value={u} onChange={(e) => setU(e.target.value)} autoComplete="username" aria-label="Username" />
        <input className="ioc-input mono" type="password" placeholder="password" value={p} onChange={(e) => setP(e.target.value)} autoComplete="current-password" aria-label="Password" />
        <button className="ioc-btn mono" type="submit" disabled={busy || !u || !p}>{busy ? "…" : "CONNECT"}</button>
      </div>
      {err && <p className="mono ioc-err"><AlertTriangle size={13} aria-hidden="true" /> {err}</p>}
    </form>
  );
}

function IOCExplorer() {
  const { token, login, logout } = useAuth();
  const [state, setState] = useState({ status: "idle", rows: [], error: "" });

  // The effect performs no synchronous setState — results are applied inside
  // the deferred promise handlers, and "loading" is derived below.
  useEffect(() => {
    if (!token) return;
    let active = true;
    fetchCorrelations(token).then(
      (rows) => { if (active) setState({ status: "ready", rows, error: "" }); },
      (e) => {
        if (!active) return;
        if (e.status === 401) { logout(); setState({ status: "idle", rows: [], error: "" }); }
        else setState({ status: "error", rows: [], error: e.message || "Request failed" });
      }
    );
    return () => { active = false; };
  }, [token, logout]);

  const retry = () => {
    if (!token) return;
    setState({ status: "loading", rows: [], error: "" });
    fetchCorrelations(token).then(
      (rows) => setState({ status: "ready", rows, error: "" }),
      (e) => {
        if (e.status === 401) { logout(); setState({ status: "idle", rows: [], error: "" }); }
        else setState({ status: "error", rows: [], error: e.message || "Request failed" });
      }
    );
  };

  const loading = token && (state.status === "idle" || state.status === "loading");

  return (
    <div className="ws">
      <section className="masthead">
        <div className="dotbar">
          <span className="cap mono">+</span>
          <span className="dotbar-txt mono">SECURERAG / IOC EXPLORER</span>
          <span className="lead" />
          <span className="dotbar-txt mono"><span className="g">v3.0</span></span>
          <span className="cap mono">+</span>
        </div>
        <h1 className="mega"><WordWipe text="IOC EXPLORER" delay={0.2} /></h1>
      </section>

      <section className="panel">
        <span className="stamp mono">[ x:01 ]</span>
        <div className="panel-head">
          <SysLabel title="CORRELATED INDICATORS" index="02" status={token ? "LIVE" : "LOCKED"} />
          {token && state.status === "ready" && <span className="refresh mono">{state.rows.length} INDICATORS</span>}
        </div>

        {!token && <LoginGate onLogin={login} />}

        {loading && (
          <p className="mono load-msg">// QUERYING CORRELATION ENGINE…</p>
        )}

        {token && state.status === "error" && (
          <div className="state-err">
            <p className="mono"><AlertTriangle size={14} aria-hidden="true" /> {state.error}</p>
            <button type="button" className="ioc-btn mono" onClick={retry}>RETRY</button>
          </div>
        )}

        {token && state.status === "ready" && state.rows.length === 0 && (
          <p className="mono load-msg">// NO CORRELATED INDICATORS YET — INGEST LOGS TO POPULATE.</p>
        )}

        {token && state.status === "ready" && state.rows.length > 0 && (
          <div className="ev-wrap">
            <table className="ev">
              <thead>
                <tr>
                  <th>INDICATOR</th>
                  <th>CATEGORY</th>
                  <th>ROLE</th>
                  <th>RISK</th>
                  <th className="num">FILES</th>
                  <th className="num">FREQ</th>
                </tr>
              </thead>
              <tbody>
                {state.rows.map((r) => (
                  <tr key={r.value}>
                    <td className="mono artifact" title={r.value}>{r.value}</td>
                    <td className="mono">{r.category}</td>
                    <td className="mono">{r.role}</td>
                    <td><Sev level={r.risk} /></td>
                    <td className="mono num">{r.files}</td>
                    <td className="mono num">{r.freq}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <footer className="footer mono">
        <span>© 2026 SecureRAG</span>
        <span>Developed by Hemanth A R</span>
      </footer>
    </div>
  );
}

/* ================================================================== */
/*  MITRE ATT&CK — live technique mapping from POST /mitre-map        */
/* ================================================================== */
function MitreView() {
  const { token, login, logout } = useAuth();
  const [text, setText] = useState("");
  const [state, setState] = useState({ status: "idle", techniques: [], killChain: [], total: 0, error: "" });

  // Submit-triggered (no auto-fetch effect needed — /mitre-map requires text).
  const analyze = () => {
    if (!token || !text.trim()) return;
    setState({ status: "loading", techniques: [], killChain: [], total: 0, error: "" });
    fetchMitreMap(token, text).then(
      (r) => setState({ status: "ready", techniques: r.techniques, killChain: r.killChain, total: r.total, error: "" }),
      (e) => {
        if (e.status === 401) { logout(); setState({ status: "idle", techniques: [], killChain: [], total: 0, error: "" }); }
        else setState({ status: "error", techniques: [], killChain: [], total: 0, error: e.message || "Request failed" });
      }
    );
  };

  return (
    <div className="ws">
      <section className="masthead">
        <div className="dotbar">
          <span className="cap mono">+</span>
          <span className="dotbar-txt mono">SECURERAG / MITRE ATT&amp;CK</span>
          <span className="lead" />
          <span className="dotbar-txt mono"><span className="g">v3.0</span></span>
          <span className="cap mono">+</span>
        </div>
        <h1 className="mega"><WordWipe text="MITRE ATT&CK" delay={0.2} /></h1>
      </section>

      <section className="panel">
        <span className="stamp mono">[ x:01 ]</span>
        <div className="panel-head">
          <SysLabel title="TECHNIQUE MAPPER" index="03" status={token ? "LIVE" : "LOCKED"} />
          {token && state.status === "ready" && <span className="refresh mono">{state.total} TECHNIQUES</span>}
        </div>

        {!token && <LoginGate onLogin={login} />}

        {token && (
          <div className="mitre-input">
            <textarea
              className="ioc-input mono mitre-textarea"
              placeholder="paste log text or analyst notes to map against ATT&CK techniques…"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={5}
              aria-label="Text to analyze for MITRE ATT&CK techniques"
            />
            <button type="button" className="ioc-btn mono" onClick={analyze} disabled={state.status === "loading" || !text.trim()}>
              {state.status === "loading" ? "…" : "ANALYZE"}
            </button>
          </div>
        )}

        {token && state.status === "loading" && (
          <p className="mono load-msg">// MAPPING ATT&amp;CK TECHNIQUES…</p>
        )}

        {token && state.status === "error" && (
          <div className="state-err">
            <p className="mono"><AlertTriangle size={14} aria-hidden="true" /> {state.error}</p>
            <button type="button" className="ioc-btn mono" onClick={analyze}>RETRY</button>
          </div>
        )}

        {token && state.status === "ready" && state.techniques.length === 0 && (
          <p className="mono load-msg">// NO TECHNIQUES DETECTED IN PROVIDED TEXT.</p>
        )}

        {token && state.status === "ready" && state.killChain.length > 0 && (
          <ol className="killchain" aria-label="ATT&CK kill chain order">
            {state.killChain.map((t, i) => (
              <li className="kc-step mono" key={`${t.technique}-${i}`}>
                <span className="kc-tactic">{t.tactic}</span>
                <span className="kc-tech dim">{t.technique}</span>
                {i < state.killChain.length - 1 && <ArrowRight size={12} className="kc-arrow" aria-hidden="true" />}
              </li>
            ))}
          </ol>
        )}

        {token && state.status === "ready" && state.techniques.length > 0 && (
          <div className="ev-wrap">
            <table className="ev">
              <thead>
                <tr>
                  <th>TECHNIQUE</th>
                  <th>NAME</th>
                  <th>TACTIC</th>
                  <th>CONFIDENCE</th>
                  <th>EVIDENCE</th>
                </tr>
              </thead>
              <tbody>
                {state.techniques.map((t, i) => (
                  <tr key={`${t.technique}-${i}`}>
                    <td className="mono artifact">{t.technique}</td>
                    <td className="mono">{t.name}</td>
                    <td className="mono">{t.tactic}</td>
                    <td><Sev level={t.confidence} /></td>
                    <td className="mono logged">{(t.evidence || []).join(", ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <footer className="footer mono">
        <span>© 2026 SecureRAG</span>
        <span>Developed by Hemanth A R</span>
      </footer>
    </div>
  );
}

/* ================================================================== */
/*  Timeline — chronological event reconstruction from POST /timeline */
/* ================================================================== */
function TimelineView() {
  const { token, login, logout } = useAuth();
  const [text, setText] = useState("");
  const [state, setState] = useState({ status: "idle", events: [], total: 0, error: "" });

  // Submit-triggered (no auto-fetch effect needed — /timeline requires text).
  const analyze = () => {
    if (!token || !text.trim()) return;
    setState({ status: "loading", events: [], total: 0, error: "" });
    fetchTimeline(token, text).then(
      (r) => setState({ status: "ready", events: r.events, total: r.total, error: "" }),
      (e) => {
        if (e.status === 401) { logout(); setState({ status: "idle", events: [], total: 0, error: "" }); }
        else setState({ status: "error", events: [], total: 0, error: e.message || "Request failed" });
      }
    );
  };

  return (
    <div className="ws">
      <section className="masthead">
        <div className="dotbar">
          <span className="cap mono">+</span>
          <span className="dotbar-txt mono">SECURERAG / TIMELINE</span>
          <span className="lead" />
          <span className="dotbar-txt mono"><span className="g">v3.0</span></span>
          <span className="cap mono">+</span>
        </div>
        <h1 className="mega"><WordWipe text="TIMELINE" delay={0.2} /></h1>
      </section>

      <section className="panel">
        <span className="stamp mono">[ x:01 ]</span>
        <div className="panel-head">
          <SysLabel title="EVENT RECONSTRUCTION" index="05" status={token ? "LIVE" : "LOCKED"} />
          {token && state.status === "ready" && <span className="refresh mono">{state.total} EVENTS</span>}
        </div>

        {!token && <LoginGate onLogin={login} />}

        {token && (
          <div className="mitre-input">
            <textarea
              className="ioc-input mono mitre-textarea"
              placeholder="paste log text to reconstruct a chronological event timeline…"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={5}
              aria-label="Text to analyze for timeline reconstruction"
            />
            <button type="button" className="ioc-btn mono" onClick={analyze} disabled={state.status === "loading" || !text.trim()}>
              {state.status === "loading" ? "…" : "ANALYZE"}
            </button>
          </div>
        )}

        {token && state.status === "loading" && (
          <p className="mono load-msg">// RECONSTRUCTING TIMELINE…</p>
        )}

        {token && state.status === "error" && (
          <div className="state-err">
            <p className="mono"><AlertTriangle size={14} aria-hidden="true" /> {state.error}</p>
            <button type="button" className="ioc-btn mono" onClick={analyze}>RETRY</button>
          </div>
        )}

        {token && state.status === "ready" && state.events.length === 0 && (
          <p className="mono load-msg">// NO TIMESTAMPED EVENTS FOUND IN PROVIDED TEXT.</p>
        )}

        {token && state.status === "ready" && state.events.length > 0 && (
          <div className="ev-wrap">
            <table className="ev">
              <thead>
                <tr>
                  <th>TIMESTAMP</th>
                  <th>EVENT TYPE</th>
                  <th>SEVERITY</th>
                  <th>DESCRIPTION</th>
                  <th>MITRE</th>
                </tr>
              </thead>
              <tbody>
                {/* events arrive pre-sorted chronologically from generate_timeline */}
                {state.events.map((e, i) => (
                  <tr key={`${e.timestamp}-${i}`}>
                    <td className="mono logged">{e.timestamp}</td>
                    <td className="mono">{e.event_type}</td>
                    <td><Sev level={e.severity} /></td>
                    <td className="mono">{e.description}</td>
                    <td className="mono artifact">{e.mitre_technique}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <footer className="footer mono">
        <span>© 2026 SecureRAG</span>
        <span>Developed by Hemanth A R</span>
      </footer>
    </div>
  );
}

/* ================================================================== */
/*  Investigation — composite threat analysis from POST /query        */
/* ================================================================== */
function InvestigationView() {
  const { token, login, logout } = useAuth();
  const [query, setQuery] = useState("");
  const [state, setState] = useState({ status: "idle", result: null, error: "" });

  const analyze = () => {
    if (!token || !query.trim()) return;
    setState({ status: "loading", result: null, error: "" });
    fetchQuery(token, query).then(
      (result) => setState({ status: "ready", result, error: "" }),
      (e) => {
        if (e.status === 401) { logout(); setState({ status: "idle", result: null, error: "" }); }
        else setState({ status: "error", result: null, error: e.message || "Request failed" });
      }
    );
  };

  const result = state.result;
  const analysis = result?.analysis;
  const analysisFailed = !!analysis?.error;
  const iocRows = Object.entries(result?.iocs || {}).flatMap(([type, values]) =>
    type === "error" ? [] : (values || []).map((v) => ({ type, value: v }))
  );
  const correlationRows = mapCorrelations(result?.correlation?.details);
  const insights = result?.correlation?.analyst_insights || [];
  const techniques = result?.mitre?.techniques || [];
  const killChain = result?.mitre?.kill_chain || [];
  const events = result?.timeline?.events || [];

  return (
    <div className="ws">
      <section className="masthead">
        <div className="dotbar">
          <span className="cap mono">+</span>
          <span className="dotbar-txt mono">SECURERAG / INVESTIGATION</span>
          <span className="lead" />
          <span className="dotbar-txt mono"><span className="g">v3.0</span></span>
          <span className="cap mono">+</span>
        </div>
        <h1 className="mega"><WordWipe text="INVESTIGATION" delay={0.2} /></h1>
      </section>

      <section className="panel">
        <span className="stamp mono">[ x:01 ]</span>
        <div className="panel-head">
          <SysLabel title="ANALYSIS WORKSTATION" index="07" status={token ? "LIVE" : "LOCKED"} />
          {token && state.status === "ready" && (
            <span className="refresh mono">{result?.chunks_used ?? 0} CHUNKS QUERIED</span>
          )}
        </div>

        {!token && <LoginGate onLogin={login} />}

        {token && (
          <div className="ioc-fields" style={{ marginBottom: "var(--space-5)" }}>
            <input
              className="ioc-input mono"
              placeholder="ask a question of the ingested logs…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") analyze(); }}
              aria-label="Investigation query"
            />
            <button type="button" className="ioc-btn mono" onClick={analyze} disabled={state.status === "loading" || !query.trim()}>
              {state.status === "loading" ? "…" : "ANALYZE"}
            </button>
          </div>
        )}

        {token && state.status === "loading" && (
          <p className="mono load-msg">// RETRIEVING CONTEXT &amp; RUNNING THREAT ANALYSIS…</p>
        )}

        {token && state.status === "error" && (
          <div className="state-err">
            <p className="mono"><AlertTriangle size={14} aria-hidden="true" /> {state.error}</p>
            <button type="button" className="ioc-btn mono" onClick={analyze}>RETRY</button>
          </div>
        )}

        {token && state.status === "ready" && result.chunks_used === 0 && (
          <p className="mono load-msg">// NO RELEVANT LOG DATA FOUND FOR THIS QUERY.</p>
        )}

        {token && state.status === "ready" && result.chunks_used > 0 && (
          <>
            {analysisFailed ? (
              <div className="state-err">
                <p className="mono"><AlertTriangle size={14} aria-hidden="true" /> Analysis engine returned an invalid response: {analysis.error}</p>
              </div>
            ) : (
              <>
                <p className="mono">{analysis?.answer}</p>
                <p className="mono" style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", flexWrap: "wrap", marginTop: "var(--space-2)" }}>
                  <Sev level={analysis?.severity} />
                  <span className="dim">{analysis?.summary}</span>
                  {analysis?.analysis_method === "rule_based" && (
                    <span className="refresh mono">AI UNAVAILABLE — RULE-BASED FALLBACK</span>
                  )}
                </p>

                {analysis?.threats?.length > 0 && (
                  <ul className="mono">
                    {analysis.threats.map((t, i) => <li key={i}>{t}</li>)}
                  </ul>
                )}

                {analysis?.recommendations?.length > 0 && (
                  <ul className="mono">
                    {analysis.recommendations.map((r, i) => <li key={i}>{r}</li>)}
                  </ul>
                )}
              </>
            )}

            <p className="mono dim">// INDICATORS EXTRACTED</p>
            {iocRows.length === 0 ? (
              <p className="mono load-msg">// NO IOCS EXTRACTED FROM RETRIEVED CONTEXT.</p>
            ) : (
              <div className="ev-wrap">
                <table className="ev">
                  <thead><tr><th>TYPE</th><th>VALUE</th></tr></thead>
                  <tbody>
                    {iocRows.map((r, i) => (
                      <tr key={`${r.type}-${r.value}-${i}`}>
                        <td className="mono">{r.type}</td>
                        <td className="mono artifact" title={r.value}>{r.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <p className="mono dim">// CORRELATED INDICATORS</p>
            {insights.length > 0 && (
              <ul className="mono">
                {insights.map((ins, i) => <li key={i}>{ins}</li>)}
              </ul>
            )}
            {correlationRows.length === 0 ? (
              <p className="mono load-msg">// NO CORRELATION DATA AVAILABLE.</p>
            ) : (
              <div className="ev-wrap">
                <table className="ev">
                  <thead>
                    <tr><th>INDICATOR</th><th>CATEGORY</th><th>ROLE</th><th>RISK</th><th className="num">FILES</th><th className="num">FREQ</th></tr>
                  </thead>
                  <tbody>
                    {correlationRows.map((r) => (
                      <tr key={r.value}>
                        <td className="mono artifact" title={r.value}>{r.value}</td>
                        <td className="mono">{r.category}</td>
                        <td className="mono">{r.role}</td>
                        <td><Sev level={r.risk} /></td>
                        <td className="mono num">{r.files}</td>
                        <td className="mono num">{r.freq}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <p className="mono dim">// MITRE ATT&amp;CK</p>
            {techniques.length === 0 ? (
              <p className="mono load-msg">// NO TECHNIQUES DETECTED.</p>
            ) : (
              <>
                {killChain.length > 0 && (
                  <ol className="killchain" aria-label="ATT&CK kill chain order">
                    {killChain.map((t, i) => (
                      <li className="kc-step mono" key={`${t.technique}-${i}`}>
                        <span className="kc-tactic">{t.tactic}</span>
                        <span className="kc-tech dim">{t.technique}</span>
                        {i < killChain.length - 1 && <ArrowRight size={12} className="kc-arrow" aria-hidden="true" />}
                      </li>
                    ))}
                  </ol>
                )}
                <div className="ev-wrap">
                  <table className="ev">
                    <thead>
                      <tr><th>TECHNIQUE</th><th>NAME</th><th>TACTIC</th><th>CONFIDENCE</th><th>EVIDENCE</th></tr>
                    </thead>
                    <tbody>
                      {techniques.map((t, i) => (
                        <tr key={`${t.technique}-${i}`}>
                          <td className="mono artifact">{t.technique}</td>
                          <td className="mono">{t.name}</td>
                          <td className="mono">{t.tactic}</td>
                          <td><Sev level={t.confidence} /></td>
                          <td className="mono logged">{(t.evidence || []).join(", ")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            <p className="mono dim">// TIMELINE</p>
            {events.length === 0 ? (
              <p className="mono load-msg">// NO TIMESTAMPED EVENTS FOUND.</p>
            ) : (
              <div className="ev-wrap">
                <table className="ev">
                  <thead>
                    <tr><th>TIMESTAMP</th><th>EVENT TYPE</th><th>SEVERITY</th><th>DESCRIPTION</th><th>MITRE</th></tr>
                  </thead>
                  <tbody>
                    {events.map((e, i) => (
                      <tr key={`${e.timestamp}-${i}`}>
                        <td className="mono logged">{e.timestamp}</td>
                        <td className="mono">{e.event_type}</td>
                        <td><Sev level={e.severity} /></td>
                        <td className="mono">{e.description}</td>
                        <td className="mono artifact">{e.mitre_technique}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </section>

      <footer className="footer mono">
        <span>© 2026 SecureRAG</span>
        <span>Developed by Hemanth A R</span>
      </footer>
    </div>
  );
}

function ModuleView({ id }) {
  const reduce = useReducedMotion();
  const label = NAV_BY_ID[id]?.label;
  return (
    <div className="ws">
      <section className="masthead">
        <div className="dotbar">
          <span className="cap mono">+</span>
          <span className="dotbar-txt mono">SECURERAG / {label}</span>
          <motion.span className="lead" initial={reduce ? false : { scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.8, ease: EASE }} />
          <span className="dotbar-txt mono"><span className="g">v3.0</span></span>
          <span className="cap mono">+</span>
        </div>
        <h1 className="mega"><WordWipe text={label} delay={0.2} /></h1>
      </section>
      <section className="panel">
        <span className="stamp mono">[ x:01 ]</span>
        <div className="panel-head"><SysLabel title="MODULE STATUS" index="01" status="STANDBY" /></div>
        <p className="mono module-msg">// Interface bound to the SecureRAG analysis API. Console surface in progress — DASHBOARD is the active operating view.</p>
      </section>
      <footer className="footer mono">
        <span>© 2026 SecureRAG</span>
        <span>Developed by Hemanth A R</span>
      </footer>
    </div>
  );
}

/* ================================================================== */
/*  App shell                                                         */
/* ================================================================== */
export default function App() {
  const [active, setActive] = useState("dashboard");
  const [open, setOpen] = useState(false);
  const select = (id) => { setActive(id); setOpen(false); };

  return (
    <div className="srag">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <Rail active={active} onSelect={select} open={open} onClose={() => setOpen(false)} />
      <AnimatePresence>
        {open && (
          <motion.div className="overlay" onClick={() => setOpen(false)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} aria-hidden="true" />
        )}
      </AnimatePresence>

      <div className="main-wrap">
        <div className="topbar">
          <button className="icon-btn" type="button" aria-label="Open navigation" onClick={() => setOpen(true)}><Menu size={20} /></button>
          <span className="logo mono">[ <span className="logo-name">Secure<span className="g">RAG</span></span> ]</span>
        </div>
        <main className="main">
          <AnimatePresence mode="wait">
            {active === "dashboard" ? (
              <Workstation key="ws" />
            ) : active === "ioc" ? (
              <IOCExplorer key="ioc" />
            ) : active === "mitre" ? (
              <MitreView key="mitre" />
            ) : active === "timeline" ? (
              <TimelineView key="timeline" />
            ) : active === "investigation" ? (
              <InvestigationView key="investigation" />
            ) : (
              <ModuleView key={active} id={active} />
            )}
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}

/* ================================================================== */
/*  Styles                                                            */
/* ================================================================== */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap');

:root{
  --space-1:4px; --space-2:8px; --space-3:12px; --space-4:16px; --space-5:24px;
  --space-6:32px; --space-7:48px; --space-8:64px; --space-9:96px;
  --canvas:#080c10; --surface:#0d1117; --hairline:rgba(255,255,255,0.08);
  --dotted:rgba(255,255,255,0.2); --text:#e6edf3; --muted:#7d8590; --dim:#484f58;
  --green:#00ff88;
  --mono:'JetBrains Mono', ui-monospace, Consolas, monospace;
  --sans:'Inter', system-ui, 'Segoe UI', Roboto, sans-serif;
}

#root{ width:100%!important; max-width:none!important; margin:0!important; padding:0!important;
  text-align:left!important; border:0!important; min-height:100vh; display:block!important; }
body{ margin:0; background:var(--canvas); }

.srag{ display:flex; min-height:100vh; background:var(--canvas); color:var(--text);
  font-family:var(--sans); font-size:0.875rem; line-height:1.6;
  -webkit-font-smoothing:antialiased; -moz-osx-font-smoothing:grayscale; }
.srag *{ box-sizing:border-box; }
.mono{ font-family:var(--mono); }
.g{ color:var(--green); }
.dim{ color:var(--dim); }

.srag a:focus-visible, .srag button:focus-visible, .srag [tabindex]:focus-visible, .srag input:focus-visible{
  outline:2px solid var(--green); outline-offset:2px; }

/* ---- Rail (system control) ---- */
.rail{ position:fixed; top:0; left:0; bottom:0; width:240px; z-index:50; display:flex; flex-direction:column;
  background:var(--surface); border-right:1px solid var(--hairline); padding:var(--space-5) 0; }
.rail-top{ display:flex; align-items:center; justify-content:space-between; padding:0 var(--space-4) var(--space-6); }
.logo{ font-size:0.9375rem; font-weight:700; letter-spacing:0.02em; color:var(--dim); }
.logo-name{ color:var(--text); }
.rail-close{ display:none; }

.rail-list{ list-style:none; margin:0; padding:0 var(--space-3); display:flex; flex-direction:column; gap:2px; }
.rail-item{ position:relative; width:100%; display:flex; align-items:center; gap:var(--space-3); cursor:pointer;
  padding:var(--space-3); border:0; background:none; color:var(--muted); font-family:var(--mono);
  font-size:0.6875rem; letter-spacing:0.05em; text-align:left; transition:color .18s ease, background .18s ease; }
.rail-item svg{ color:var(--dim); transition:color .18s ease; flex:0 0 auto; }
.rail-item:hover{ color:var(--text); background:rgba(255,255,255,0.03); }
.rail-item:hover svg{ color:var(--muted); }
.rail-item.active{ color:var(--text); background:rgba(255,255,255,0.03); }
.rail-item.active svg{ color:var(--green); }
.rail-item.active .rail-idx{ color:var(--green); }
.rail-idx{ color:var(--dim); font-size:0.625rem; flex:0 0 auto; }
.rail-label{ flex:1 1 auto; }
.rail-ind{ position:absolute; left:0; top:7px; bottom:7px; width:2px; background:var(--green); }

.rail-status{ margin-top:auto; padding:var(--space-4) var(--space-4) 0; display:flex; flex-direction:column;
  gap:var(--space-2); border-top:1px solid var(--hairline); margin-left:var(--space-4); margin-right:var(--space-4); }
.rail-status-row{ display:flex; align-items:center; justify-content:space-between; font-size:0.625rem; letter-spacing:0.04em; }
.rail-status-row > span:last-child{ color:var(--text); }
.status-led{ display:inline-flex; align-items:center; gap:var(--space-2); color:var(--green); }
.led{ width:6px; height:6px; border-radius:50%; background:var(--green); box-shadow:0 0 8px var(--green);
  animation:led 2.4s ease-in-out infinite; }
@keyframes led{ 0%,100%{ opacity:1; } 50%{ opacity:.3; } }

/* ---- Shell ---- */
.main-wrap{ flex:1; margin-left:240px; min-width:0; display:flex; flex-direction:column; }
.topbar{ display:none; }
.main{ flex:1; padding:var(--space-7); min-width:0; }
.ws{ display:flex; flex-direction:column; gap:var(--space-8); max-width:1200px; }

/* ---- Panels & stamps ---- */
.panel{ position:relative; }
.stamp{ position:absolute; top:0; right:0; font-size:0.625rem; color:var(--dim); letter-spacing:0.06em; }
.panel-head{ display:flex; align-items:baseline; justify-content:space-between; gap:var(--space-4);
  margin-bottom:var(--space-5); flex-wrap:wrap; }
.syslabel{ font-family:var(--mono); font-size:0.6875rem; letter-spacing:0.15em; text-transform:uppercase; color:var(--muted); }
.refresh{ font-size:0.625rem; letter-spacing:0.08em; color:var(--dim); text-transform:uppercase; }

/* ---- Masthead ---- */
.masthead{ position:relative; display:flex; flex-direction:column; gap:var(--space-5); padding-top:var(--space-2); }
.dotbar{ display:flex; align-items:center; gap:var(--space-3); font-size:0.6875rem; letter-spacing:0.1em;
  text-transform:uppercase; color:var(--muted); }
.dotbar .cap{ color:var(--dim); }
.dotbar-txt{ white-space:nowrap; }
.lead{ flex:1 1 auto; height:0; border-bottom:1px dotted var(--dotted); transform-origin:left; align-self:center; }

.masthead-grid{ display:grid; grid-template-columns:1fr 1fr; grid-template-areas:"head head" "hazard graph";
  column-gap:var(--space-7); row-gap:var(--space-6); align-items:center; }
.mega{ grid-area:head; margin:0; font-family:var(--sans); font-weight:800; font-size:clamp(3.5rem,8.5vw,6.5rem);
  letter-spacing:-0.04em; line-height:0.92; color:var(--text); max-width:100%; }
.masthead-right{ grid-area:graph; min-width:0; }
.ww-mask{ display:inline-block; overflow:hidden; vertical-align:bottom; padding-bottom:0.12em; margin-bottom:-0.12em; }
.ww-word{ display:inline-block; }

.hazard{ grid-area:hazard; position:relative; display:flex; align-items:center; gap:var(--space-3); }
.hazard-stripes{ flex:1 1 auto; height:14px;
  background:repeating-linear-gradient(-45deg, rgba(0,255,136,0.14) 0 7px, rgba(255,255,255,0) 7px 14px);
  border-block:1px solid rgba(0,255,136,0.12); }
.hazard-label{ font-size:0.625rem; letter-spacing:0.08em; color:var(--muted); white-space:nowrap; }

/* ---- Telemetry ---- */
.telemetry{ border:1px solid var(--hairline); background:var(--surface); padding:var(--space-4);
  display:flex; flex-direction:column; gap:var(--space-3); }
.tele-head{ display:flex; align-items:center; justify-content:space-between; gap:var(--space-3); flex-wrap:wrap; }
.tele-legend{ display:flex; gap:var(--space-4); font-size:0.625rem; letter-spacing:0.06em; color:var(--muted); }
.telemetry svg{ width:100%; height:auto; display:block; }
.tele-axis{ font-family:var(--mono); font-size:8px; fill:var(--dim); }

/* ---- Instrument cluster ---- */
.cluster .readouts{ display:grid; grid-template-columns:repeat(4,minmax(0,1fr));
  border-block:1px solid var(--hairline); }
.readout{ display:flex; flex-direction:column; gap:var(--space-2); padding:var(--space-5) var(--space-5) var(--space-5) 0;
  border-left:1px solid var(--hairline); padding-left:var(--space-5); }
.readout:first-child{ border-left:0; padding-left:0; }
.readout-label{ font-size:0.625rem; letter-spacing:0.1em; color:var(--muted); }
.readout-value{ font-size:clamp(2rem,4vw,2.75rem); font-weight:500; line-height:1; letter-spacing:-0.02em; color:var(--text); }
.readout-value.crit{ color:#ff4444; }
.readout-delta{ font-size:0.6875rem; color:var(--green); display:inline-flex; align-items:center; gap:var(--space-2); }
.readout-delta .tick{ font-size:0.5rem; }

/* ---- Workstation grid ---- */
.ws-grid{ display:grid; grid-template-columns:minmax(0,1.7fr) minmax(0,1fr); gap:var(--space-7); align-items:start; }

/* ---- Evidence log ---- */
.ev-wrap{ overflow-x:auto; }
.ev{ width:100%; border-collapse:collapse; min-width:560px; }
.ev th{ text-align:left; font-family:var(--mono); font-size:0.5625rem; letter-spacing:0.1em; text-transform:uppercase;
  color:var(--dim); font-weight:400; padding:0 var(--space-3) var(--space-3); border-bottom:1px solid var(--hairline); }
.ev th.num, .ev td.num{ text-align:right; }
.ev td{ height:52px; padding:0 var(--space-3); border-bottom:1px solid var(--hairline); font-size:0.75rem; color:var(--text);
  vertical-align:middle; }
.ev tbody tr{ transition:background .15s ease; }
.ev tbody tr:hover{ background:rgba(255,255,255,0.02); }
.ev tbody tr:hover td:first-child{ box-shadow:inset 2px 0 0 var(--green); }
.ev tbody tr:last-child td{ border-bottom:0; }
.ref{ color:var(--muted); font-size:0.6875rem; white-space:nowrap; }
.artifact{ color:var(--text); max-width:220px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.logged{ color:var(--dim); font-size:0.6875rem; white-space:nowrap; }
.sev{ display:inline-block; font-size:0.5625rem; letter-spacing:0.08em; padding:2px var(--space-2); border:1px solid; border-radius:2px; }

/* ---- Module rows ---- */
.modlist{ list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:var(--space-2); }
.modrow{ width:100%; display:flex; align-items:center; gap:var(--space-3); cursor:pointer;
  padding:var(--space-3) var(--space-4); background:var(--surface); border:1px solid var(--hairline); color:var(--text);
  font-family:var(--sans); text-align:left; transition:border-color .2s ease, background .2s ease; }
.modrow:hover{ border-color:rgba(0,255,136,0.4); background:rgba(0,255,136,0.03); }
.mod-ico{ display:grid; place-items:center; width:28px; height:28px; flex:0 0 auto; color:var(--muted);
  background:rgba(255,255,255,0.03); border:1px solid var(--hairline); }
.modrow:hover .mod-ico{ color:var(--green); }
.mod-code{ font-size:0.5625rem; letter-spacing:0.08em; color:var(--dim); flex:0 0 auto; }
.mod-label{ flex:1 1 auto; font-size:0.75rem; font-weight:600; letter-spacing:0.02em; }
.mod-arrow{ color:var(--dim); flex:0 0 auto; transition:transform .2s ease, color .2s ease; }
.modrow:hover .mod-arrow{ color:var(--green); transform:translateX(4px); }

/* ---- Misc ---- */
.module-msg{ font-size:0.75rem; color:var(--muted); letter-spacing:0.02em; }
.icon-btn{ display:grid; place-items:center; width:38px; height:38px; cursor:pointer; color:var(--text);
  background:var(--surface); border:1px solid var(--hairline); }
.overlay{ position:fixed; inset:0; background:rgba(4,6,9,0.6); z-index:45; }
.footer{ display:flex; flex-direction:column; align-items:center; gap:var(--space-1);
  padding:var(--space-7) 0 var(--space-2); border-top:1px dotted var(--dotted);
  color:var(--muted); font-size:0.7rem; letter-spacing:0.04em; text-align:center; }

/* ---- Responsive ---- */
@media (max-width:960px){
  .masthead-grid{ grid-template-columns:1fr; grid-template-areas:"head" "hazard" "graph"; gap:var(--space-6); }
  .ws-grid{ grid-template-columns:1fr; }
  .cluster .readouts{ grid-template-columns:repeat(2,minmax(0,1fr)); }
  .readout{ padding:var(--space-4) var(--space-4); border-left:1px solid var(--hairline); border-top:1px solid var(--hairline); }
  .readout:first-child{ border-top:0; }
  .readout:nth-child(2){ border-top:0; }
  .readout:nth-child(odd){ border-left:0; padding-left:0; }
}
@media (max-width:768px){
  .rail{ transform:translateX(-100%); transition:transform .25s ease; box-shadow:0 0 40px rgba(0,0,0,0.6); }
  .rail.open{ transform:translateX(0); }
  .rail-close{ display:grid; }
  .main-wrap{ margin-left:0; }
  .topbar{ display:flex; align-items:center; gap:var(--space-3); position:sticky; top:0; z-index:40;
    padding:var(--space-3) var(--space-4); background:rgba(8,12,16,0.92); backdrop-filter:blur(8px);
    -webkit-backdrop-filter:blur(8px); border-bottom:1px solid var(--hairline); }
  .main{ padding:var(--space-6) var(--space-4) var(--space-7); }
  .ws{ gap:var(--space-7); }
}
@media (max-width:520px){
  .mega{ font-size:clamp(2.25rem,11vw,3.5rem); }
  .cluster .readouts{ grid-template-columns:1fr; }
  .readout{ border-left:0; padding-left:0; border-top:1px solid var(--hairline); }
  .readout:first-child{ border-top:0; }
  .dotbar-txt:first-of-type{ white-space:normal; }
}

/* ---- IOC Explorer states ---- */
.load-msg{ display:flex; align-items:center; gap:var(--space-2); color:var(--muted); font-size:0.75rem;
  letter-spacing:0.02em; padding:var(--space-2) 0; }
.state-err{ display:flex; align-items:center; gap:var(--space-4); flex-wrap:wrap; }
.state-err .mono{ display:flex; align-items:center; gap:var(--space-2); color:#ff8c42; font-size:0.75rem; }
.ioc-login{ display:flex; flex-direction:column; gap:var(--space-3); }
.ioc-fields{ display:flex; gap:var(--space-3); flex-wrap:wrap; }
.ioc-input{ flex:1 1 160px; min-width:0; background:var(--canvas); border:1px solid var(--hairline);
  color:var(--text); font-family:var(--mono); font-size:0.75rem; padding:var(--space-3); }
.ioc-input::placeholder{ color:var(--dim); }
.ioc-btn{ cursor:pointer; background:rgba(0,255,136,0.06); border:1px solid rgba(0,255,136,0.4); color:var(--green);
  font-size:0.6875rem; letter-spacing:0.08em; padding:var(--space-3) var(--space-5); transition:background .18s ease; }
.ioc-btn:hover:not(:disabled){ background:rgba(0,255,136,0.12); }
.ioc-btn:disabled{ opacity:0.5; cursor:not-allowed; }
.ioc-err{ display:flex; align-items:center; gap:var(--space-2); color:#ff4444; font-size:0.7rem; }

/* ---- MITRE technique mapper ---- */
.mitre-input{ display:flex; flex-direction:column; gap:var(--space-3); margin-bottom:var(--space-5); }
.mitre-textarea{ width:100%; resize:vertical; min-height:96px; line-height:1.5; }
.killchain{ list-style:none; margin:0 0 var(--space-5); padding:0; display:flex; flex-wrap:wrap;
  align-items:center; gap:var(--space-2); }
.kc-step{ display:inline-flex; align-items:center; gap:var(--space-2); font-size:0.6875rem; letter-spacing:0.04em;
  background:var(--surface); border:1px solid var(--hairline); padding:var(--space-2) var(--space-3); }
.kc-tactic{ color:var(--text); }
.kc-tech{ font-size:0.625rem; }
.kc-arrow{ color:var(--dim); margin-left:var(--space-2); }

@media (prefers-reduced-motion: reduce){
  .srag *, .srag *::before, .srag *::after{
    animation-duration:.001ms!important; animation-iteration-count:1!important; transition-duration:.001ms!important; }
  .led{ animation:none; }
}
`;
