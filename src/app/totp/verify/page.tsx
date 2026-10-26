"use client"

import { takeReturnTo } from "@/lib/return-to"
import { useEffect, useRef, useState, useSyncExternalStore } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { ShieldCheck, ArrowRight, AlertCircle, KeyRound } from "lucide-react"
import { Button } from "@/components/ui/button"
import { OtpInputGroup, RecoveryCodeInput } from "@/components/admin/otp-input-group"
import { useAdminAuth } from "@/hooks/use-admin-auth"
import { clearTempToken, getTempToken } from "@/lib/admin-tokens"
import { describeAuthError, getApiErrorCode } from "@/lib/api-error"
import { ROUTES } from "@/lib/routes"

const noopSubscribe = () => () => {}

export default function OtpVerifyPage() {
  const router = useRouter()
  const { verifyLogin, isVerifying } = useAdminAuth()
  const [mode, setMode] = useState<"totp" | "recovery">("totp")
  const [code, setCode] = useState("")
  const [recoveryCode, setRecoveryCode] = useState("")
  const [error, setError] = useState("")
  // Synchronous lock — the auto-submit on the 6th digit and a button click
  // can land in the same tick, and a second verify with the same code fails.
  const inFlight = useRef(false)
  // Set once verify succeeds: the tempToken is cleared at that moment, and
  // without this the "no tempToken → /login" redirect below would race the
  // navigation to the dashboard.
  const [verified, setVerified] = useState(false)
  // Render-visible twin of inFlight (refs can't be read during render).
  const [busy, setBusy] = useState(false)
  // Set when this page is already navigating away on purpose (dead
  // tempToken → /login?expired=1, or "different account"). Without it, the
  // "no tempToken → /login" effect fired right after and replaced that
  // navigation with a bare /login, so the "attempt expired" notice was lost.
  const [leaving, setLeaving] = useState(false)

  // A tempToken only exists here right after step 1 (/login) succeeded with
  // needsTotp — landing on this page any other way (direct nav, expired tab)
  // means there's nothing to verify against, so bounce back to login.
  // Read through useSyncExternalStore: sessionStorage isn't available during
  // SSR, and this avoids a setState-in-effect just to flip a "ready" flag.
  const hasTempToken = useSyncExternalStore(noopSubscribe, () => !!getTempToken(), () => null)

  useEffect(() => {
    // inFlight: verifyLogin clears the tempToken before it resolves, so a
    // re-render mid-verify must not read that as "nothing to verify".
    if (hasTempToken === false && !verified && !busy && !leaving) router.replace(ROUTES.login)
  }, [hasTempToken, verified, busy, leaving, router])

  // `value` comes from the OTP input's onComplete — the `code` state hasn't
  // re-rendered yet at that point, so reading it would see 5 digits and the
  // auto-submit silently did nothing.
  const verify = async (value?: string) => {
    const submitted = mode === "totp" ? (value ?? code) : recoveryCode
    if (inFlight.current) return
    if (mode === "totp" ? submitted.length !== 6 : !submitted) return
    inFlight.current = true
    setBusy(true)
    setError("")
    try {
      await verifyLogin(submitted)
      setVerified(true)
      // Back to the page they were on when their session expired, if any.
      router.replace(takeReturnTo(ROUTES.dashboard))
    } catch (err) {
      // The 10-minute tempToken from step 1 is dead — no code will ever
      // succeed against it. Send the admin back to /login for a fresh one.
      if (getApiErrorCode(err) === "TEMP_TOKEN_INVALID") {
        setLeaving(true)
        clearTempToken()
        router.replace(`${ROUTES.login}?expired=1`)
        return
      }
      setError(
        describeAuthError(err, mode === "recovery" ? "That recovery code isn't valid or was already used." : undefined),
      )
      setCode("")
    } finally {
      inFlight.current = false
      setBusy(false)
    }
  }

  const startOver = () => {
    setLeaving(true)
    clearTempToken()
    router.replace(ROUTES.login)
  }

  if (hasTempToken === null || leaving || (!hasTempToken && !verified && !busy)) return null

  return (
    // Theme-aware background — matches the rest of the portal's light/dark toggle (previously hardcoded dark).
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-6">
      <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-brand-primary-dark/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-brand-primary-dark/10 blur-3xl" />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative w-full max-w-sm bg-card p-8 text-center shadow-2xl shadow-brand-primary-dark/10"
      >
        <div className="mx-auto grid h-12 w-12 place-items-center bg-gradient-to-br from-brand-primary-dark via-brand-primary-dark to-gold-700 shadow-lg shadow-brand-primary-dark/30">
          {mode === "totp" ? <ShieldCheck className="h-6 w-6 text-brand-secondary" /> : <KeyRound className="h-6 w-6 text-brand-secondary" />}
        </div>
        <h1 className="mt-3 font-serif text-2xl font-bold text-brand-secondary">
          {mode === "totp" ? "Enter your code" : "Use a recovery code"}
        </h1>
        <p className="mt-1 text-sm text-brand-secondary/60">
          {mode === "totp"
            ? "Enter the 6-digit code from your authenticator app to unlock the console."
            : "Enter one of the 10 recovery codes you saved when you set up your authenticator. Each code works once."}
        </p>

        <form
          className="mt-6"
          onSubmit={(e) => {
            e.preventDefault()
            void verify()
          }}
        >
          <div className="flex justify-center">
            {mode === "totp" ? (
              <OtpInputGroup
                value={code}
                onChange={(v) => {
                  setCode(v)
                  if (error) setError("")
                }}
                onComplete={(v) => void verify(v)}
                disabled={isVerifying}
                invalid={!!error}
              />
            ) : (
              <RecoveryCodeInput
                value={recoveryCode}
                onChange={(v) => {
                  setRecoveryCode(v)
                  if (error) setError("")
                }}
                onSubmit={() => void verify()}
                disabled={isVerifying}
              />
            )}
          </div>

          {error && (
            <div role="alert" className="mt-4 flex items-center justify-center gap-2 border border-red-600/30 bg-red-600/10 px-3 py-2 text-xs font-semibold text-red-600">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <Button
            type="submit"
            className="btn-gold mt-6 flex w-full items-center justify-center gap-2"
            disabled={(mode === "totp" ? code.length !== 6 : !recoveryCode) || isVerifying}
          >
            {isVerifying ? "Verifying…" : "Verify & continue"} <ArrowRight className="h-4 w-4" />
          </Button>
        </form>

        <button
          type="button"
          onClick={() => {
            setMode(mode === "totp" ? "recovery" : "totp")
            setError("")
            setCode("")
            setRecoveryCode("")
          }}
          className="mt-4 text-[11px] font-semibold text-brand-primary-dark hover:underline"
        >
          {mode === "totp" ? "Lost your device? Use a recovery code instead" : "Use my authenticator code instead"}
        </button>
        <div>
          <button type="button" onClick={startOver} className="mt-2 text-[11px] text-brand-secondary/50 hover:text-brand-secondary hover:underline">
            Sign in with a different account
          </button>
        </div>
      </motion.div>
    </div>
  )
}
