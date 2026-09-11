"use client"

import { useState } from "react"
import { isStepUpFresh, useAdminSession } from "@/lib/admin-session"
import { useAdminAuth } from "@/hooks/use-admin-auth"
import { getApiErrorMessage } from "@/lib/api-error"

/**
 * Gates a sensitive admin action behind TOTP step-up re-verification when the
 * last check is stale (>15min, BR-80): manual activation (G3), listing
 * extend/remove (G4), KYC approve/reject and badge grant/revoke (G5), ad
 * publish/reject (G6), config writes (G8), abuse resolution (G9), refund
 * notes (G10). Listing approve/reject (G4) is deliberately left ungated —
 * extend/remove already carry the higher-risk gate, and reject already has
 * its own reason-capture dialog as a soft confirmation.
 *
 * The code the admin enters here is checked for real against
 * `POST /admin/auth/totp/verify` (see use-admin-auth.ts's `verifyStepUp`) —
 * it's the same endpoint the backend uses to answer a live 401
 * TOTP_STEPUP_REQUIRED, just triggered preemptively client-side from
 * `totpVerifiedAt` staleness rather than reactively off a 401.
 *
 * Note: when the session IS fresh, `run()` fires the action with no modal at
 * all — callers of actions with real consequences (suspend, remove, revoke)
 * should wrap their trigger in an AlertDialog so there's always at least one
 * explicit confirmation, regardless of step-up freshness.
 */
export function useStepUp() {
  const totpVerifiedAt = useAdminSession((s) => s.totpVerifiedAt)
  const { verifyStepUp, isVerifying } = useAdminAuth()
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null)
  const [code, setCode] = useState("")
  const [error, setError] = useState("")

  function run(action: () => void) {
    if (isStepUpFresh(totpVerifiedAt)) {
      action()
      return
    }
    setError("")
    setPendingAction(() => action)
  }

  async function confirm() {
    if (code.length !== 6) return
    setError("")
    try {
      await verifyStepUp(code)
      pendingAction?.()
      setPendingAction(null)
      setCode("")
    } catch (err) {
      setError(getApiErrorMessage(err) ?? "Invalid or expired code — please try again.")
      setCode("")
    }
  }

  function cancel() {
    setPendingAction(null)
    setCode("")
    setError("")
  }

  return { open: pendingAction !== null, code, setCode, run, confirm, cancel, isVerifying, error }
}
