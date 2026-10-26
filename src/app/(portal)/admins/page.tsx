"use client"

import { useId, useState } from "react"
import { toast } from "sonner"
import { KeyRound, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
import { ADMIN_ROLE_NAME, useAdminSession } from "@/lib/admin-session"
import { getApiErrorCode, getApiErrorMessage } from "@/lib/api-error"
import { useResetAdmin2faMutation } from "@/store/api/adminApi"

const OBJECT_ID = /^[a-f0-9]{24}$/i
const CONFIRM_WORD = "RESET"

/**
 * Manage admins — kept deliberately separate from G2's user management
 * (FRONTEND-ADMIN-INTEGRATION-ROADMAP.md Module 2): `POST
 * /admin/users/{id}/reset-2fa` lives under /admin/users/... but takes an
 * ADMIN id, and pointing it at a regular user id by accident is exactly the
 * mistake a shared screen would invite.
 *
 * There is no endpoint that lists admin accounts, so the target id has to be
 * pasted (it's the `adminUserId` on that admin's audit-log entries). The
 * signed-in admin's own id is refused: resetting it would invalidate the
 * authenticator they're using right now, with no other admin to recover them.
 */
export default function AdminsPage() {
  const me = useAdminSession((s) => s.adminUser)
  const [targetId, setTargetId] = useState("")
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [typed, setTyped] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [lastResetId, setLastResetId] = useState<string | null>(null)
  const [resetAdmin2fa, resetState] = useResetAdmin2faMutation()
  const stepUp = useStepUp()
  const idFieldId = useId()
  const confirmFieldId = useId()

  if (!me) return null

  if (me.role !== "super_admin") {
    return (
      <div className="rounded-xl border border-brand-border bg-card p-6 text-sm text-brand-muted-foreground">
        Only Super Admins can manage other admin accounts.
      </div>
    )
  }

  // Ids are case-insensitive hex; whitespace is already stripped on input.
  const id = targetId.toLowerCase()
  const isSelf = id === me.id.toLowerCase()
  const idError = id && !OBJECT_ID.test(id) ? "An admin id is 24 hex characters." : isSelf ? "That's your own account — see the note below." : null
  const busy = resetState.isLoading || stepUp.open

  const openConfirm = () => {
    if (!id || idError || busy) return
    setError(null)
    setTyped("")
    setConfirmOpen(true)
  }

  const submit = () => {
    if (typed.trim() !== CONFIRM_WORD || busy) return
    setConfirmOpen(false)
    stepUp.run(() => resetAdmin2fa(id).unwrap(), {
      onSuccess: () => {
        setLastResetId(id)
        setTargetId("")
        toast.success("Two-factor reset", { description: "Their next sign-in will ask them to scan a new QR code." })
      },
      onError: (err) => {
        const code = getApiErrorCode(err)
        setError(
          code === "VALIDATION_ERROR"
            ? "That isn't a valid admin id."
            : code === "NOT_FOUND"
            ? "No admin account has that id. (Regular user ids don't work here — use the id from that admin's audit-log entries.)"
            : code === "ADMIN_FORBIDDEN"
              ? "Only Super Admins can reset another admin's two-factor."
              : getApiErrorMessage(err) ?? "Couldn't reset two-factor. Please try again.",
        )
      },
    })
  }

  return (
    <div className="space-y-6">
      <div>
        {/* The shell's topbar already renders the page <h1>. */}
        <h2 className="font-serif text-2xl font-bold text-brand-secondary">Admins</h2>
        <p className="text-sm text-brand-muted-foreground">Admin accounts and two-factor recovery. Super Admins only.</p>
      </div>

      <section className="rounded-xl border border-brand-border bg-card p-5">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-brand-primary-dark" aria-hidden />
          <h3 className="font-semibold text-brand-secondary">Signed in as</h3>
        </div>
        <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs text-brand-muted-foreground">Email</dt>
            <dd className="break-all text-brand-secondary">{me.email}</dd>
          </div>
          <div>
            <dt className="text-xs text-brand-muted-foreground">Role</dt>
            <dd className="text-brand-secondary">{ADMIN_ROLE_NAME[me.role]}</dd>
          </div>
          <div>
            <dt className="text-xs text-brand-muted-foreground">Admin id</dt>
            <dd className="break-all font-mono text-xs text-brand-secondary">{me.id}</dd>
          </div>
        </dl>
        <p className="mt-4 rounded-lg bg-brand-surface px-3 py-2 text-xs text-brand-muted-foreground">
          There's no list of admin accounts yet — the backend has no endpoint for it. To act on another admin, use their
          admin id (shown on their entries in Payments &amp; audit → Audit log).
        </p>
      </section>

      <section className="rounded-xl border border-red-200 bg-card p-5">
        <div className="flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-red-600" aria-hidden />
          <h3 className="font-semibold text-brand-secondary">Reset another admin&apos;s two-factor</h3>
        </div>
        <p className="mt-1 text-sm text-brand-muted-foreground">
          For an admin who lost their authenticator. Their current codes and recovery codes stop working, and their next
          sign-in asks them to scan a new QR code. Audit-logged; needs a fresh authenticator code.
        </p>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-start">
          <div className="flex-1">
            <label htmlFor={idFieldId} className="text-xs font-semibold text-brand-secondary">
              Admin id
            </label>
            <Input
              id={idFieldId}
              value={targetId}
              // Strip all whitespace (a copied id often carries a trailing
              // space or newline). No maxLength: the browser would truncate a
              // padded paste to 24 chars BEFORE onChange, cutting the id short.
              onChange={(e) => {
                setTargetId(e.target.value.replace(/\s+/g, ""))
                setError(null)
              }}
              disabled={busy}
              onKeyDown={(e) => e.key === "Enter" && openConfirm()}
              placeholder="e.g. 6a858238829f1e3b46f138c1"
              spellCheck={false}
              autoComplete="off"
              aria-invalid={!!(idError || error)}
              aria-describedby={`${idFieldId}-msg`}
              className="mt-1 font-mono text-xs"
            />
            <p id={`${idFieldId}-msg`} className="mt-1 min-h-4 text-[11px]" role={idError || error ? "alert" : undefined}>
              {idError ? <span className="text-red-600">{idError}</span> : error ? <span className="font-semibold text-red-600">{error}</span> : null}
            </p>
          </div>
          <Button variant="destructive" className="sm:mt-6" disabled={!id || !!idError || busy} onClick={openConfirm}>
            {stepUp.open ? "Waiting for code…" : resetState.isLoading ? "Resetting…" : "Reset two-factor"}
          </Button>
        </div>

        {lastResetId && (
          <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
            Two-factor reset for admin <span className="font-mono">{lastResetId}</span>. Ask them to sign in again and scan the new QR code — and to save their new recovery codes.
          </p>
        )}

        <p className="mt-4 text-xs text-brand-muted-foreground">
          <b>Your own account can&apos;t be reset here.</b> Doing that would invalidate the authenticator you&apos;re signed in
          with, and with no other Super Admin there&apos;d be no one to set it up again. Use one of your recovery codes on the
          sign-in screen instead.
        </p>
      </section>

      <Dialog open={confirmOpen} onOpenChange={(o) => !busy && setConfirmOpen(o)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl">Reset this admin&apos;s two-factor?</DialogTitle>
            <DialogDescription>
              Admin <span className="font-mono text-xs text-brand-secondary">{id}</span> will be locked out of their current
              authenticator and recovery codes until they sign in and enroll again.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <label htmlFor={confirmFieldId} className="text-xs font-semibold text-brand-secondary">
              Type {CONFIRM_WORD} to confirm
            </label>
            <Input
              id={confirmFieldId}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              autoComplete="off"
              placeholder={CONFIRM_WORD}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={submit} disabled={typed.trim() !== CONFIRM_WORD || busy}>
              Reset two-factor
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <TotpStepUpDialog {...stepUp} />
    </div>
  )
}
