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
