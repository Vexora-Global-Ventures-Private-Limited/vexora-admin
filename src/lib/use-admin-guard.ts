"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAdminSession } from "@/lib/admin-session"
import { getAccessToken } from "@/lib/admin-tokens"
import { ROUTES } from "@/lib/routes"

/**
 * Gates the (portal) route group behind a real, OTP-elevated admin session:
 * no accessToken (or `adminUser` never got set) → /login; a token but no
 * OTP check yet this session → /totp/verify. `adminUser` alone isn't enough
 * — it's a cached display copy of the last successful login, and could
 * survive in localStorage after the accessToken it was minted with expires
 * or gets cleared (e.g. baseApi's 401 handler clearing just the token via a
 * hard redirect that raced this check) — the token is the actual session.
 */
export function useAdminGuard() {
  const adminUser = useAdminSession((s) => s.adminUser)
  const hasHydrated = useAdminSession((s) => s.hasHydrated)
  const totpVerifiedAt = useAdminSession((s) => s.totpVerifiedAt)
  const router = useRouter()
  const ready = useAdminSession.persist ? hasHydrated : true
  const hasSession = ready && !!adminUser && !!getAccessToken()

  useEffect(() => {
    if (!ready) return
    if (!adminUser || !getAccessToken()) {
      router.replace(ROUTES.login)
    } else if (!totpVerifiedAt) {
      router.replace(ROUTES.totpVerify)
    }
  }, [ready, adminUser, totpVerifiedAt, router])

  const elevated = hasSession && !!totpVerifiedAt
  return { ready, adminUser, elevated }
}
