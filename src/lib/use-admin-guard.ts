"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAdminSession } from "@/lib/admin-session"
import { clearAccessToken, getAccessToken, isAccessTokenExpired } from "@/lib/admin-tokens"
import { ROUTES } from "@/lib/routes"

/**
 * Gates the (portal) route group behind a real, OTP-elevated admin session:
 * no accessToken (or `adminUser` never got set) → /login; a token but no
 * OTP check yet this session → /totp/verify. `adminUser` alone isn't enough
 * — it's a cached display copy of the last successful login, and could
 * survive in localStorage after the accessToken it was minted with expires
 * or gets cleared (e.g. baseApi's 401 handler clearing just the token via a
 * hard redirect that raced this check) — the token is the actual session.
 *
 * An expired token (8h, no refresh) counts as no session: without this the
 * portal rendered normally and only bounced on the first API 401.
 */
export function useAdminGuard() {
  const adminUser = useAdminSession((s) => s.adminUser)
  const hasHydrated = useAdminSession((s) => s.hasHydrated)
  const totpVerifiedAt = useAdminSession((s) => s.totpVerifiedAt)
  const logout = useAdminSession((s) => s.logout)
  const router = useRouter()
  const ready = useAdminSession.persist ? hasHydrated : true
  const token = ready ? getAccessToken() : null
  const expired = !!token && isAccessTokenExpired(token)
  const hasSession = ready && !!adminUser && !!token && !expired

  useEffect(() => {
    if (!ready) return
    if (expired) {
      clearAccessToken()
      logout()
      router.replace(`${ROUTES.login}?session=expired`)
    } else if (!adminUser || !getAccessToken()) {
      router.replace(ROUTES.login)
    } else if (!totpVerifiedAt) {
      router.replace(ROUTES.totpVerify)
    }
  }, [ready, expired, adminUser, totpVerifiedAt, router, logout])

  const elevated = hasSession && !!totpVerifiedAt
  return { ready, adminUser, elevated }
}
