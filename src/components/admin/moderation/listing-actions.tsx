"use client"

import { useId, useRef, useState } from "react"
import { toast } from "sonner"
import { Check, Clock, Loader2, Trash2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { RejectionDialog } from "@/components/admin/rejection-dialog"
import { TotpStepUpDialog } from "@/components/admin/totp-step-up-dialog"
import { useStepUp } from "@/lib/use-step-up"
import { getApiErrorCode } from "@/lib/api-error"
import {
  useApproveListingMutation,
  useExtendListingMutation,
  useRejectListingMutation,
  useRemoveListingMutation,
} from "@/store/api/adminApi"
import { errorText, formatDate, isObjectId } from "./shared"

const MAX_EXTEND_DAYS = 365

/**
 * Listing moderation actions (G4), shared by the queue and the detail page.
 *
 *  - approve / reject: no step-up (reject carries its own reason dialog).
 *  - extend / remove: ⚠ step-up — routed through useStepUp().run, which also
 *    handles a live 401 TOTP_STEPUP_REQUIRED by asking for a code and
 *    retrying the same call.
 *
 * Every action is guarded against double submits (a ref, so it holds even
 * between a click and the next render). A 409 CONFLICT ("not in review
 * queue" — another admin got there first, or the seller withdrew) / 404 is
 * not an error the admin can act on: the message is shown and the queue
 * refetches (the mutations invalidate it), which drops the stale row.
 */
export function useListingActions(onDone?: (action: "approved" | "rejected" | "extended" | "removed", id: string) => void) {
  const stepUp = useStepUp()
  const [approve] = useApproveListingMutation()
  const [reject] = useRejectListingMutation()
  const [extend] = useExtendListingMutation()
  const [remove] = useRemoveListingMutation()
  const inFlight = useRef(new Set<string>())
  const [busy, setBusy] = useState<Record<string, boolean>>({})

  const track = (id: string, on: boolean) => {
    if (on) inFlight.current.add(id)
    else inFlight.current.delete(id)
    setBusy((b) => ({ ...b, [id]: on }))
  }

  const handleError = (err: unknown, fallback: string, source: "queue" | "live") => {
    const code = getApiErrorCode(err)
    if (source === "queue" && (code === "CONFLICT" || code === "NOT_FOUND")) {
      // Another admin decided it first, or the seller withdrew it.
      toast.info(errorText(err, "This listing is no longer in the review queue."), { description: "The queue has been refreshed." })
      return
    }
    if (source === "live" && code === "NOT_FOUND") {
      toast.error("No listing with that id", { description: "Check the id — it must be an existing listing." })
      return
    }
    toast.error(errorText(err, fallback))
  }

  const runGuarded = (id: string, call: () => Promise<unknown>, onSuccess: () => void, fallback: string, gated: boolean) => {
    if (inFlight.current.has(id)) return
    // The lock is held only while the request itself runs — not while a
    // step-up dialog is open — so cancelling that dialog (or the server
    // asking for a code mid-flight) never leaves the row stuck "busy".
    const wrapped = async () => {
      track(id, true)
      try {
        return await call()
      } finally {
        track(id, false)
      }
    }
    // Step-up-gated actions are the live-listing tools; ungated ones act on the review queue.
    const onError = (err: unknown) => handleError(err, fallback, gated ? "live" : "queue")
    if (gated) stepUp.run(wrapped, { onSuccess, onError })
    else wrapped().then(onSuccess, onError)
  }

  return {
    stepUp,
    busy: (id: string) => !!busy[id],
    approve: (id: string) =>
      runGuarded(
        id,
        () => approve(id).unwrap(),
        () => {
          toast.success("Listing approved — it's live now", { description: "Buyers may see it after the ~60s search cache refreshes." })
          onDone?.("approved", id)
        },
        "Couldn't approve this listing.",
        false,
      ),
    reject: (id: string, reason: string, after?: () => void) =>
      runGuarded(
        id,
        () => reject({ id, reason: reason.trim() }).unwrap(),
        () => {
          toast.warning("Listing rejected", { description: "The seller sees your reason." })
          after?.()
          onDone?.("rejected", id)
        },
        "Couldn't reject this listing.",
        false,
      ),
    extend: (id: string, days: number, after?: () => void) =>
      runGuarded(
        id,
        async () => {
          const res = await extend({ id, days }).unwrap()
          toast.success(`Listing extended by ${res.days} day${res.days === 1 ? "" : "s"}`, { description: `New expiry: ${formatDate(res.expiresAt)}` })
        },
        () => {
          after?.()
          onDone?.("extended", id)
        },
        "Couldn't extend this listing.",
        true,
      ),
    remove: (id: string, reason: string, after?: () => void) =>
      runGuarded(
        id,
        () => remove({ id, reason: reason.trim() }).unwrap(),
        () => {
          toast.warning("Listing removed from the marketplace", { description: "Audit-logged." })
          after?.()
          onDone?.("removed", id)
        },
        "Couldn't remove this listing.",
        true,
      ),
  }
}

export type ListingActions = ReturnType<typeof useListingActions>

/** Approve (with confirmation) + Reject (with reason) for a pending listing. */
export function PendingListingButtons({
  id,
  title,
  actions,
  size = "sm",
}: {
  id: string
  title: string
  actions: ListingActions
  size?: "sm" | "default"
}) {
  const [confirmingApprove, setConfirmingApprove] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState("")
  const busy = actions.busy(id)

  return (
    <div className="flex flex-wrap gap-1.5">
      <Button size={size} className="gap-1" disabled={busy} onClick={() => setConfirmingApprove(true)} aria-label={`Approve ${title}`}>
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Approve
      </Button>
      <Button size={size} variant="destructive" className="gap-1" disabled={busy} onClick={() => setRejecting(true)} aria-label={`Reject ${title}`}>
        <X className="h-3.5 w-3.5" /> Reject
      </Button>

      <AlertDialog open={confirmingApprove} onOpenChange={setConfirmingApprove}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve “{title}”?</AlertDialogTitle>
            <AlertDialogDescription>
              It goes live immediately and becomes visible to every buyer. The expiry date comes from the platform&apos;s
              listing-validity setting.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => actions.approve(id)}>Approve</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <RejectionDialog
        open={rejecting}
        onOpenChange={(o) => {
          setRejecting(o)
          if (!o) setReason("")
        }}
        title="Reject this listing"
        description="The seller will see this reason. A rejected listing can't be edited or resubmitted today, so be specific."
        reason={reason}
        onReasonChange={setReason}
        isSubmitting={busy}
        onConfirm={() =>
          actions.reject(id, reason, () => {
            setRejecting(false)
            setReason("")
          })
        }
        placeholder="e.g. Price looks like a typo — ₹50 for a 2 BHK."
      />
    </div>
  )
}

/**
 * Extend / remove a LIVE listing by id. There's no admin endpoint that lists
 * or fetches live listings, so the admin supplies the id (e.g. from the
 * listing's URL on the public site, or the audit log).
 */
export function LiveListingTools({ actions, presetId }: { actions: ListingActions; presetId?: string }) {
  const fieldId = useId()
  const [listingId, setListingId] = useState(presetId ?? "")
  const [days, setDays] = useState("30")
  const [removing, setRemoving] = useState(false)
  const [removeReason, setRemoveReason] = useState("")
  const [confirmExtend, setConfirmExtend] = useState(false)

  const id = listingId.trim()
  const idValid = isObjectId(id)
  const daysNum = Number(days)
  const daysValid = /^\d+$/.test(days) && daysNum >= 1 && daysNum <= MAX_EXTEND_DAYS
  const busy = idValid && actions.busy(id)

  return (
    <div className="space-y-4 border border-brand-border bg-card p-5">
      <div>
        <h3 className="font-serif text-lg font-bold text-brand-secondary">Live listing tools</h3>
        <p className="text-xs text-brand-secondary/60">
          Extend or remove a listing that&apos;s already live. Both need a fresh authenticator code (step-up).
        </p>
      </div>

      {!presetId && (
        <div className="space-y-1.5">
          <Label htmlFor={`${fieldId}-id`} className="text-xs font-semibold">Listing ID</Label>
          <Input
            id={`${fieldId}-id`}
            value={listingId}
            onChange={(e) => setListingId(e.target.value.trim())}
            placeholder="24-character listing id"
            maxLength={24}
            aria-invalid={!!listingId && !idValid}
            className="font-mono text-xs"
          />
          {listingId && !idValid && <p className="text-[11px] text-red-600">Listing ids are 24 hex characters.</p>}
        </div>
      )}

      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1.5">
          <Label htmlFor={`${fieldId}-days`} className="text-xs font-semibold">Extend by (days)</Label>
          <Input
            id={`${fieldId}-days`}
            value={days}
            onChange={(e) => setDays(e.target.value.replace(/\D/g, "").slice(0, 3))}
            inputMode="numeric"
            className="w-28"
            aria-invalid={!daysValid}
          />
        </div>
        <Button variant="outline" className="gap-1.5" disabled={!idValid || !daysValid || busy} onClick={() => setConfirmExtend(true)}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Clock className="h-4 w-4" />} Extend
        </Button>
        <Button variant="destructive" className="gap-1.5" disabled={!idValid || busy} onClick={() => setRemoving(true)}>
          <Trash2 className="h-4 w-4" /> Remove
        </Button>
      </div>
      {!daysValid && <p className="text-[11px] text-red-600">Enter a whole number of days from 1 to {MAX_EXTEND_DAYS}.</p>}

      <AlertDialog open={confirmExtend} onOpenChange={setConfirmExtend}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Extend this listing by {daysNum} day{daysNum === 1 ? "" : "s"}?</AlertDialogTitle>
            <AlertDialogDescription>
              A manual override outside the paid renewal flow. It&apos;s audit-logged.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => actions.extend(id, daysNum)}>Extend</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <RejectionDialog
        open={removing}
        onOpenChange={(o) => {
          setRemoving(o)
          if (!o) setRemoveReason("")
        }}
        title="Remove this listing?"
        description="It's taken off the marketplace immediately — the heaviest moderation action. The seller sees the reason."
        reason={removeReason}
        onReasonChange={setRemoveReason}
        isSubmitting={busy}
        confirmLabel="Remove listing"
        onConfirm={() =>
          actions.remove(id, removeReason, () => {
            setRemoving(false)
            setRemoveReason("")
          })
        }
        placeholder="e.g. Duplicate of an existing listing."
      />

      <TotpStepUpDialog {...actions.stepUp} />
    </div>
  )
}
