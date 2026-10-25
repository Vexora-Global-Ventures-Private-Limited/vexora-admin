"use client"

import { useState } from "react"
import { isStepUpFresh, useAdminSession } from "@/lib/admin-session"
import { useAdminAuth } from "@/hooks/use-admin-auth"
import { getApiErrorCode, getApiErrorMessage } from "@/lib/api-error"

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
 *  - Preemptive: `totpVerifiedAt` is older than 15 min → ask first.
 *  - Reactive: the server answers 401 TOTP_STEPUP_REQUIRED anyway (its own
 *    clock disagrees, or the step-up was done in another tab) → ask, then
 *    re-run the SAME action automatically after the code is verified.
 *
 * The code is checked for real against `POST /admin/auth/totp/verify`
 * (use-admin-auth.ts's `verifyStepUp`), which also swaps in a fresh token.
 *
 * `run(action, { onSuccess, onError })` — `action` may be sync or async.
 * For API calls, pass the raw `.unwrap()` promise and handle outcomes in
 * onSuccess/onError rather than catching inside `action`, so a step-up
 * failure reaches this hook instead of being swallowed.
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
  const [error, setError] = useState("")
  const [reason, setReason] = useState<"stale" | "server">("stale")

  function run(action: () => unknown, options: StepUpRunOptions = {}) {
    const execute = async () => {
      try {
        await action()
        options.onSuccess?.()
      } catch (err) {
        if (isStepUpRequired(err)) {
          setError("")
          setReason("server")
          setPendingAction(() => execute)
          return
        }
        if (options.onError) options.onError(err)
        else throw err
      }
    }

    if (isStepUpFresh(totpVerifiedAt)) {
      void execute()
      return
    }
    setError("")
    setReason("stale")
    setPendingAction(() => execute)
  }

  async function confirm() {
    if (code.length !== 6) return
    setError("")
    try {
      await verifyStepUp(code)
    } catch (err) {
      setError(getApiErrorMessage(err) ?? "Invalid or expired code — please try again.")
      setCode("")
      return
    }
    const action = pendingAction
    setPendingAction(null)
    setCode("")
    await action?.()
  }

  function cancel() {
    setPendingAction(null)
    setCode("")
    setError("")
  }

  return { open: pendingAction !== null, code, setCode, run, confirm, cancel, isVerifying, error, reason }
}
