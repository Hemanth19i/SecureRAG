// Backend response shapes — the exact contract from server/tests/CONTRACT.md and
// server/api/routes.py. These are the REAL shapes the Flask API returns; the UI
// adapts to them (never the reverse). Keep this file in sync with the backend.

export type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
export type Role = "ADMIN" | "ANALYST" | "VIEWER";

// --- POST /auth/login ---
export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  role: Role;
}

// --- analyze_threat() output inside /query ---
export interface Analysis {
  answer: string;
  severity: Severity | string;
  summary: string;
  threats: string[];
  recommendations: string[];
  analysis_method?: string; // present only on the rule-based fallback path
  error?: string; // present only on hard failure
}

// --- extract_iocs() — exactly these 7 list keys ---
export interface Iocs {
  ips: string[];
  domains: string[];
  hashes: string[];
  cves: string[];
  emails: string[];
  ipv6: string[];
  urls: string[];
}

// --- correlation.details[<ioc>] ---
export interface CorrelationDetail {
  category: string;
  type: string;
  role: string;
  seen_in_files: string[];
  frequency: number;
  first_seen: string;
  last_seen: string;
  risk_level: "HIGH" | "MEDIUM" | "LOW";
  context_flags: string[];
}

export interface Correlation {
  details: Record<string, CorrelationDetail>;
  summary: string[];
  analyst_insights: string[];
}

// --- mitre.techniques[] (+ kill_chain, same items phase-ordered) ---
export interface MitreTechnique {
  tactic: string;
  technique: string; // Txxxx
  name: string;
  phase: string; // TAxxxx
  evidence: string[];
  inferred: boolean;
  note: string;
  confidence: "HIGH" | "MEDIUM" | "LOW";
}

export interface Mitre {
  techniques: MitreTechnique[];
  kill_chain: MitreTechnique[];
}

// --- timeline.events[] — note event_type / mitre_technique key names ---
export interface BackendTimelineEvent {
  timestamp: string;
  event_type: string;
  description: string;
  mitre_technique: string; // Txxxx
  severity: "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN" | string;
  phase_order: number;
}

export interface Timeline {
  events: BackendTimelineEvent[];
  summary: string;
}

// --- citations[] — additive source-grounding for the answer ---
export interface Citation {
  chunk_id: string | null;
  source_file: string | null;
  snippet: string;
  score: number | null; // 1/(1+distance), or null on the hybrid path
}

// --- POST /query full response ---
export interface QueryResponse {
  status: string;
  analysis: Analysis;
  iocs: Iocs;
  correlation: Correlation;
  mitre: Mitre;
  timeline: Timeline;
  citations: Citation[];
  chunks_used: number;
  query: string;
}

// --- GET /stats ---
export interface EvidenceRow {
  upload_id: string;
  filename: string;
  severity: string;
  ioc_count: number;
  mitre_count: number;
  ingested_at: string;
}

export interface StatsResponse {
  readouts: Record<string, number>;
  evidence: EvidenceRow[];
}

// --- GET /alerts ---
export interface AlertRow {
  alert_id: number;
  alert_type: string;
  title: string;
  severity: string;
  created_at: string;
  acknowledged: boolean;
}

export interface AlertsResponse {
  alerts: AlertRow[];
  total: number;
  cursor: number;
}

// --- GET /enrich?value= ---
export interface Enrichment {
  status: string; // ok | unavailable | unsupported | error | ...
  verdict?: string; // malicious | suspicious | clean | unknown
  abuse_confidence?: number;
  [k: string]: unknown;
}

// --- /cases ---
export interface CaseRow {
  case_id: string;
  title: string;
  severity: string;
  status: string; // OPEN | IN_PROGRESS | CONTAINED | CLOSED
  created_by: string;
  assigned_to: string | null;
  summary: string;
  query: string;
  created_at: string;
  updated_at?: string;
  // Stored at creation (mirrors the /query response); present on the detail view.
  snapshot?: unknown;
}

// Real columns from case_audit (append-only). `content` is a JSON string for
// typed events ({field,from,to} / {evidence_type} / {title,severity}) or plain
// text for a note. entry_type ∈ created|status_change|assignment|note|evidence_linked.
export interface CaseAuditEntry {
  audit_id: number;
  case_id: string;
  author: string;
  entry_type: string;
  content: string | null;
  created_at: string;
}

export interface CaseNote {
  note_id: number;
  case_id: string;
  author: string;
  body: string;
  created_at: string;
}

export interface CaseEvidence {
  evidence_id: number;
  case_id: string;
  evidence_type: string;
  payload: unknown;
  linked_by: string;
  created_at: string;
}

// GET /cases/<id> returns the case plus these nested collections.
export interface CaseDetail extends CaseRow {
  evidence: CaseEvidence[];
  audit: CaseAuditEntry[];
}

// --- POST /mitre-map / POST /timeline (text-driven endpoints) ---
export interface MitreMapResponse {
  techniques: MitreTechnique[];
  kill_chain: MitreTechnique[];
  total_techniques: number;
}

export interface TimelineResponse {
  timeline: BackendTimelineEvent[];
  summary: string;
  total_events: number;
}
