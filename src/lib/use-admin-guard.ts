"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAdminSession } from "@/lib/admin-session"
import { ROUTES } from "@/lib/routes"

/**
 * Gates the (portal) route group behind the mocked OTP-elevated session:
 * no admin user → /login; never OTP-checked this session → /totp/verify.
 * There's no real backend here — this only guards client-side view access
 * for the demo, following the same pattern as VXP's use-session-guard.ts.
 */
export function useAdminGuard() {
  const adminUser = useAdminSession((s) => s.adminUser)
  const hasHydrated = useAdminSession((s) => s.hasHydrated)
  const totpVerifiedAt = useAdminSession((s) => s.totpVerifiedAt)
  const router = useRouter()
  const ready = useAdminSession.persist ? hasHydrated : true

  useEffect(() => {
    if (!ready) return
    if (!adminUser) {
      router.replace(ROUTES.login)
    } else if (!totpVerifiedAt) {
      router.replace(ROUTES.totpVerify)
    }
  }, [ready, adminUser, totpVerifiedAt, router])

  const elevated = ready && !!adminUser && !!totpVerifiedAt
  return { ready, adminUser, elevated }
}
