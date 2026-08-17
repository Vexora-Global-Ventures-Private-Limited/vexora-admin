"use client"

import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

export type AdminRole = "super_admin"

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
 * Mock admin session store — mirrors VXP's nav-store.ts pattern (client-persisted
 * demo session, no real backend/JWT). Kept entirely separate from VXP's consumer
 * session: admin identity is never a flag on a shared user object (04-System-
 * Architecture.md §14.2 — "admin identity is never a flag on `users`").
 *
 * Login is password + OTP: no separate authenticator-app enrollment/recovery-codes
 * ceremony — every login goes password → OTP verify → dashboard.
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

export function isStepUpFresh(totpVerifiedAt: number | null) {
  return totpVerifiedAt != null && Date.now() - totpVerifiedAt < STEP_UP_WINDOW_MS
}

const roleName: Record<AdminRole, string> = {
  super_admin: "Super Admin",
}
export const ADMIN_ROLE_NAME = roleName

/** Mock credential pair the login form checks against — there's no real
 *  backend yet, so this stands in for the AdminUser.passwordHash check
 *  (04-System-Architecture.md §14.2: admin access is a dedicated identity,
 *  never a role flag on a consumer user). */
export const SUPERADMIN_CREDENTIALS = {
  email: "admin@vexora.in",
  password: "Vexora@Admin123",
}

/** The single seeded superadmin — VXA has exactly one admin account. */
export const superAdminUser: AdminUser = {
  id: "adm-001",
  name: "Priya Nair",
  email: SUPERADMIN_CREDENTIALS.email,
  initials: "PN",
  role: "super_admin",
}
