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

/** Value for a StatCard: null when the field is pending (→ "Not available yet"). */
export function pendingOr<T>(dashboard: AdminDashboard | undefined, path: string, value: T): T | null {
  return isPending(dashboard, path) ? null : value
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
