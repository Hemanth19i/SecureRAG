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
  Database,
  AlertTriangle,
  ShieldCheck,
  Eye,
  Radar,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Config                                                            */
/* ------------------------------------------------------------------ */
const API = import.meta.env.VITE_API_BASE_URL || "/api";
const ENV = (import.meta.env.MODE || "development").toUpperCase();

/* ------------------------------------------------------------------ */
/*  Shared severity helper — defined ONCE, reused everywhere          */
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
  { id: "upload", label: "Upload Logs", icon: UploadCloud },
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
  { id: "docs", label: "Documents Indexed", value: 1287, icon: Database, color: "#58a6ff", delta: "▲ 12% vs last scan", deltaColor: "#00ff88" },
  { id: "iocs", label: "IOCs Extracted", value: 4892, icon: Fingerprint, color: "#bc8cff", delta: "▲ 318 vs last scan", deltaColor: "#00ff88" },
  { id: "critical", label: "Critical Threats", value: 17, icon: AlertTriangle, color: "#ff4444", delta: "▲ 3 new", deltaColor: "#ff4444", critical: true },
  { id: "tech", label: "MITRE Techniques", value: 38, icon: Grid3x3, color: "#00ff88", delta: "▲ 5 mapped", deltaColor: "#00ff88" },
];

const ANALYSES = [
  { id: "a1", doc: "auth_ssh_2026-06-14.log", severity: "critical", iocs: 42, mitre: 6, time: "2m ago" },
  { id: "a2", doc: "firewall_edge_egress.csv", severity: "high", iocs: 28, mitre: 4, time: "18m ago" },
  { id: "a3", doc: "dns_exfil_capture.log", severity: "high", iocs: 19, mitre: 3, time: "41m ago" },
  { id: "a4", doc: "endpoint_av_quarantine.txt", severity: "medium", iocs: 11, mitre: 2, time: "1h ago" },
  { id: "a5", doc: "vpn_session_audit.log", severity: "low", iocs: 6, mitre: 1, time: "3h ago" },
  { id: "a6", doc: "web_access_proxy.log", severity: "medium", iocs: 14, mitre: 2, time: "5h ago" },
];

/* ------------------------------------------------------------------ */
/*  Motion variants                                                   */
/* ------------------------------------------------------------------ */
function useVariants() {
  const reduce = useReducedMotion();
  const container = {
    hidden: { opacity: reduce ? 1 : 0 },
    show: {
      opacity: 1,
      transition: reduce ? {} : { staggerChildren: 0.06, delayChildren: 0.04 },
    },
  };
  const item = reduce
    ? { hidden: { opacity: 1 }, show: { opacity: 1 } }
    : {
        hidden: { opacity: 0, y: 14 },
        show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } },
      };
  return { container, item, reduce };
}

/* ------------------------------------------------------------------ */
/*  Animated count-up number                                          */
/* ------------------------------------------------------------------ */
function Counter({ value }) {
  const reduce = useReducedMotion();
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    // Reduced motion: render the final value directly, no animation, no setState here.
    if (reduce) return;
    const controls = animate(0, value, {
      duration: 1.2,
      ease: "easeOut",
      onUpdate: (v) => setDisplay(v),
    });
    return () => controls.stop();
  }, [value, reduce]);
  return <>{Math.round(reduce ? value : display).toLocaleString()}</>;
}

/* ------------------------------------------------------------------ */
/*  Stat card                                                         */
/* ------------------------------------------------------------------ */
function StatCard({ stat, variants }) {
  const Icon = stat.icon;
  return (
    <motion.div className="glass stat-card" variants={variants}>
      <div className="stat-top">
        <span
          className="stat-icon"
          style={{ background: `${stat.color}1f`, color: stat.color }}
          aria-hidden="true"
        >
          <Icon size={20} strokeWidth={2} />
        </span>
        <span className="stat-delta mono" style={{ color: stat.deltaColor }}>
          {stat.delta}
        </span>
      </div>
      <div className="stat-num mono" style={stat.critical ? { color: "#ff4444" } : undefined}>
        <Counter value={stat.value} />
      </div>
      <div className="stat-label">{stat.label}</div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Upload section (dropzone + queue)                                 */
/* ------------------------------------------------------------------ */
function UploadSection({ variants }) {
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
      // Wire to the real backend (multipart). Network/auth errors are
      // swallowed so the UI demo stays clean without a running server.
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
        p = Math.min(100, p + (8 + Math.random() * 16));
        setQueue((q) => q.map((it) => (it.id === id ? { ...it, progress: p } : it)));
        if (p < 100) {
          timers.current[id] = setTimeout(tick, 180);
        } else {
          setQueue((q) => q.map((it) => (it.id === id ? { ...it, progress: 100, status: "Indexed" } : it)));
        }
      };
      timers.current[id] = setTimeout(tick, 220);
    },
    [reduce]
  );

  const enqueue = useCallback(
    (fileList) => {
      const files = Array.from(fileList || []);
      files.forEach((file) => {
        const id = `${file.name}-${file.size}-${Math.random().toString(36).slice(2, 8)}`;
        setQueue((q) => [{ id, name: file.name, progress: 0, status: "Uploading" }, ...q].slice(0, 8));
        runUpload(id, file);
      });
    },
    [runUpload]
  );

  const onDrop = (e) => {
    e.preventDefault();
    setDrag(false);
    if (e.dataTransfer?.files?.length) enqueue(e.dataTransfer.files);
  };

  return (
    <motion.section className="glass pad" variants={variants} aria-labelledby="upload-h">
      <h2 id="upload-h" className="card-title">Upload Logs</h2>

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
        onDrop={onDrop}
      >
        <UploadCloud size={34} strokeWidth={1.6} className="dz-icon" aria-hidden="true" />
        <div className="dz-title">Drop log files or click to browse</div>
        <div className="dz-sub mono">PDF · TXT · LOG · CSV</div>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="visually-hidden"
          accept=".pdf,.txt,.log,.csv"
          onChange={(e) => {
            enqueue(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {queue.length > 0 && (
        <ul className="queue" aria-label="Upload queue">
          {queue.map((it) => (
            <li className="q-item" key={it.id}>
              <FileText size={16} className="q-file-icon" aria-hidden="true" />
              <span className="q-name mono" title={it.name}>{it.name}</span>
              <span className="q-bar" aria-hidden="true">
                <span className="q-fill" style={{ width: `${it.progress}%` }} />
              </span>
              <span className={`chip ${it.status === "Indexed" ? "chip-ok" : "chip-busy"}`}>
                {it.status}
              </span>
            </li>
          ))}
        </ul>
      )}
    </motion.section>
  );
}

/* ------------------------------------------------------------------ */
/*  Recent analyses table                                             */
/* ------------------------------------------------------------------ */
function SeverityPill({ level }) {
  const c = severityColor(level);
  return (
    <span
      className="sev-pill mono"
      style={{ color: c, background: `${c}1a`, borderColor: `${c}55` }}
    >
      {String(level).toUpperCase()}
    </span>
  );
}

function RecentAnalyses({ variants }) {
  const { container, item } = useVariants();
  return (
    <motion.section className="glass pad" variants={variants} aria-labelledby="recent-h">
      <h2 id="recent-h" className="card-title">Recent Analyses</h2>
      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th scope="col">Document</th>
              <th scope="col">Severity</th>
              <th scope="col">IOCs</th>
              <th scope="col">MITRE</th>
              <th scope="col">Analyzed</th>
              <th scope="col"><span className="visually-hidden">Action</span></th>
            </tr>
          </thead>
          <motion.tbody variants={container} initial="hidden" animate="show">
            {ANALYSES.map((row) => (
              <motion.tr key={row.id} variants={item}>
                <td className="td-doc mono">{row.doc}</td>
                <td><SeverityPill level={row.severity} /></td>
                <td className="mono">{row.iocs}</td>
                <td className="mono">{row.mitre}</td>
                <td className="td-muted mono">{row.time}</td>
                <td className="td-action">
                  <button className="view-btn" type="button" aria-label={`View analysis for ${row.doc}`}>
                    <Eye size={15} aria-hidden="true" />
                    <span>View</span>
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
/*  Views                                                             */
/* ------------------------------------------------------------------ */
function Dashboard() {
  const { container, item } = useVariants();
  return (
    <motion.div variants={container} initial="hidden" animate="show" className="stack">
      <motion.div className="stat-grid" variants={container}>
        {STATS.map((s) => (
          <StatCard key={s.id} stat={s} variants={item} />
        ))}
      </motion.div>
      <UploadSection variants={item} />
      <RecentAnalyses variants={item} />
    </motion.div>
  );
}

function Placeholder({ id }) {
  const nav = NAV_BY_ID[id];
  const Icon = nav?.icon || ShieldCheck;
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="glass pad placeholder"
    >
      <span className="ph-icon" aria-hidden="true"><Icon size={28} /></span>
      <h2 className="card-title">{nav?.label}</h2>
      <p className="ph-text">
        This module is backed by the SecureRAG analysis API. The interactive view is being wired up — the
        dashboard is the live surface for now.
      </p>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sidebar                                                           */
/* ------------------------------------------------------------------ */
function Sidebar({ active, onSelect, open, onClose }) {
  return (
    <nav className={`sidebar${open ? " open" : ""}`} aria-label="Primary">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true"><Radar size={20} /></span>
        <span className="brand-text">Secure<span className="brand-rag">RAG</span></span>
        <button className="sidebar-close" type="button" aria-label="Close navigation" onClick={onClose}>
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
                <Icon size={18} aria-hidden="true" />
                <span>{n.label}</span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="sidebar-foot">
        <span className="mono">v0.9.0</span>
        <span className="mono">SOC&nbsp;CONSOLE</span>
      </div>
    </nav>
  );
}

/* ------------------------------------------------------------------ */
/*  App shell                                                         */
/* ------------------------------------------------------------------ */
export default function App() {
  const [active, setActive] = useState("dashboard");
  const [open, setOpen] = useState(false);
  const reduce = useReducedMotion();

  const select = (id) => {
    setActive(id);
    setOpen(false);
  };

  return (
    <div className="srag-app">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <Sidebar active={active} onSelect={select} open={open} onClose={() => setOpen(false)} />
      {open && <div className="overlay" onClick={() => setOpen(false)} aria-hidden="true" />}

      <div className="main-wrap">
        <div className="topbar">
          <button className="hamburger" type="button" aria-label="Open navigation" onClick={() => setOpen(true)}>
            <Menu size={20} />
          </button>
          <span className="brand-text sm">Secure<span className="brand-rag">RAG</span></span>
        </div>

        <main className="main">
          <header className="page-head">
            <div>
              <h1 className="page-title">{NAV_BY_ID[active]?.label}</h1>
              <p className="page-sub">Threat intelligence &amp; log correlation console</p>
            </div>
            <div className="head-right">
              <span className="status-pill mono">
                <span className="status-dot" aria-hidden="true" />
                SYSTEM ONLINE
              </span>
              <span className="env-badge mono">ENV: {ENV}</span>
            </div>
          </header>

          <motion.div
            key={active}
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            <AnimatePresence mode="wait">
              {active === "dashboard" ? <Dashboard key="dash" /> : <Placeholder key={active} id={active} />}
            </AnimatePresence>
          </motion.div>
        </main>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Scoped styles (single-file, no Tailwind dependency)               */
/* ------------------------------------------------------------------ */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Share+Tech+Mono&display=swap');

:root{
  --bg:#080c10; --surface:#0d1117; --surface-2:#161b22; --border:#21262d;
  --green:#00ff88; --red:#ff4444; --orange:#ff8c42; --yellow:#ffd700; --blue:#58a6ff; --purple:#bc8cff;
  --text:#e6edf3; --muted:#7d8590;
  --mono:'Share Tech Mono', ui-monospace, Consolas, monospace;
  --sans:'Inter', system-ui, 'Segoe UI', Roboto, sans-serif;
  --glass:rgba(22,27,34,0.55);
}

/* Reset the Vite-starter #root constraints so the dashboard runs full-bleed */
#root{ width:100%!important; max-width:none!important; margin:0!important; padding:0!important;
  text-align:left!important; border:0!important; min-height:100vh; display:block!important; }
body{ margin:0; background:var(--bg); }

.srag-app{
  display:flex; min-height:100vh; color:var(--text);
  font-family:var(--sans); font-size:15px; line-height:1.5; letter-spacing:0;
  background:
    radial-gradient(1100px 520px at 0% -10%, rgba(0,255,136,0.05), transparent 60%),
    radial-gradient(900px 500px at 100% 0%, rgba(88,166,255,0.04), transparent 55%),
    var(--bg);
  -webkit-font-smoothing:antialiased; -moz-osx-font-smoothing:grayscale;
}
.srag-app *{ box-sizing:border-box; }
.mono{ font-family:var(--mono); letter-spacing:.4px; }

/* Focus visibility */
.srag-app a:focus-visible,
.srag-app button:focus-visible,
.srag-app [tabindex]:focus-visible,
.srag-app input:focus-visible{
  outline:2px solid var(--green); outline-offset:2px; border-radius:8px;
}

.srag-app .visually-hidden{
  position:absolute!important; width:1px; height:1px; padding:0; margin:-1px;
  overflow:hidden; clip:rect(0 0 0 0); white-space:nowrap; border:0;
}

/* ---------- Sidebar ---------- */
.sidebar{
  position:fixed; top:0; left:0; bottom:0; width:240px; z-index:50;
  display:flex; flex-direction:column; padding:20px 14px;
  background:linear-gradient(180deg, rgba(13,17,23,0.96), rgba(8,12,16,0.96));
  border-right:1px solid var(--border);
}
.brand{ display:flex; align-items:center; gap:10px; padding:6px 8px 22px; }
.brand-mark{ display:grid; place-items:center; width:34px; height:34px; border-radius:9px;
  color:var(--green); background:rgba(0,255,136,0.1); border:1px solid rgba(0,255,136,0.25); }
.brand-text{ font-weight:700; font-size:19px; letter-spacing:-.3px; color:var(--text); }
.brand-text.sm{ font-size:17px; }
.brand-rag{ color:var(--green); }
.sidebar-close{ display:none; margin-left:auto; background:none; border:0; color:var(--muted); cursor:pointer; padding:4px; }

.nav-list{ list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:4px; }
.nav-item{
  width:100%; display:flex; align-items:center; gap:12px; cursor:pointer;
  padding:11px 12px; border-radius:9px; border:0; border-left:2px solid transparent;
  background:none; color:var(--muted); font-family:var(--sans); font-size:14.5px; text-align:left;
  transition:background .18s ease, color .18s ease, border-color .18s ease;
}
.nav-item:hover{ background:rgba(255,255,255,0.04); color:var(--text); }
.nav-item.active{
  color:var(--text); background:rgba(0,255,136,0.07); border-left-color:var(--green);
  box-shadow:inset 0 0 0 1px rgba(0,255,136,0.08), -6px 0 16px -10px rgba(0,255,136,0.8);
}
.nav-item.active svg{ color:var(--green); }
.nav-item svg{ flex:0 0 auto; }

.sidebar-foot{ margin-top:auto; display:flex; justify-content:space-between;
  padding:14px 8px 4px; color:var(--muted); font-size:11px; border-top:1px solid var(--border); }

/* ---------- Main ---------- */
.main-wrap{ flex:1; margin-left:240px; min-width:0; display:flex; flex-direction:column; }
.topbar{ display:none; }
.main{ flex:1; padding:28px 32px 64px; min-width:0; }

.page-head{ display:flex; align-items:flex-start; justify-content:space-between; gap:16px;
  flex-wrap:wrap; margin-bottom:24px; }
.page-title{ font-size:24px; font-weight:600; margin:0; letter-spacing:-.4px; color:var(--text); }
.page-sub{ margin:4px 0 0; color:var(--muted); font-size:13.5px; }
.head-right{ display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
.status-pill{ display:inline-flex; align-items:center; gap:8px; font-size:12px; color:var(--green);
  padding:7px 13px; border-radius:999px; background:rgba(0,255,136,0.07); border:1px solid rgba(0,255,136,0.3); }
.status-dot{ width:8px; height:8px; border-radius:50%; background:var(--green);
  box-shadow:0 0 8px var(--green); animation:pulse 1.8s ease-in-out infinite; }
.env-badge{ font-size:11px; color:var(--muted); padding:7px 11px; border-radius:7px;
  background:var(--surface-2); border:1px solid var(--border); }

.stack{ display:flex; flex-direction:column; gap:18px; }

/* ---------- Glass cards ---------- */
.glass{
  position:relative; background:var(--glass); border:1px solid var(--border); border-radius:12px;
  backdrop-filter:blur(12px); -webkit-backdrop-filter:blur(12px);
  box-shadow:inset 0 1px 0 rgba(255,255,255,0.06), 0 10px 30px -22px rgba(0,0,0,0.9);
  transition:transform .2s ease, border-color .2s ease, box-shadow .2s ease;
}
.glass:hover{
  transform:translateY(-3px); border-color:var(--green);
  box-shadow:inset 0 1px 0 rgba(255,255,255,0.08), 0 14px 34px -20px rgba(0,255,136,0.35),
    0 0 0 1px rgba(0,255,136,0.12);
}
.pad{ padding:20px; }
.card-title{ font-size:15px; font-weight:600; margin:0 0 16px; color:var(--text); letter-spacing:-.2px; }

/* ---------- Stat cards ---------- */
.stat-grid{ display:grid; grid-template-columns:repeat(4, minmax(0,1fr)); gap:16px; }
.stat-card{ padding:18px; }
.stat-top{ display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:14px; }
.stat-icon{ width:42px; height:42px; border-radius:10px; display:grid; place-items:center; }
.stat-delta{ font-size:11.5px; white-space:nowrap; }
.stat-num{ font-size:32px; font-weight:400; line-height:1; color:var(--text); }
.stat-label{ margin-top:7px; color:var(--muted); font-size:13px; }

/* ---------- Dropzone ---------- */
.dropzone{ display:flex; flex-direction:column; align-items:center; justify-content:center; gap:7px;
  padding:34px 20px; border:1.5px dashed var(--border); border-radius:12px; cursor:pointer; text-align:center;
  background:rgba(0,0,0,0.12); transition:border-color .2s ease, background .2s ease; }
.dropzone:hover{ border-color:#30363d; }
.dropzone.drag{ border-color:var(--green); background:rgba(0,255,136,0.06); }
.dz-icon{ color:var(--muted); transition:color .2s ease; }
.dropzone.drag .dz-icon{ color:var(--green); }
.dz-title{ font-size:14.5px; color:var(--text); }
.dz-sub{ font-size:12px; color:var(--muted); letter-spacing:1px; }

.queue{ list-style:none; margin:16px 0 0; padding:0; display:flex; flex-direction:column; gap:4px; }
.q-item{ display:flex; align-items:center; gap:12px; padding:9px 4px; }
.q-file-icon{ color:var(--muted); flex:0 0 auto; }
.q-name{ flex:0 1 200px; min-width:0; font-size:12.5px; color:var(--text); overflow:hidden;
  text-overflow:ellipsis; white-space:nowrap; }
.q-bar{ flex:1 1 auto; min-width:60px; height:6px; border-radius:999px; background:var(--surface-2); overflow:hidden; }
.q-fill{ display:block; height:100%; border-radius:999px;
  background:linear-gradient(90deg, var(--green), #6effb9); transition:width .2s ease; }
.chip{ flex:0 0 auto; font-family:var(--mono); font-size:10.5px; letter-spacing:.6px; padding:4px 9px;
  border-radius:999px; border:1px solid transparent; }
.chip-busy{ color:var(--blue); background:rgba(88,166,255,0.12); border-color:rgba(88,166,255,0.35); }
.chip-ok{ color:var(--green); background:rgba(0,255,136,0.1); border-color:rgba(0,255,136,0.35); }

/* ---------- Table ---------- */
.tbl-wrap{ overflow-x:auto; }
.tbl{ width:100%; border-collapse:collapse; min-width:620px; }
.tbl th{ text-align:left; font-family:var(--mono); font-size:10.5px; letter-spacing:1px; text-transform:uppercase;
  color:var(--muted); font-weight:400; padding:0 14px 12px; border-bottom:1px solid var(--border); }
.tbl td{ padding:13px 14px; border-bottom:1px solid rgba(33,38,45,0.6); font-size:13.5px; color:var(--text); }
.tbl tbody tr{ transition:background .15s ease; }
.tbl tbody tr:hover{ background:rgba(255,255,255,0.025); }
.tbl tbody tr:last-child td{ border-bottom:0; }
.td-doc{ font-size:12.5px; color:var(--text); }
.td-muted{ color:var(--muted); font-size:12.5px; }
.sev-pill{ display:inline-block; font-size:10.5px; letter-spacing:.6px; padding:3px 9px; border-radius:999px; border:1px solid; }
.td-action{ text-align:right; }
.view-btn{ display:inline-flex; align-items:center; gap:6px; cursor:pointer; font-size:12.5px;
  color:var(--muted); background:none; border:1px solid var(--border); border-radius:8px; padding:6px 11px;
  font-family:var(--sans); transition:color .18s ease, border-color .18s ease, background .18s ease; }
.view-btn:hover{ color:var(--green); border-color:rgba(0,255,136,0.4); background:rgba(0,255,136,0.05); }

/* ---------- Placeholder ---------- */
.placeholder{ display:flex; flex-direction:column; align-items:center; text-align:center; gap:12px; padding:56px 24px; }
.ph-icon{ display:grid; place-items:center; width:60px; height:60px; border-radius:14px;
  color:var(--green); background:rgba(0,255,136,0.08); border:1px solid rgba(0,255,136,0.2); }
.ph-text{ max-width:440px; color:var(--muted); font-size:14px; line-height:1.6; margin:0; }

.overlay{ position:fixed; inset:0; background:rgba(4,6,9,0.6); z-index:45;
  backdrop-filter:blur(2px); -webkit-backdrop-filter:blur(2px); }

@keyframes pulse{ 0%,100%{ opacity:1; transform:scale(1); } 50%{ opacity:.45; transform:scale(.85); } }

/* ---------- Responsive ---------- */
@media (max-width:1024px){
  .stat-grid{ grid-template-columns:repeat(2, minmax(0,1fr)); }
}
@media (max-width:768px){
  .sidebar{ transform:translateX(-100%); transition:transform .25s ease; box-shadow:0 0 40px rgba(0,0,0,0.6); }
  .sidebar.open{ transform:translateX(0); }
  .sidebar-close{ display:block; }
  .main-wrap{ margin-left:0; }
  .topbar{ display:flex; align-items:center; gap:12px; position:sticky; top:0; z-index:40;
    padding:12px 16px; background:rgba(8,12,16,0.92); backdrop-filter:blur(10px);
    -webkit-backdrop-filter:blur(10px); border-bottom:1px solid var(--border); }
  .hamburger{ display:grid; place-items:center; background:var(--surface-2); border:1px solid var(--border);
    color:var(--text); border-radius:9px; width:38px; height:38px; cursor:pointer; }
  .main{ padding:20px 16px 52px; }
  .page-title{ font-size:21px; }
}
@media (max-width:560px){
  .stat-grid{ grid-template-columns:1fr; }
  .head-right{ width:100%; }
}

@media (prefers-reduced-motion: reduce){
  .srag-app *, .srag-app *::before, .srag-app *::after{
    animation-duration:.001ms!important; animation-iteration-count:1!important;
    transition-duration:.001ms!important; scroll-behavior:auto!important;
  }
  .glass:hover{ transform:none; }
  .status-dot{ animation:none; }
}
`;
