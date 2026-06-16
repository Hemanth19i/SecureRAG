import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence, animate, useReducedMotion } from "framer-motion";
import {
  LayoutDashboard,
  UploadCloud,
  Search,
  Fingerprint,
  Grid3x3,
  Clock,
  FileText,
  Menu,
  X,
  Eye,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Config                                                            */
/* ------------------------------------------------------------------ */
const API = import.meta.env.VITE_API_BASE_URL || "/api";
const ENV = (import.meta.env.MODE || "development").toUpperCase();

/* ------------------------------------------------------------------ */
/*  Severity — single source of truth                                 */
/* ------------------------------------------------------------------ */
const SEVERITY_COLORS = {
  critical: "#ff4444",
  high: "#ff8c42",
  medium: "#ffd700",
  low: "#58a6ff",
};
function severityColor(level) {
  return SEVERITY_COLORS[String(level).toLowerCase()] || "#7d8590";
}

/* ------------------------------------------------------------------ */
/*  Navigation                                                        */
/* ------------------------------------------------------------------ */
const NAV = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "upload", label: "Upload", icon: UploadCloud },
  { id: "investigation", label: "Investigation", icon: Search },
  { id: "ioc", label: "IOC Explorer", icon: Fingerprint },
  { id: "mitre", label: "MITRE ATT&CK", icon: Grid3x3 },
  { id: "timeline", label: "Timeline", icon: Clock },
  { id: "reports", label: "Reports", icon: FileText },
];
const NAV_BY_ID = Object.fromEntries(NAV.map((n) => [n.id, n]));

/* ------------------------------------------------------------------ */
/*  Mock data (renders fully without a backend)                       */
/* ------------------------------------------------------------------ */
const STATS = [
  { id: "docs", label: "Documents Indexed", value: 1287, delta: "12%", dir: "up" },
  { id: "iocs", label: "IOCs Extracted", value: 4892, delta: "318", dir: "up" },
  { id: "critical", label: "Critical Threats", value: 17, delta: "3 new", dir: "up" },
  { id: "tech", label: "MITRE Techniques", value: 38, delta: "5", dir: "up" },
];

const ANALYSES = [
  { id: "a1", doc: "auth_ssh_2026-06-14.log", severity: "critical", iocs: 42, mitre: 6, time: "2m ago" },
  { id: "a2", doc: "firewall_edge_egress.csv", severity: "high", iocs: 28, mitre: 4, time: "18m ago" },
  { id: "a3", doc: "dns_exfil_capture.log", severity: "high", iocs: 19, mitre: 3, time: "41m ago" },
  { id: "a4", doc: "endpoint_av_quarantine.txt", severity: "medium", iocs: 11, mitre: 2, time: "1h ago" },
  { id: "a5", doc: "vpn_session_audit.log", severity: "low", iocs: 6, mitre: 1, time: "3h ago" },
  { id: "a6", doc: "web_access_proxy.log", severity: "medium", iocs: 14, mitre: 2, time: "5h ago" },
];

const DISTRIBUTION = [
  { level: "critical", count: 17 },
  { level: "high", count: 34 },
  { level: "medium", count: 58 },
  { level: "low", count: 91 },
];
const DIST_MAX = Math.max(...DISTRIBUTION.map((d) => d.count));

/* ------------------------------------------------------------------ */
/*  Motion primitives                                                 */
/* ------------------------------------------------------------------ */
const EASE = [0.16, 1, 0.3, 1];

function useMotion() {
  const reduce = useReducedMotion();
  const fadeUp = reduce
    ? { hidden: { opacity: 1, y: 0 }, show: { opacity: 1, y: 0 } }
    : { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } } };
  const stagger = (step = 0.07, delay = 0) => ({
    hidden: {},
    show: { transition: reduce ? {} : { staggerChildren: step, delayChildren: delay } },
  });
  return { reduce, fadeUp, stagger };
}

/* Count-up number, synced with the card's fade-in */
function Counter({ value, delay = 0 }) {
  const reduce = useReducedMotion();
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    if (reduce) return;
    const controls = animate(0, value, {
      duration: 1.1,
      delay,
      ease: "easeOut",
      onUpdate: (v) => setDisplay(v),
    });
    return () => controls.stop();
  }, [value, delay, reduce]);
  return <>{Math.round(reduce ? value : display).toLocaleString()}</>;
}

/* ------------------------------------------------------------------ */
/*  Sidebar                                                           */
/* ------------------------------------------------------------------ */
function Sidebar({ active, onSelect, open, onClose }) {
  const reduce = useReducedMotion();
  const indicator = reduce
    ? { duration: 0 }
    : { type: "spring", stiffness: 520, damping: 40 };
  return (
    <nav className={`sidebar${open ? " open" : ""}`} aria-label="Primary">
      <div className="brand">
        <span className="brand-logo" aria-hidden="true" />
        <span className="brand-text">Secure<span className="brand-rag">RAG</span></span>
        <button className="icon-btn sidebar-close" type="button" aria-label="Close navigation" onClick={onClose}>
          <X size={18} />
        </button>
      </div>

      <ul className="nav-list">
        {NAV.map((n) => {
          const Icon = n.icon;
          const isActive = active === n.id;
          return (
            <li key={n.id}>
              <button
                type="button"
                className={`nav-item${isActive ? " active" : ""}`}
                aria-current={isActive ? "page" : undefined}
                onClick={() => onSelect(n.id)}
              >
                {isActive && <motion.span layoutId="nav-indicator" className="nav-indicator" transition={indicator} />}
                <Icon size={17} aria-hidden="true" />
                <span>{n.label}</span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="sidebar-foot">
        <span className="status-pill mono">
          <span className="status-dot" aria-hidden="true" />
          SYSTEM ONLINE
        </span>
      </div>
    </nav>
  );
}

/* ------------------------------------------------------------------ */
/*  Stat cell                                                         */
/* ------------------------------------------------------------------ */
function Stat({ stat, index, fadeUp, reduce }) {
  const up = stat.dir === "up";
  const Arrow = up ? ArrowUpRight : ArrowDownRight;
  return (
    <motion.div
      className="stat"
      variants={fadeUp}
      whileHover={reduce ? undefined : { y: -2 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
    >
      <span className="eyebrow">{stat.label}</span>
      <span className="stat-num mono grad-num">
        <Counter value={stat.value} delay={reduce ? 0 : 0.15 + index * 0.06} />
      </span>
      <span className={`stat-delta mono ${up ? "up" : "down"}`}>
        <Arrow size={13} aria-hidden="true" />
        {stat.delta}
      </span>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Severity pill                                                     */
/* ------------------------------------------------------------------ */
function SeverityPill({ level }) {
  const c = severityColor(level);
  return (
    <span
      className="sev-pill mono"
      style={{ color: c, background: `${c}1f`, borderColor: `${c}40` }}
    >
      {String(level).toUpperCase()}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Recent analyses                                                   */
/* ------------------------------------------------------------------ */
function RecentAnalyses({ fadeUp }) {
  const { stagger } = useMotion();
  return (
    <motion.section className="card" variants={fadeUp} aria-labelledby="recent-h">
      <div className="card-head">
        <h2 id="recent-h" className="h2">Recent Analyses</h2>
        <span className="eyebrow">{ANALYSES.length} documents</span>
      </div>
      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th scope="col">Document</th>
              <th scope="col">Severity</th>
              <th scope="col" className="num">IOCs</th>
              <th scope="col" className="num">MITRE</th>
              <th scope="col">Analyzed</th>
              <th scope="col"><span className="sr-only">Action</span></th>
            </tr>
          </thead>
          <motion.tbody variants={stagger(0.05)} initial="hidden" animate="show">
            {ANALYSES.map((row) => (
              <motion.tr key={row.id} variants={fadeUp}>
                <td className="td-doc mono">{row.doc}</td>
                <td><SeverityPill level={row.severity} /></td>
                <td className="mono num">{row.iocs}</td>
                <td className="mono num">{row.mitre}</td>
                <td className="td-muted mono">{row.time}</td>
                <td className="td-action">
                  <button className="view-btn" type="button" aria-label={`View analysis for ${row.doc}`}>
                    <Eye size={15} aria-hidden="true" />
                  </button>
                </td>
              </motion.tr>
            ))}
          </motion.tbody>
        </table>
      </div>
    </motion.section>
  );
}

/* ------------------------------------------------------------------ */
/*  Threat distribution                                               */
/* ------------------------------------------------------------------ */
function ThreatDistribution({ fadeUp }) {
  const reduce = useReducedMotion();
  const total = DISTRIBUTION.reduce((s, d) => s + d.count, 0);
  return (
    <motion.section className="card" variants={fadeUp} aria-labelledby="dist-h">
      <div className="card-head">
        <h2 id="dist-h" className="h2">Threat Distribution</h2>
        <span className="eyebrow mono">{total} total</span>
      </div>
      <ul className="dist-list">
        {DISTRIBUTION.map((d, i) => {
          const c = severityColor(d.level);
          const pct = (d.count / DIST_MAX) * 100;
          return (
            <li className="dist-row" key={d.level}>
              <div className="dist-meta">
                <span className="dist-label" style={{ color: c }}>{d.level}</span>
                <span className="dist-count mono">{d.count}</span>
              </div>
              <span className="dist-track" aria-hidden="true">
                <motion.span
                  className="dist-fill"
                  style={{ background: c }}
                  initial={{ width: reduce ? `${pct}%` : 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={reduce ? { duration: 0 } : { duration: 0.8, delay: 0.2 + i * 0.08, ease: EASE }}
                />
              </span>
            </li>
          );
        })}
      </ul>
    </motion.section>
  );
}

/* ------------------------------------------------------------------ */
/*  Upload dropzone                                                   */
/* ------------------------------------------------------------------ */
function UploadZone({ fadeUp }) {
  const reduce = useReducedMotion();
  const [drag, setDrag] = useState(false);
  const [queue, setQueue] = useState([]);
  const inputRef = useRef(null);
  const timers = useRef({});

  useEffect(() => {
    const t = timers.current;
    return () => Object.values(t).forEach(clearTimeout);
  }, []);

  const runUpload = useCallback(
    (id, file) => {
      try {
        const fd = new FormData();
        fd.append("file", file);
        fetch(`${API}/upload`, { method: "POST", body: fd }).catch(() => {});
      } catch {
        /* no-op */
      }
      if (reduce) {
        setQueue((q) => q.map((it) => (it.id === id ? { ...it, progress: 100, status: "Indexed" } : it)));
        return;
      }
      let p = 0;
      const tick = () => {
        p = Math.min(100, p + (9 + Math.random() * 15));
        setQueue((q) => q.map((it) => (it.id === id ? { ...it, progress: p } : it)));
        if (p < 100) timers.current[id] = setTimeout(tick, 170);
        else setQueue((q) => q.map((it) => (it.id === id ? { ...it, progress: 100, status: "Indexed" } : it)));
      };
      timers.current[id] = setTimeout(tick, 200);
    },
    [reduce]
  );

  const enqueue = useCallback(
    (fileList) => {
      Array.from(fileList || []).forEach((file) => {
        const id = `${file.name}-${file.size}-${Math.random().toString(36).slice(2, 8)}`;
        setQueue((q) => [{ id, name: file.name, progress: 0, status: "Uploading" }, ...q].slice(0, 6));
        runUpload(id, file);
      });
    },
    [runUpload]
  );

  return (
    <motion.section className="card" variants={fadeUp} aria-labelledby="upload-h">
      <div className="card-head">
        <h2 id="upload-h" className="h2">Upload Logs</h2>
      </div>
      <div
        className={`dropzone${drag ? " drag" : ""}`}
        role="button"
        tabIndex={0}
        aria-label="Drop log files here or press Enter to browse"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          if (e.dataTransfer?.files?.length) enqueue(e.dataTransfer.files);
        }}
      >
        <UploadCloud size={26} strokeWidth={1.5} className="dz-icon" aria-hidden="true" />
        <span className="dz-title">Drop log files or click to browse</span>
        <span className="dz-sub eyebrow">PDF · TXT · LOG · CSV</span>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="sr-only"
          accept=".pdf,.txt,.log,.csv"
          onChange={(e) => {
            enqueue(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
      {queue.length > 0 && (
        <ul className="queue">
          {queue.map((it) => (
            <li className="q-item" key={it.id}>
              <span className="q-name mono" title={it.name}>{it.name}</span>
              <span className="q-track" aria-hidden="true">
                <span className="q-fill" style={{ width: `${it.progress}%` }} />
              </span>
              <span className={`q-status mono ${it.status === "Indexed" ? "ok" : ""}`}>{it.status}</span>
            </li>
          ))}
        </ul>
      )}
    </motion.section>
  );
}

/* ------------------------------------------------------------------ */
/*  Dashboard                                                         */
/* ------------------------------------------------------------------ */
function Dashboard() {
  const { reduce, fadeUp, stagger } = useMotion();
  return (
    <motion.div variants={stagger(0.08, 0.04)} initial="hidden" animate="show" className="page">
      {/* Hero */}
      <motion.header className="hero" variants={stagger(0.07)}>
        <motion.span className="eyebrow hero-eyebrow" variants={fadeUp}>
          Threat Intelligence Overview
        </motion.span>
        <motion.h1 className="display" variants={fadeUp}>
          Security Operations
        </motion.h1>
        <motion.p className="hero-status body" variants={fadeUp}>
          <span className="status-pill mono inline">
            <span className="status-dot" aria-hidden="true" />
            SYSTEM ONLINE
          </span>
          <span className="hero-meta mono">Last scan 2m ago · ENV {ENV}</span>
        </motion.p>
      </motion.header>

      {/* Stats */}
      <motion.div className="stat-row" variants={stagger(0.06)}>
        {STATS.map((s, i) => (
          <Stat key={s.id} stat={s} index={i} fadeUp={fadeUp} reduce={reduce} />
        ))}
      </motion.div>

      {/* Asymmetric content */}
      <motion.div className="content-grid" variants={stagger(0.07)}>
        <div className="col-main">
          <RecentAnalyses fadeUp={fadeUp} />
          <UploadZone fadeUp={fadeUp} />
        </div>
        <div className="col-side">
          <ThreatDistribution fadeUp={fadeUp} />
        </div>
      </motion.div>

      <motion.footer className="footer" variants={fadeUp}>
        <span className="mono">© 2026 SecureRAG</span>
        <span className="mono">Developed by Hemanth A R</span>
      </motion.footer>
    </motion.div>
  );
}

function Placeholder({ id }) {
  const { fadeUp, stagger } = useMotion();
  const label = NAV_BY_ID[id]?.label;
  return (
    <motion.div variants={stagger(0.08, 0.04)} initial="hidden" animate="show" className="page">
      <motion.header className="hero" variants={stagger(0.07)}>
        <motion.span className="eyebrow hero-eyebrow" variants={fadeUp}>SecureRAG Module</motion.span>
        <motion.h1 className="display" variants={fadeUp}>{label}</motion.h1>
        <motion.p className="hero-status body" variants={fadeUp}>
          <span className="hero-meta mono">Backed by the SecureRAG analysis API · interface in progress</span>
        </motion.p>
      </motion.header>
      <motion.section className="card placeholder" variants={fadeUp}>
        <p className="body">This surface connects to the live backend. The dashboard is the active view for now.</p>
      </motion.section>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  App shell                                                         */
/* ------------------------------------------------------------------ */
export default function App() {
  const [active, setActive] = useState("dashboard");
  const [open, setOpen] = useState(false);

  const select = (id) => {
    setActive(id);
    setOpen(false);
  };

  return (
    <div className="srag-app">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <Sidebar active={active} onSelect={select} open={open} onClose={() => setOpen(false)} />
      <AnimatePresence>
        {open && (
          <motion.div
            className="overlay"
            onClick={() => setOpen(false)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            aria-hidden="true"
          />
        )}
      </AnimatePresence>

      <div className="main-wrap">
        <div className="topbar">
          <button className="icon-btn" type="button" aria-label="Open navigation" onClick={() => setOpen(true)}>
            <Menu size={20} />
          </button>
          <span className="brand-text sm">Secure<span className="brand-rag">RAG</span></span>
        </div>

        <main className="main">
          <AnimatePresence mode="wait">
            {active === "dashboard" ? <Dashboard key="dash" /> : <Placeholder key={active} id={active} />}
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Scoped styles                                                     */
/* ------------------------------------------------------------------ */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Share+Tech+Mono&display=swap');

:root{
  /* 8px spacing scale */
  --space-1:4px; --space-2:8px; --space-3:12px; --space-4:16px; --space-5:24px;
  --space-6:32px; --space-7:48px; --space-8:64px; --space-9:96px;

  /* palette */
  --canvas:#080c10; --surface:#0d1117; --elevated:#161b22;
  --hairline:rgba(255,255,255,0.06); --hairline-2:rgba(255,255,255,0.04);
  --text:#e6edf3; --muted:#7d8590; --dim:#484f58;
  --green:#00ff88; --green-dim:#00c96a;

  --mono:'Share Tech Mono', ui-monospace, Consolas, monospace;
  --sans:'Inter', system-ui, 'Segoe UI', Roboto, sans-serif;
  --shadow:0 1px 2px rgba(0,0,0,0.4);
  --shadow-hover:0 6px 20px -8px rgba(0,0,0,0.6);
  --lit:inset 0 1px 0 rgba(255,255,255,0.04);
}

/* Override Vite-starter #root cruft */
#root{ width:100%!important; max-width:none!important; margin:0!important; padding:0!important;
  text-align:left!important; border:0!important; min-height:100vh; display:block!important; }
body{ margin:0; background:var(--canvas); }

.srag-app{ display:flex; min-height:100vh; background:var(--canvas); color:var(--text);
  font-family:var(--sans); font-size:0.875rem; line-height:1.6; -webkit-font-smoothing:antialiased;
  -moz-osx-font-smoothing:grayscale; }
.srag-app *{ box-sizing:border-box; }
.mono{ font-family:var(--mono); }
.sr-only{ position:absolute!important; width:1px; height:1px; padding:0; margin:-1px; overflow:hidden;
  clip:rect(0 0 0 0); white-space:nowrap; border:0; }

.srag-app a:focus-visible, .srag-app button:focus-visible, .srag-app [tabindex]:focus-visible,
.srag-app input:focus-visible{ outline:2px solid var(--green); outline-offset:2px; border-radius:8px; }

/* ---- Type primitives ---- */
.display{ font-size:clamp(2.5rem,5vw,3.5rem); font-weight:600; letter-spacing:-0.03em; line-height:1.1;
  margin:0; color:var(--text); }
.h2{ font-size:1.25rem; font-weight:600; letter-spacing:-0.02em; line-height:1.1; margin:0; color:var(--text); }
.body{ font-size:0.875rem; font-weight:400; line-height:1.6; color:var(--muted); margin:0; }
.eyebrow{ font-size:0.6875rem; font-weight:500; letter-spacing:0.08em; text-transform:uppercase; color:var(--muted); }
.grad-num{ background:linear-gradient(180deg,#ffffff 0%,#9aa4af 100%);
  -webkit-background-clip:text; background-clip:text; color:transparent; }

/* ---- Sidebar ---- */
.sidebar{ position:fixed; top:0; left:0; bottom:0; width:240px; z-index:50; display:flex; flex-direction:column;
  padding:var(--space-5) var(--space-3); background:var(--surface); border-right:1px solid var(--hairline); }
.brand{ display:flex; align-items:center; gap:var(--space-3); padding:var(--space-2) var(--space-3) var(--space-6); }
.brand-logo{ width:26px; height:26px; border-radius:7px; flex:0 0 auto;
  background:linear-gradient(135deg,var(--green),var(--green-dim)); box-shadow:0 0 16px -4px rgba(0,255,136,0.5); }
.brand-text{ font-weight:600; font-size:1.0625rem; letter-spacing:-0.02em; color:var(--text); }
.brand-text.sm{ font-size:1rem; }
.brand-rag{ background:linear-gradient(135deg,var(--green),var(--green-dim));
  -webkit-background-clip:text; background-clip:text; color:transparent; }
.sidebar-close{ display:none; margin-left:auto; }

.nav-list{ list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:var(--space-1); }
.nav-item{ position:relative; width:100%; display:flex; align-items:center; gap:var(--space-3); cursor:pointer;
  padding:var(--space-3); border:0; border-radius:8px; background:none; color:var(--muted);
  font-family:var(--sans); font-size:0.8125rem; font-weight:500; text-align:left;
  transition:color .18s ease, background .18s ease; }
.nav-item:hover{ color:var(--text); background:rgba(255,255,255,0.03); }
.nav-item.active{ color:var(--text); background:rgba(255,255,255,0.03); }
.nav-item.active svg{ color:var(--green); }
.nav-item svg{ flex:0 0 auto; }
.nav-indicator{ position:absolute; left:0; top:6px; bottom:6px; width:2px; border-radius:2px;
  background:linear-gradient(180deg,var(--green),transparent); }

.sidebar-foot{ margin-top:auto; padding-top:var(--space-5); }

/* status pill */
.status-pill{ display:inline-flex; align-items:center; gap:var(--space-2); font-size:0.6875rem; letter-spacing:0.06em;
  color:var(--green); padding:var(--space-2) var(--space-3); border-radius:999px;
  background:rgba(0,255,136,0.06); border:1px solid rgba(0,255,136,0.2); }
.status-pill.inline{ padding:var(--space-1) var(--space-3); }
.status-dot{ width:7px; height:7px; border-radius:50%; background:var(--green); box-shadow:0 0 8px var(--green);
  animation:pulse 2.4s ease-in-out infinite; }
@keyframes pulse{ 0%,100%{ opacity:1; transform:scale(1); } 50%{ opacity:.4; transform:scale(.8); } }

/* ---- Main ---- */
.main-wrap{ flex:1; margin-left:240px; min-width:0; display:flex; flex-direction:column; }
.topbar{ display:none; }
.main{ flex:1; padding:var(--space-7); min-width:0; }
.page{ display:flex; flex-direction:column; gap:var(--space-8); max-width:1180px; }

/* ---- Hero ---- */
.hero{ position:relative; display:flex; flex-direction:column; gap:var(--space-3);
  padding-top:var(--space-2); }
.hero::before{ content:""; position:absolute; inset:-80px -120px auto -120px; height:340px; pointer-events:none;
  background:radial-gradient(circle at 30% 0%, rgba(0,255,136,0.06), transparent 60%); z-index:0; }
.hero > *{ position:relative; z-index:1; }
.hero-eyebrow{ position:relative; width:fit-content; padding-bottom:var(--space-2); }
.hero-eyebrow::after{ content:""; position:absolute; left:0; bottom:0; width:48px; height:1px;
  background:linear-gradient(90deg,var(--green),transparent); }
.hero-status{ display:flex; align-items:center; gap:var(--space-3); flex-wrap:wrap; margin-top:var(--space-2); }
.hero-meta{ font-size:0.75rem; color:var(--dim); letter-spacing:0.02em; }

/* ---- Stat row ---- */
.stat-row{ display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:var(--space-4); }
.stat{ display:flex; flex-direction:column; gap:var(--space-2); padding:var(--space-5); border-radius:12px;
  background:var(--surface); border:1px solid var(--hairline); box-shadow:var(--shadow), var(--lit);
  transition:border-color .2s ease, box-shadow .2s ease; }
.stat:hover{ border-color:rgba(0,255,136,0.2); box-shadow:var(--shadow-hover), var(--lit); }
.stat-num{ font-size:clamp(2rem,4vw,2.75rem); font-weight:400; line-height:1.05; letter-spacing:-0.01em; }
.stat-delta{ display:inline-flex; align-items:center; gap:var(--space-1); font-size:0.75rem; width:fit-content; }
.stat-delta.up{ color:var(--green); }
.stat-delta.down{ color:#ff4444; }

/* ---- Cards ---- */
.card{ background:var(--surface); border:1px solid var(--hairline); border-radius:12px;
  box-shadow:var(--shadow), var(--lit); padding:var(--space-6);
  transition:border-color .2s ease, box-shadow .2s ease; }
.card:hover{ border-color:rgba(0,255,136,0.2); box-shadow:var(--shadow-hover), var(--lit); }
.card-head{ display:flex; align-items:baseline; justify-content:space-between; gap:var(--space-3);
  margin-bottom:var(--space-5); }

.content-grid{ display:grid; grid-template-columns:minmax(0,1.5fr) minmax(0,1fr); gap:var(--space-5); align-items:start; }
.col-main{ display:flex; flex-direction:column; gap:var(--space-5); min-width:0; }
.col-side{ display:flex; flex-direction:column; gap:var(--space-5); min-width:0; }

/* ---- Table ---- */
.tbl-wrap{ overflow-x:auto; margin:0 calc(-1 * var(--space-2)); }
.tbl{ width:100%; border-collapse:collapse; min-width:560px; }
.tbl th{ text-align:left; font-family:var(--mono); font-size:0.625rem; letter-spacing:0.08em; text-transform:uppercase;
  color:var(--dim); font-weight:400; padding:0 var(--space-2) var(--space-3); border-bottom:1px solid var(--hairline); }
.tbl th.num, .tbl td.num{ text-align:right; }
.tbl td{ padding:var(--space-4) var(--space-2); border-bottom:1px solid var(--hairline-2); font-size:0.8125rem;
  color:var(--text); }
.tbl tbody tr{ transition:background .15s ease; }
.tbl tbody tr:hover{ background:rgba(255,255,255,0.02); }
.tbl tbody tr:last-child td{ border-bottom:0; }
.td-doc{ font-size:0.75rem; color:var(--text); max-width:220px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.td-muted{ color:var(--muted); font-size:0.75rem; }
.sev-pill{ display:inline-block; font-size:0.625rem; letter-spacing:0.06em; padding:var(--space-1) var(--space-2);
  border-radius:6px; border:1px solid; }
.td-action{ text-align:right; }
.view-btn{ display:inline-grid; place-items:center; width:30px; height:30px; cursor:pointer; color:var(--muted);
  background:none; border:1px solid var(--hairline); border-radius:8px;
  transition:color .18s ease, border-color .18s ease, background .18s ease; }
.view-btn:hover{ color:var(--green); border-color:rgba(0,255,136,0.3); background:rgba(0,255,136,0.05); }

/* ---- Distribution ---- */
.dist-list{ list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:var(--space-5); }
.dist-meta{ display:flex; align-items:baseline; justify-content:space-between; margin-bottom:var(--space-2); }
.dist-label{ font-size:0.75rem; font-weight:500; text-transform:capitalize; letter-spacing:0.01em; }
.dist-count{ font-size:0.8125rem; color:var(--text); }
.dist-track{ display:block; height:6px; border-radius:999px; background:rgba(255,255,255,0.05); overflow:hidden; }
.dist-fill{ display:block; height:100%; border-radius:999px; }

/* ---- Dropzone ---- */
.dropzone{ display:flex; flex-direction:column; align-items:center; justify-content:center; gap:var(--space-2);
  padding:var(--space-8) var(--space-5); border:1px dashed var(--hairline); border-radius:12px; cursor:pointer;
  text-align:center; transition:border-color .2s ease, background .2s ease; }
.dropzone:hover{ border-color:rgba(255,255,255,0.12); }
.dropzone.drag{ border-color:rgba(0,255,136,0.5); background:rgba(0,255,136,0.04); }
.dz-icon{ color:var(--muted); transition:color .2s ease; margin-bottom:var(--space-1); }
.dropzone.drag .dz-icon{ color:var(--green); }
.dz-title{ font-size:0.8125rem; color:var(--text); }

.queue{ list-style:none; margin:var(--space-5) 0 0; padding:0; display:flex; flex-direction:column; gap:var(--space-3); }
.q-item{ display:flex; align-items:center; gap:var(--space-3); }
.q-name{ flex:0 1 180px; min-width:0; font-size:0.75rem; color:var(--text); overflow:hidden; text-overflow:ellipsis;
  white-space:nowrap; }
.q-track{ flex:1 1 auto; min-width:60px; height:4px; border-radius:999px; background:rgba(255,255,255,0.05); overflow:hidden; }
.q-fill{ display:block; height:100%; border-radius:999px; background:var(--green); transition:width .18s ease; }
.q-status{ flex:0 0 auto; font-size:0.625rem; letter-spacing:0.06em; color:var(--muted); text-transform:uppercase; }
.q-status.ok{ color:var(--green); }

/* ---- Misc ---- */
.icon-btn{ display:grid; place-items:center; width:38px; height:38px; cursor:pointer; color:var(--text);
  background:var(--elevated); border:1px solid var(--hairline); border-radius:9px; }
.placeholder{ padding:var(--space-8) var(--space-6); }
.overlay{ position:fixed; inset:0; background:rgba(4,6,9,0.6); z-index:45; }

.footer{ display:flex; flex-direction:column; align-items:center; gap:var(--space-1);
  padding:var(--space-7) 0 var(--space-2); border-top:1px solid var(--hairline);
  color:var(--muted); font-size:0.7rem; text-align:center; }

/* ---- Responsive ---- */
@media (max-width:980px){
  .content-grid{ grid-template-columns:1fr; }
  .stat-row{ grid-template-columns:repeat(2,minmax(0,1fr)); }
}
@media (max-width:768px){
  .sidebar{ transform:translateX(-100%); transition:transform .25s ease; box-shadow:0 0 40px rgba(0,0,0,0.6); }
  .sidebar.open{ transform:translateX(0); }
  .sidebar-close{ display:grid; }
  .main-wrap{ margin-left:0; }
  .topbar{ display:flex; align-items:center; gap:var(--space-3); position:sticky; top:0; z-index:40;
    padding:var(--space-3) var(--space-4); background:rgba(8,12,16,0.9); backdrop-filter:blur(8px);
    -webkit-backdrop-filter:blur(8px); border-bottom:1px solid var(--hairline); }
  .main{ padding:var(--space-6) var(--space-4) var(--space-7); }
  .page{ gap:var(--space-7); }
}
@media (max-width:520px){
  .stat-row{ grid-template-columns:1fr; }
}

@media (prefers-reduced-motion: reduce){
  .srag-app *, .srag-app *::before, .srag-app *::after{
    animation-duration:.001ms!important; animation-iteration-count:1!important;
    transition-duration:.001ms!important; }
  .stat:hover, .card:hover{ transform:none; }
}
`;
