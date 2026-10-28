/**
 * "Take me back where I was" after an expired admin session.
 *
 * When the session dies, the current page is remembered in THIS TAB's
 * sessionStorage — never put in the URL — and used once, right after the
 * next successful sign-in. Because nothing comes from a query string, a
 * crafted link can't turn this into an open redirect; and the value is still
 * checked to be an internal portal path before it's used.
 */
const KEY = "vxa-return-to"

// "/users?status=suspended" yes; "//evil.com", "/\\evil", "/login…", "/totp…" no.
function isSafeInternalPath(path: string): boolean {
  return /^\/(?![/\\])/.test(path) && !/^\/(login|totp)(\/|\?|$)/.test(path) && path.length <= 500
}

/** Call just before redirecting to /login because the session ended. */
export function rememberReturnTo(): void {
  if (typeof window === "undefined") return
  const path = window.location.pathname + window.location.search
  if (!isSafeInternalPath(path)) return
  try {
    window.sessionStorage.setItem(KEY, path)
  } catch {
    // Storage blocked — they'll just land on the dashboard.
  }
}

/** The remembered page (consumed — it's only ever used once), or `fallback`. */
export function takeReturnTo(fallback: string): string {
  if (typeof window === "undefined") return fallback
  try {
    const path = window.sessionStorage.getItem(KEY)
    window.sessionStorage.removeItem(KEY)
    return path && isSafeInternalPath(path) ? path : fallback
  } catch {
    return fallback
  }
}

/** A deliberate sign-out shouldn't bring the next person back to this page. */
export function clearReturnTo(): void {
  if (typeof window === "undefined") return
  try {
    window.sessionStorage.removeItem(KEY)
  } catch {
    // nothing stored
  }
}
