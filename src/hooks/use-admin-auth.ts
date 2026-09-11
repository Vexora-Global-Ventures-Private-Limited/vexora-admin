"use client"

import { useCallback } from "react"
import { useLoginMutation, useTotpEnrollMutation, useTotpVerifyMutation, type ApiAdmin } from "@/store/api/adminAuthApi"
import {
  setAccessToken,
  clearAccessToken,
  setTempToken,
  getTempToken,
  clearTempToken,
  setOtpauthUrl,
  clearOtpauthUrl,
} from "@/lib/admin-tokens"
import { useAdminSession, type AdminUser } from "@/lib/admin-session"

/**
 * admin_auth.json's `admin` object is just `{ id, email, role }` — no display
 * name — so one is derived from the email's local part (e.g.
 * "ops.review@vexora.com" → "Ops.review"). Good enough for a single-admin
 * console; revisit if/when the backend ever adds a real name field.
 */
function mapApiAdminToAdminUser(apiAdmin: ApiAdmin): AdminUser {
  const localPart = apiAdmin.email.split("@")[0] || apiAdmin.email
  const name =
    localPart
      .split(/[._-]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ") || apiAdmin.email
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("") || "AD"

  return { id: apiAdmin.id, name, email: apiAdmin.email, initials, role: apiAdmin.role }
}

export function useAdminAuth() {
  const setAdminUser = useAdminSession((s) => s.login)
  const clearAdminUser = useAdminSession((s) => s.logout)
  const markTotpVerified = useAdminSession((s) => s.markTotpVerified)
  const [loginMutation, loginState] = useLoginMutation()
  const [totpEnrollMutation, enrollState] = useTotpEnrollMutation()
  const [totpVerifyMutation, verifyState] = useTotpVerifyMutation()

  // Step 1 — password. Stashes the 10-minute tempToken (and the enrollment
  // QR, if this is a first-ever login) for the /totp screen to pick up.
  const login = useCallback(
    async (email: string, password: string) => {
      const result = await loginMutation({ email, password }).unwrap()
      setTempToken(result.data.tempToken)
      if (result.data.otpauthUrl) setOtpauthUrl(result.data.otpauthUrl)
      return result.data
    },
    [loginMutation],
  )

  // Step 2a — first-ever login only. Verifies the first TOTP code, stores
  // the secret server-side, and returns the 10 recovery codes — shown once,
  // ever. Caller owns making the admin acknowledge them before continuing.
  const enroll = useCallback(
    async (code: string) => {
      const tempToken = getTempToken()
      if (!tempToken) throw new Error("Enrollment session expired — please sign in again.")
      const result = await totpEnrollMutation({ tempToken, code }).unwrap()
      setAccessToken(result.data.accessToken)
      clearTempToken()
      clearOtpauthUrl()
      setAdminUser(mapApiAdminToAdminUser(result.data.admin))
      markTotpVerified()
      return result.data.recoveryCodes
    },
    [totpEnrollMutation, setAdminUser, markTotpVerified],
  )

  // Step 2b — returning login: tempToken from /login + a TOTP or recovery code.
  const verifyLogin = useCallback(
    async (code: string) => {
      const tempToken = getTempToken()
      if (!tempToken) throw new Error("Login session expired — please sign in again.")
      const result = await totpVerifyMutation({ tempToken, code }).unwrap()
      setAccessToken(result.data.accessToken)
      clearTempToken()
      setAdminUser(mapApiAdminToAdminUser(result.data.admin))
      markTotpVerified()
    },
    [totpVerifyMutation, setAdminUser, markTotpVerified],
  )

  // Step-up path (BR-80 re-verification for sensitive actions): no
  // tempToken — the existing accessToken (attached by baseApi's
  // prepareHeaders) authenticates the request. A fresh accessToken comes
  // back and replaces the old one.
  const verifyStepUp = useCallback(
    async (code: string) => {
      const result = await totpVerifyMutation({ code }).unwrap()
      setAccessToken(result.data.accessToken)
      markTotpVerified()
    },
    [totpVerifyMutation, markTotpVerified],
  )

  // admin_auth.json has no logout endpoint — 8h session, no refresh token
  // (PARTNER-AUTH-INTEGRATION.md §4) — so clearing the local token *is* the
  // whole logout.
  const logout = useCallback(() => {
    clearAccessToken()
    clearTempToken()
    clearOtpauthUrl()
    clearAdminUser()
  }, [clearAdminUser])

  return {
    login,
    enroll,
    verifyLogin,
    verifyStepUp,
    logout,
    isLoggingIn: loginState.isLoading,
    isEnrolling: enrollState.isLoading,
    isVerifying: verifyState.isLoading,
    loginError: loginState.error,
    enrollError: enrollState.error,
    verifyError: verifyState.error,
  }
}
