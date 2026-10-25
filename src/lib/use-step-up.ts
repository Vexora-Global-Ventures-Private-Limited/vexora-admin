"use client"

import { useRef, useState } from "react"
import { isStepUpFresh, useAdminSession } from "@/lib/admin-session"
import { useAdminAuth } from "@/hooks/use-admin-auth"
import { describeAuthError, getApiErrorCode } from "@/lib/api-error"

export type StepUpRunOptions = {
  onSuccess?: () => void
  /** Any failure other than TOTP_STEPUP_REQUIRED (which this hook handles itself). */
  onError?: (error: unknown) => void
}

/** True for the backend's "re-verify first" signal (401 TOTP_STEPUP_REQUIRED). */
export function isStepUpRequired(error: unknown) {
  return getApiErrorCode(error) === "TOTP_STEPUP_REQUIRED"
}

/**
 * Gates a sensitive admin action behind TOTP step-up re-verification when the
 * last check is stale (>15min, BR-80): manual activation (G3), listing
 * extend/remove (G4), KYC approve/reject and badge grant/revoke (G5), ad
 * publish/reject (G6), config writes (G8), abuse resolution (G9), refund
 * notes (G10). Listing approve/reject (G4) is deliberately left ungated —
 * extend/remove already carry the higher-risk gate, and reject already has
 * its own reason-capture dialog as a soft confirmation.
 *
 * Two triggers, one dialog:
 *  - Preemptive: the last check (this tab's record or the token's own
 *    `totpVerifiedAt` claim, whichever is later) is older than 15 min.
 *  - Reactive: the server answers 401 TOTP_STEPUP_REQUIRED anyway → ask,
 *    then re-run the SAME action automatically after the code is verified.
 *
 * The code (6-digit TOTP, or a one-time recovery code) is checked for real
 * against `POST /admin/auth/totp/verify` (use-admin-auth.ts's
 * `verifyStepUp`), which also swaps in a fresh token.
 *
 * `run(action, { onSuccess, onError })` — `action` may be sync or async.
 * For API calls, pass the raw `.unwrap()` promise and handle outcomes in
 * onSuccess/onError rather than catching inside `action`, so a step-up
 * failure reaches this hook instead of being swallowed. Only one action can
 * wait on the dialog at a time — a second `run()` while it's open is
 * ignored (and returns false) rather than silently replacing the first.
 *
 * When the session IS fresh, `run()` fires the action with no modal at all —
 * callers of actions with real consequences (suspend, remove, revoke) should
 * wrap their trigger in an AlertDialog so there's always at least one
 * explicit confirmation, regardless of step-up freshness.
 */
export function useStepUp() {
  const totpVerifiedAt = useAdminSession((s) => s.totpVerifiedAt)
  const { verifyStepUp, isVerifying } = useAdminAuth()
  const [pendingAction, setPendingAction] = useState<(() => Promise<void>) | null>(null)
  const [code, setCode] = useState("")
  const [recoveryCode, setRecoveryCode] = useState("")
  const [mode, setModeState] = useState<"totp" | "recovery">("totp")
  const [error, setError] = useState("")
  const [reason, setReason] = useState<"stale" | "server">("stale")
  const pendingRef = useRef<(() => Promise<void>) | null>(null)
  const verifying = useRef(false)

  const ask = (execute: () => Promise<void>, why: "stale" | "server") => {
    pendingRef.current = execute
    setError("")
    setCode("")
    setRecoveryCode("")
    setModeState("totp")
    setReason(why)
    setPendingAction(() => execute)
  }

  function run(action: () => unknown, options: StepUpRunOptions = {}): boolean {
    if (pendingRef.current) return false
    const execute = async () => {
      try {
        await action()
        options.onSuccess?.()
      } catch (err) {
        if (isStepUpRequired(err)) {
          ask(execute, "server")
          return
        }
        if (options.onError) options.onError(err)
        else throw err
      }
    }

    if (isStepUpFresh(totpVerifiedAt)) {
      void execute()
      return true
    }
    ask(execute, "stale")
    return true
  }

  /** `value` lets the OTP input's onComplete pass the full code — `code` state is a digit behind at that moment. */
  async function confirm(value?: string) {
    const submitted = mode === "totp" ? (typeof value === "string" ? value : code) : recoveryCode
    if (mode === "totp" ? submitted.length !== 6 : !submitted) return
    if (verifying.current) return
    verifying.current = true
    setError("")
    try {
      await verifyStepUp(submitted)
    } catch (err) {
      setError(describeAuthError(err, mode === "recovery" ? "That recovery code isn't valid or was already used." : undefined))
      setCode("")
      verifying.current = false
      return
    }
    verifying.current = false
    const action = pendingRef.current
    pendingRef.current = null
    setPendingAction(null)
    setCode("")
    setRecoveryCode("")
    await action?.()
  }

  function cancel() {
    // Can't back out mid-verify — the code may already be consumed server-side.
    if (verifying.current) return
    pendingRef.current = null
    setPendingAction(null)
    setCode("")
    setRecoveryCode("")
    setError("")
  }

  function setMode(next: "totp" | "recovery") {
    setModeState(next)
    setError("")
    setCode("")
    setRecoveryCode("")
  }

  return {
    open: pendingAction !== null,
    code,
    setCode,
    recoveryCode,
    setRecoveryCode,
    mode,
    setMode,
    run,
    confirm,
    cancel,
    isVerifying,
    error,
    reason,
  }
}
