"use client"

import { useId, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { TotpStepUpDialog } from "@/components/admin/totp-step-up-dialog"
import { useStepUp } from "@/lib/use-step-up"
import { useAdminSession } from "@/lib/admin-session"
import { getApiErrorCode, getApiErrorMessage } from "@/lib/api-error"
import { useReinstateUserMutation, useSuspendUserMutation, type AdminUserStatus } from "@/store/api/adminApi"

const REASON_MAX = 500

/** Suspend/reinstate are `requireRole("super_admin","ops")` server-side — hide them for anyone else. */
export function useCanManageUsers() {
  const role = useAdminSession((s) => s.adminUser?.role)
  return role === "super_admin" || role === "ops"
}

/**
 * Suspend (⚠ step-up) / reinstate (no step-up) one user. Both need a
 * non-blank reason — the backend rejects whitespace-only. A 409
 * (ALREADY_SUSPENDED / NOT_SUSPENDED / USER_DELETED) means the screen was
 * stale (another admin, another tab): refetch quietly instead of erroring.
 */
export function UserStatusAction({
  userId,
  status,
  label,
  size = "sm",
}: {
  userId: string
  status: AdminUserStatus
  /** Shown in the dialog so the admin knows exactly who they're acting on. */
  label: string
  size?: "sm" | "default"
}) {
  const canManage = useCanManageUsers()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [suspendUser, suspendState] = useSuspendUserMutation()
  const [reinstateUser, reinstateState] = useReinstateUserMutation()
  const stepUp = useStepUp()
  const reasonId = useId()

  if (!canManage || status === "deleted") return null

  const suspending = status === "active"
  // Also "busy" while the step-up code dialog is waiting — otherwise a second
  // click could queue a second suspend behind the first.
  const busy = suspendState.isLoading || reinstateState.isLoading || stepUp.open
  const trimmed = reason.trim()

  const handleError = (err: unknown) => {
    const code = getApiErrorCode(err)
    if (code === "ALREADY_SUSPENDED" || code === "NOT_SUSPENDED" || code === "USER_DELETED") {
      // Stale screen — the mutation's tag invalidation already refetches; just say so.
      toast.info("This user's status already changed", { description: getApiErrorMessage(err) })
      setOpen(false)
      return
    }
    setError(getApiErrorMessage(err) ?? "Couldn't update this user. Please try again.")
  }

  const submit = () => {
    if (!trimmed || busy) return
    setError(null)
    if (suspending) {
      // Close first — step-up (if needed) opens its own modal rather than stacking.
      setOpen(false)
      stepUp.run(() => suspendUser({ id: userId, reason: trimmed }).unwrap(), {
        onSuccess: () => {
          toast.warning("User suspended", { description: label })
          setReason("")
        },
        onError: (err) => {
          handleError(err)
          if (getApiErrorCode(err) !== "ALREADY_SUSPENDED" && getApiErrorCode(err) !== "USER_DELETED") setOpen(true)
        },
      })
    } else {
      reinstateUser({ id: userId, reason: trimmed })
        .unwrap()
        .then(() => {
          toast.success("User reinstated", { description: label })
          setReason("")
          setOpen(false)
        })
        .catch(handleError)
    }
  }

  return (
    <>
      <Button
        size={size}
        variant={suspending ? (size === "sm" ? "outline" : "destructive") : "default"}
        onClick={() => {
          setError(null)
          setOpen(true)
        }}
        disabled={busy}
      >
        {stepUp.open ? "Waiting for code…" : busy ? (suspending ? "Suspending…" : "Reinstating…") : suspending ? "Suspend" : "Reinstate"}
      </Button>

      <Dialog open={open} onOpenChange={(o) => !busy && setOpen(o)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl">{suspending ? "Suspend this user?" : "Reinstate this user?"}</DialogTitle>
            <DialogDescription>
              <span className="font-semibold text-brand-secondary">{label}</span>
              {" — "}
              {suspending
                ? "they won't be able to sign in or renew their session (a session that's already open can keep working for up to 15 minutes). This is audit-logged and needs a fresh authenticator code."
                : "they'll be able to sign in again. This is audit-logged."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <label htmlFor={reasonId} className="text-xs font-semibold text-brand-secondary">
              Reason (required)
            </label>
            <Textarea
              id={reasonId}
              rows={3}
              value={reason}
              maxLength={REASON_MAX}
              onChange={(e) => setReason(e.target.value)}
              placeholder={suspending ? "e.g. Repeated fake listings reported by buyers" : "e.g. Appeal reviewed — identity confirmed"}
              aria-invalid={!!error}
            />
            <div className="flex justify-between text-[11px] text-brand-muted-foreground">
              <span>{error && <span className="font-semibold text-red-600">{error}</span>}</span>
              <span>
                {reason.length}/{REASON_MAX}
              </span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button variant={suspending ? "destructive" : "default"} onClick={submit} disabled={!trimmed || busy}>
              {suspending ? "Suspend user" : "Reinstate user"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <TotpStepUpDialog {...stepUp} />
    </>
  )
}
