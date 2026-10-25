"use client"

import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"
import { getTokenTotpVerifiedAt } from "@/lib/admin-tokens"

// Only super_admin is seeded today (PARTNER-AUTH-INTEGRATION.md §4), but the
// backend's `admin.role` already models the other three for when more admins
// (ops/finance/moderator) get created by a super-admin later.
export type AdminRole = "super_admin" | "ops" | "finance" | "moderator"

export type AdminUser = {
  id: string
  name: string
  email: string
  initials: string
  role: AdminRole
}

/** Step-up re-verification window (BR-80) — sensitive actions (manual activation,
 *  config writes, abuse resolution) require a TOTP check within the last 15 minutes. */
export const STEP_UP_WINDOW_MS = 15 * 60 * 1000

type AdminSessionState = {
  adminUser: AdminUser | null
  hasHydrated: boolean
  /** Epoch ms of the last successful OTP check this session; null until verified once. */
  totpVerifiedAt: number | null

  login: (user: AdminUser) => void
  logout: () => void
  markTotpVerified: () => void
  setHasHydrated: (v: boolean) => void
}

/**
 * Admin session display/gate store — mirrors VXP's nav-store.ts pattern
 * (client-persisted session, zustand). Kept entirely separate from VXP's
 * consumer session: admin identity is never a flag on a shared user object
 * (04-System-Architecture.md §14.2 — "admin identity is never a flag on
 * `users`").
 *
 * This store only ever caches what the backend already returned (see
 * src/hooks/use-admin-auth.ts, the only place that calls `login`/`logout`
 * here) — the real credential is the bearer accessToken in
 * src/lib/admin-tokens.ts, not anything in this persisted state. Losing this
 * store (cleared storage, different device) just means re-deriving
 * `adminUser`/`totpVerifiedAt` from a fresh login; losing the accessToken
 * means the session is actually dead.
 *
 * Real login is password → TOTP (enrollment on first-ever login, plain
 * verify every time after) — see admin_auth.json / PARTNER-AUTH-
 * INTEGRATION.md §4.
 */
export const useAdminSession = create<AdminSessionState>()(
  persist(
    (set) => ({
      adminUser: null,
      hasHydrated: false,
      totpVerifiedAt: null,

      login: (user) => set({ adminUser: user, totpVerifiedAt: null }),

      logout: () => set({ adminUser: null, totpVerifiedAt: null }),

      markTotpVerified: () => set({ totpVerifiedAt: Date.now() }),

      setHasHydrated: (v) => set({ hasHydrated: v }),
    }),
    {
      name: "vxa-admin-session",
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (state) => ({
        adminUser: state.adminUser,
        totpVerifiedAt: state.totpVerifiedAt,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true)
      },
    },
  ),
)

/**
 * Uses the later of this tab's own record and the `totpVerifiedAt` claim in
 * the current token — the server enforces the window from the token, so a
 * step-up done in another tab (which writes a fresh token to shared
 * localStorage) counts here too, and the dialog isn't shown needlessly.
 */
export function isStepUpFresh(totpVerifiedAt: number | null) {
  const fromToken = getTokenTotpVerifiedAt()
  const latest = Math.max(totpVerifiedAt ?? 0, fromToken ?? 0)
  return latest > 0 && Date.now() - latest < STEP_UP_WINDOW_MS
}

const roleName: Record<AdminRole, string> = {
  super_admin: "Super Admin",
  ops: "Ops",
  finance: "Finance",
  moderator: "Moderator",
}
export const ADMIN_ROLE_NAME = roleName
