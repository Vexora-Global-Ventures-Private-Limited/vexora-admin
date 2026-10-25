const ACCESS_TOKEN_KEY = "vxa-admin-access-token"
// tempToken (admin_auth.json) is a 10-minute, single-purpose credential that
// only ever carries the browser from /login to /totp/enroll or /totp/verify
// within the same tab — sessionStorage (tab-scoped, gone on tab close) fits
// its lifetime far better than the 8h accessToken's localStorage.
const TEMP_TOKEN_KEY = "vxa-admin-temp-token"

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null
  return window.localStorage.getItem(ACCESS_TOKEN_KEY)
}

export function setAccessToken(accessToken: string): void {
  if (typeof window === "undefined") return
  window.localStorage.setItem(ACCESS_TOKEN_KEY, accessToken)
}

export function clearAccessToken(): void {
  if (typeof window === "undefined") return
  window.localStorage.removeItem(ACCESS_TOKEN_KEY)
}

export function getTempToken(): string | null {
  if (typeof window === "undefined") return null
  return window.sessionStorage.getItem(TEMP_TOKEN_KEY)
}

export function setTempToken(tempToken: string): void {
  if (typeof window === "undefined") return
  window.sessionStorage.setItem(TEMP_TOKEN_KEY, tempToken)
}

export function clearTempToken(): void {
  if (typeof window === "undefined") return
  window.sessionStorage.removeItem(TEMP_TOKEN_KEY)
}

// otpauthUrl only exists for the one-time enrollment ceremony (POST
// /admin/auth/login's response when needsEnrollment is true) — stashed here
// so the /totp/enroll page can render its QR after the navigation from
// /login, without putting a TOTP secret in the URL. Same sessionStorage
// lifetime rationale as the temp token above.
const OTPAUTH_URL_KEY = "vxa-admin-otpauth-url"

export function getOtpauthUrl(): string | null {
  if (typeof window === "undefined") return null
  return window.sessionStorage.getItem(OTPAUTH_URL_KEY)
}

export function setOtpauthUrl(otpauthUrl: string): void {
  if (typeof window === "undefined") return
  window.sessionStorage.setItem(OTPAUTH_URL_KEY, otpauthUrl)
}

export function clearOtpauthUrl(): void {
  if (typeof window === "undefined") return
  window.sessionStorage.removeItem(OTPAUTH_URL_KEY)
}

// ── Access-token claims ───────────────────────────────────────────────────────
// The admin JWT carries `exp` and `totpVerifiedAt` (verified live 2026-10-25:
// { sub, type: "admin", role, totpVerifiedAt, iat, exp }). Reading them here
// lets the UI notice an expired 8h session before the next request 401s, and
// lets the step-up check use the server's own verification time rather than
// only this tab's clock. Decoding is display-only — the server still verifies
// the signature on every call.

type AccessTokenClaims = { exp?: number; totpVerifiedAt?: string; role?: string }

function decodeClaims(token: string): AccessTokenClaims | null {
  try {
    const payload = token.split(".")[1]
    if (!payload) return null
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(payload.length / 4) * 4, "="))
    return JSON.parse(json) as AccessTokenClaims
  } catch {
    return null
  }
}

/** True when there's no token, or its `exp` has passed (with a 30s margin for clock skew). */
export function isAccessTokenExpired(token: string | null = getAccessToken()): boolean {
  if (!token) return true
  const exp = decodeClaims(token)?.exp
  return typeof exp === "number" ? Date.now() >= exp * 1000 - 30_000 : false
}

/** Epoch ms of the last TOTP check baked into the current token, if any. */
export function getTokenTotpVerifiedAt(): number | null {
  const token = getAccessToken()
  const value = token ? decodeClaims(token)?.totpVerifiedAt : undefined
  const ms = value ? Date.parse(value) : NaN
  return Number.isNaN(ms) ? null : ms
}

/** localStorage key, exported so other tabs' sign-in/out can be detected via the `storage` event. */
export const ADMIN_ACCESS_TOKEN_STORAGE_KEY = ACCESS_TOKEN_KEY
