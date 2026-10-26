import type { AdminDashboard } from "@/store/api/adminApi"

/**
 * `pending` lists dotted paths of dashboard fields the backend still stubs
 * (e.g. "mrr", "leads.last30d", "memberships.byTier"). A field counts as
 * pending if it — or any parent path — is listed. Pending values must render
 * as "Not available yet", never as a real-looking 0 / null.
 */
export function isPending(dashboard: Pick<AdminDashboard, "pending"> | undefined, path: string) {
  if (!dashboard) return false
  return dashboard.pending.some((p) => path === p || path.startsWith(`${p}.`))
}

/**
 * Numeric dashboard field by dotted path, or null when it's pending, missing
 * or not a finite number (→ "Not available yet"). Resolving the path here,
 * after the pending check, matters: reading `d.leads.last30d` first would
 * crash the whole page if the backend sends a stubbed parent as null.
 */
export function dashValue(dashboard: AdminDashboard | undefined, path: string): number | null {
  if (!dashboard || isPending(dashboard, path)) return null
  let node: unknown = dashboard
  for (const key of path.split(".")) {
    if (node == null || typeof node !== "object") return null
    node = (node as Record<string, unknown>)[key]
  }
  return typeof node === "number" && Number.isFinite(node) ? node : null
}

/** Numeric map at `path` (e.g. listings.byStatus), {} when pending / missing / malformed. */
export function dashCounts(dashboard: AdminDashboard | undefined, path: string): Record<string, number> {
  if (!dashboard || isPending(dashboard, path)) return {}
  let node: unknown = dashboard
  for (const key of path.split(".")) {
    if (node == null || typeof node !== "object") return {}
    node = (node as Record<string, unknown>)[key]
  }
  if (node == null || typeof node !== "object" || Array.isArray(node)) return {}
  return Object.fromEntries(
    Object.entries(node as Record<string, unknown>).filter(([, v]) => typeof v === "number" && Number.isFinite(v)),
  ) as Record<string, number>
}

/** Sum of several dashboard paths — null if ANY of them is unavailable (a partial total would look real). */
export function dashSum(dashboard: AdminDashboard | undefined, paths: string[]): number | null {
  let total = 0
  for (const p of paths) {
    const v = dashValue(dashboard, p)
    if (v == null) return null
    total += v
  }
  return total
}

export const TIER_LABEL: Record<string, string> = { mercury: "Mercury", jupiter: "Jupiter", venus: "Venus" }

export const LISTING_STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  pending_review: "Pending review",
  live: "Live",
  rejected: "Rejected",
  expired: "Expired",
  removed: "Removed",
}

/**
 * Every admin date is shown in IST (and labelled so): the business, its
 * SLAs and its admins are in India, and a bare "12:29" in whatever zone the
 * viewer's laptop happens to be set to is ambiguous in an audit trail.
 */
export const ADMIN_TIME_ZONE = "Asia/Kolkata"
const IST_OFFSET = "+05:30"

function parseDate(value: string | null | undefined) {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

/** "25 Oct 2026, 12:29 pm IST"; "—" for missing / unparseable dates. */
export function formatDateTime(value: string | null | undefined) {
  const d = parseDate(value)
  if (!d) return "—"
  return `${d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: ADMIN_TIME_ZONE,
  })} IST`
}

export function formatDate(value: string | null | undefined) {
  const d = parseDate(value)
  if (!d) return "—"
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: ADMIN_TIME_ZONE })
}

/** IST day bounds for a YYYY-MM-DD date input, as ISO strings the API accepts. */
export function istDayStart(date: string) {
  return `${date}T00:00:00.000${IST_OFFSET}`
}
export function istDayEnd(date: string) {
  return `${date}T23:59:59.999${IST_OFFSET}`
}

/** Today in IST as YYYY-MM-DD (date inputs' max). */
export function istToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: ADMIN_TIME_ZONE }).format(new Date())
}

export function formatPaise(paise: number | null | undefined) {
  if (paise == null) return "—"
  return `₹${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`
}

export function formatCount(n: number | null | undefined) {
  return n == null ? "—" : n.toLocaleString("en-IN")
}
