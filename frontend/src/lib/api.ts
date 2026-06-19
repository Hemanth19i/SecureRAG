// API client for the SecureRAG Flask backend.
//
// Ported (JS -> TS) from the previous, battle-tested frontend: same JWT model
// with single-flight silent refresh. The browser talks to the same-origin
// `/api` prefix, which Vite proxies to the Flask backend in dev (see
// vite.config.ts) so the backend's CORS config is never exercised. In prod set
// VITE_API_BASE_URL to the deployed API origin.

import type {
  LoginResponse,
  QueryResponse,
  Correlation,
  Enrichment,
  StatsResponse,
  AlertsResponse,
  CaseRow,
  CaseDetail,
  CaseNote,
  MitreMapResponse,
  TimelineResponse,
} from "./backend";

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string) || "/api";

const TOKEN_KEY = "srag_token";
const REFRESH_KEY = "srag_refresh";
const ROLE_KEY = "srag_role";
const USER_KEY = "srag_user";

// Broadcast channel so the AuthProvider can react when apiFetch silently
// refreshes (new token) or tears the session down (logout). A falsy detail
// signals teardown.
export const AUTH_EVENT = "srag:auth";

export class ApiError extends Error {
  status: number;
  data: unknown;
  constructor(message: string, status: number, data?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

/* ---------------------------------------------------------------- token store */

export function getAccessToken(): string {
  try {
    return localStorage.getItem(TOKEN_KEY) || "";
  } catch {
    return "";
  }
}
function getRefreshToken(): string {
  try {
    return localStorage.getItem(REFRESH_KEY) || "";
  } catch {
    return "";
  }
}
export function getStoredRole(): string {
  try {
    return localStorage.getItem(ROLE_KEY) || "";
  } catch {
    return "";
  }
}
export function getStoredUser(): string {
  try {
    return localStorage.getItem(USER_KEY) || "";
  } catch {
    return "";
  }
}

function setAccessToken(t: string) {
  try {
    localStorage.setItem(TOKEN_KEY, t);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent(AUTH_EVENT, { detail: t }));
}

function persistSession(data: LoginResponse, username: string) {
  try {
    localStorage.setItem(TOKEN_KEY, data.access_token);
    if (data.refresh_token) localStorage.setItem(REFRESH_KEY, data.refresh_token);
    if (data.role) localStorage.setItem(ROLE_KEY, data.role);
    localStorage.setItem(USER_KEY, username);
  } catch {
    /* ignore */
  }
}

export function clearSession() {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(ROLE_KEY);
    localStorage.removeItem(USER_KEY);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent(AUTH_EVENT, { detail: "" }));
}

/* ---------------------------------------------------------- single-flight refresh */

let refreshPromise: Promise<string | null> | null = null;
function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;
  const refresh = getRefreshToken();
  if (!refresh) return Promise.resolve(null);
  refreshPromise = (async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: "POST",
        headers: { Authorization: `Bearer ${refresh}` },
      });
      if (!res.ok) return null;
      const data = await res.json().catch(() => null);
      return (data?.access_token as string) || null;
    } catch {
      return null;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

/* ------------------------------------------------------------------- core fetch */

interface FetchOpts {
  method?: string;
  body?: unknown;
}

async function apiFetch<T>(path: string, { method = "GET", body }: FetchOpts = {}): Promise<T> {
  // Never refresh-retry /auth/* — a 401 there is bad credentials, not an expired
  // session (also the infinite-loop guard).
  const isAuthPath = path.startsWith("/auth/");
  const doFetch = (bearer: string) =>
    fetch(`${API_BASE}${path}`, {
      method,
      headers: {
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });

  let res = await doFetch(getAccessToken());

  if (res.status === 401 && !isAuthPath) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      setAccessToken(newToken);
      res = await doFetch(newToken);
    } else {
      clearSession();
    }
  }

  if (!res.ok) {
    let data: unknown = null;
    try {
      data = await res.json();
    } catch {
      /* non-JSON error body */
    }
    const msg =
      res.status === 401
        ? "Unauthorized"
        : (data as { error?: string })?.error || `Request failed (${res.status})`;
    throw new ApiError(msg, res.status, data);
  }
  return res.json() as Promise<T>;
}

/* ----------------------------------------------------------------------- auth */

export async function login(username: string, password: string): Promise<LoginResponse> {
  const data = await apiFetch<LoginResponse>("/auth/login", {
    method: "POST",
    body: { username, password },
  });
  persistSession(data, username);
  // Notify listeners with the fresh token so the app re-renders authenticated.
  window.dispatchEvent(new CustomEvent(AUTH_EVENT, { detail: data.access_token }));
  return data;
}

export function logout() {
  clearSession();
}

/* ------------------------------------------------------------------ endpoints */

export function fetchQuery(query: string, topK?: number): Promise<QueryResponse> {
  return apiFetch<QueryResponse>("/query", {
    method: "POST",
    body: topK ? { query, top_k: topK } : { query },
  });
}

// POST /correlate -> { correlations, summary, high_risk_iocs, analyst_insights }.
// We surface the same Correlation shape the /query endpoint nests, so callers
// share one adapter.
export async function fetchCorrelation(): Promise<Correlation & { high_risk_iocs: string[] }> {
  const data = await apiFetch<{
    correlations: Correlation["details"];
    summary: string[];
    analyst_insights: string[];
    high_risk_iocs: string[];
  }>("/correlate", { method: "POST" });
  return {
    details: data.correlations || {},
    summary: data.summary || [],
    analyst_insights: data.analyst_insights || [],
    high_risk_iocs: data.high_risk_iocs || [],
  };
}

export function fetchEnrichment(value: string): Promise<Enrichment> {
  return apiFetch<Enrichment>(`/enrich?value=${encodeURIComponent(value)}`);
}

export function fetchMitreMap(text: string): Promise<MitreMapResponse> {
  return apiFetch<MitreMapResponse>("/mitre-map", { method: "POST", body: { text } });
}

export function fetchTimeline(text: string): Promise<TimelineResponse> {
  return apiFetch<TimelineResponse>("/timeline", { method: "POST", body: { text } });
}

export function fetchStats(): Promise<StatsResponse> {
  return apiFetch<StatsResponse>("/stats");
}

export function fetchAlerts(since = 0, limit = 50): Promise<AlertsResponse> {
  return apiFetch<AlertsResponse>(
    `/alerts?since=${encodeURIComponent(since)}&limit=${encodeURIComponent(limit)}`,
  );
}

export function ackAlert(alertId: number): Promise<{ alert_id: number; acknowledged: boolean }> {
  return apiFetch(`/alerts/${encodeURIComponent(alertId)}`, {
    method: "PATCH",
    body: { acknowledged: true },
  });
}

export async function fetchReport(analysis: unknown): Promise<string> {
  const data = await apiFetch<{ report: string }>("/report", {
    method: "POST",
    body: { analysis },
  });
  return data.report;
}

/* ------------------------------------------------------------------- cases */

export async function fetchCases(params?: {
  status?: string;
  severity?: string;
  assigned_to?: string;
}): Promise<CaseRow[]> {
  const qs = new URLSearchParams();
  if (params?.status) qs.set("status", params.status);
  if (params?.severity) qs.set("severity", params.severity);
  if (params?.assigned_to) qs.set("assigned_to", params.assigned_to);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  const data = await apiFetch<{ cases: CaseRow[]; total: number }>(`/cases${suffix}`);
  return data.cases || [];
}

export function fetchCase(caseId: string): Promise<CaseDetail> {
  return apiFetch<CaseDetail>(`/cases/${encodeURIComponent(caseId)}`);
}

export async function createCase(payload: {
  title?: string;
  query?: string;
  severity?: string;
  summary?: string;
  snapshot?: unknown;
}): Promise<CaseRow> {
  const data = await apiFetch<{ case: CaseRow }>("/cases", { method: "POST", body: payload });
  return data.case;
}

export async function updateCase(
  caseId: string,
  fields: Partial<{ status: string; severity: string; title: string; assigned_to: string }>,
): Promise<CaseRow> {
  const data = await apiFetch<{ case: CaseRow }>(`/cases/${encodeURIComponent(caseId)}`, {
    method: "PATCH",
    body: fields,
  });
  return data.case;
}

export async function addCaseNote(caseId: string, body: string): Promise<CaseNote[]> {
  const data = await apiFetch<{ notes: CaseNote[] }>(
    `/cases/${encodeURIComponent(caseId)}/notes`,
    { method: "POST", body: { body } },
  );
  return data.notes || [];
}

/* ---------------------------------------------------------------- attack graph */

export function fetchAttackGraph(uploadId: string): Promise<unknown> {
  return apiFetch(`/attack-graph?upload_id=${encodeURIComponent(uploadId)}`);
}

/* -------------------------------------------------------------------- upload */

// Multipart upload — kept separate from apiFetch because the body is FormData
// (the browser sets the multipart boundary; we must NOT set Content-Type) and
// some failures (e.g. 413 from MAX_CONTENT_LENGTH) return non-JSON HTML.
export async function uploadLog(
  file: File,
): Promise<{ message: string; chunks_stored: number }> {
  const doUpload = (bearer: string) => {
    const form = new FormData();
    form.append("file", file);
    return fetch(`${API_BASE}/upload`, {
      method: "POST",
      headers: { ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}) },
      body: form,
    });
  };

  let res = await doUpload(getAccessToken());
  if (res.status === 401) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      setAccessToken(newToken);
      res = await doUpload(newToken);
    } else {
      clearSession();
    }
  }

  let data: { message?: string; chunks_stored?: number; error?: string; upload_id?: string } | null =
    null;
  try {
    data = await res.json();
  } catch {
    /* non-JSON body (e.g. 413 HTML) */
  }
  if (!res.ok) {
    const msg =
      res.status === 401
        ? "Unauthorized"
        : res.status === 413
          ? "File too large — exceeds the server upload limit."
          : res.status === 409
            ? data?.upload_id
              ? `File already ingested (upload ${String(data.upload_id).slice(0, 8)})`
              : data?.error || "File already ingested"
            : data?.error || `Request failed (${res.status})`;
    throw new ApiError(msg, res.status, data);
  }
  return data as { message: string; chunks_stored: number };
}
