// Small adapters between backend shapes and the UI. The backend is the source
// of truth; these normalize casing/keys so the existing components render real
// data without fabricating anything.

import type { Iocs } from "./backend"

export type UiSeverity = "critical" | "high" | "medium" | "low"

// Backend severities are UPPERCASE (CRITICAL/HIGH/MEDIUM/LOW) and timelines can
// emit UNKNOWN; the UI palette is lowercase critical/high/medium/low.
export function normSeverity(s: string | null | undefined): UiSeverity {
  const v = String(s || "").toLowerCase()
  if (v === "critical") return "critical"
  if (v === "high") return "high"
  if (v === "medium") return "medium"
  if (v === "low") return "low"
  return "low" // UNKNOWN / empty -> low (never invent a higher severity)
}

// Hex straight from the sr-* palette (tailwind.config.js) for inline styles.
export const SEV_HEX: Record<string, string> = {
  critical: "#EF4444",
  high: "#FF7A00",
  medium: "#EAB308",
  low: "#3B82F6",
  // threat-intel verdicts reuse the same scale
  malicious: "#EF4444",
  suspicious: "#FF7A00",
  clean: "#22C55E",
  unknown: "#8A8A8A",
}

export function sevHex(level: string): string {
  return SEV_HEX[String(level).toLowerCase()] || "#8A8A8A"
}

// Risk level (HIGH/MEDIUM/LOW from correlation.details) -> palette colour.
export function riskHex(risk: string): string {
  const v = String(risk || "").toLowerCase()
  if (v === "high") return "#EF4444"
  if (v === "medium") return "#EAB308"
  return "#3B82F6"
}

// True only for routable public IPv4 — used to decide which IOCs are enrichable
// (skips RFC1918 / loopback / link-local, and any non-IPv4 value).
export function isPublicIp(value: string): boolean {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(String(value).trim())
  if (!m) return false
  const o = m.slice(1).map(Number)
  if (o.some((n) => n > 255)) return false
  const [a, b] = o
  if (a === 0 || a === 10 || a === 127) return false
  if (a === 192 && b === 168) return false
  if (a === 172 && b >= 16 && b <= 31) return false
  if (a === 169 && b === 254) return false
  return true
}

export interface FlatIoc {
  value: string
  type: string
}

// Flatten the 7 IOC buckets into a typed list for table/grid rendering.
export function flattenIocs(iocs: Iocs | undefined): FlatIoc[] {
  if (!iocs) return []
  const buckets: Array<[keyof Iocs, string]> = [
    ["ips", "ip"],
    ["ipv6", "ipv6"],
    ["domains", "domain"],
    ["urls", "url"],
    ["hashes", "hash"],
    ["cves", "cve"],
    ["emails", "email"],
  ]
  const out: FlatIoc[] = []
  for (const [key, type] of buckets) {
    for (const value of iocs[key] || []) out.push({ value, type })
  }
  return out
}

export function iocCount(iocs: Iocs | undefined): number {
  if (!iocs) return 0
  return (
    iocs.ips.length +
    iocs.ipv6.length +
    iocs.domains.length +
    iocs.urls.length +
    iocs.hashes.length +
    iocs.cves.length +
    iocs.emails.length
  )
}
