import { useCallback } from "react"
import { getApiErrorCode, getApiErrorMessage } from "@/lib/api-error"
import { useAdminSession } from "@/lib/admin-session"
import { adminApi, type ConfigEntry } from "@/store/api/adminApi"
import { useAppDispatch } from "@/store/hooks"

/** Writes on every Config tab are super_admin-only (backend `requireRole("super_admin")`). */
export function useIsSuperAdmin() {
  return useAdminSession((s) => s.adminUser?.role === "super_admin")
}

/**
 * "4,999.50" / "4999.5" / "4999" → 499950 paise, using string maths only —
 * `Math.round(Number(x) * 100)` is fine for most inputs but this keeps
 * money exact for every one. Returns null for anything that isn't a
 * non-negative rupee amount with at most 2 decimals.
 *
 * Commas are only accepted as real thousands separators (Indian "1,00,000"
 * or Western "100,000") — stripping every comma turned a European-style
 * "1,5" into ₹15.
 */
export function rupeesToPaise(input: string): number | null {
  const cleaned = input.replace(/[\s₹]/g, "")
  const match = /^(\d{1,3}(?:,\d{2})*,\d{3}|\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?$/.exec(cleaned)
  if (!match) return null
  const paise = Number(match[1].replace(/,/g, "")) * 100 + Number((match[2] ?? "").padEnd(2, "0"))
  return Number.isSafeInteger(paise) ? paise : null
}

/** 499950 → "4999.50"; whole rupees drop the decimals ("4999"). For form inputs. */
export function paiseToRupeesInput(paise: number): string {
  const rupees = Math.trunc(paise / 100)
  const rest = Math.abs(paise % 100)
  return rest ? `${rupees}.${String(rest).padStart(2, "0")}` : String(rupees)
}

/** 499900 → "₹4,999"; 0 → "Free". For display. */
export function formatPaise(paise: number): string {
  if (!paise) return "Free"
  return `₹${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`
}

/** Always shown in IST and labelled — the rest of the console (audit log, users) does the same, so times line up. */
export function formatDateTime(iso?: string | null): string {
  if (!iso) return "—"
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? "—"
    : `${d.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })} IST`
}

/** Backend message when it's useful, otherwise a readable fallback. */
export function describeAdminError(error: unknown, fallback: string): string {
  const code = getApiErrorCode(error)
  if (code === "ADMIN_FORBIDDEN") return "Your admin role can't make this change — super admin only."
  if (code === "DUPLICATE") return getApiErrorMessage(error) ?? "That already exists."
  if (code === "NOT_FOUND") return getApiErrorMessage(error) ?? "It no longer exists — refresh and try again."
  if (!code && error && typeof error === "object" && "status" in error && (error as { status: unknown }).status === "FETCH_ERROR")
    return "Couldn't reach the server — check your connection and try again."
  return getApiErrorMessage(error) ?? fallback
}

/** Shown wherever isValidDisplayName fails — say what's allowed, not just the length. */
export const DISPLAY_NAME_RULE = "2–60 characters: letters, digits, spaces and . ' - & / ( )"

/** Letters (any script incl. Indic vowel signs), digits, spaces, `.`, `'`, `-`, `&`, `/`, `(`, `)`; 2–60 chars. */
export function isValidDisplayName(value: string): boolean {
  const v = value.trim()
  return v.length >= 2 && v.length <= 60 && /^[\p{L}\p{N}][\p{L}\p{M}\p{N}\s.'&/()-]*$/u.test(v)
}

/**
 * Reads the config list straight from the server (bypassing the cache) —
 * used right before a write to catch another admin's change, since
 * `PUT /admin/config/:key` is last-write-wins and also silently upserts.
 */
export function useFreshConfig() {
  const dispatch = useAppDispatch()
  return useCallback(async (): Promise<ConfigEntry[]> => {
    const sub = dispatch(adminApi.endpoints.getConfig.initiate(undefined, { forceRefetch: true }))
    try {
      return await sub.unwrap()
    } finally {
      sub.unsubscribe()
    }
  }, [dispatch])
}

/** "Can't save" message shown when a key changed (or appeared) on the server since this screen loaded. */
export const STALE_CONFIG_MESSAGE = "It was changed by another admin since you opened this page — review the new value and try again."
