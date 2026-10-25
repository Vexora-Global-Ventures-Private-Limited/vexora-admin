"use client"

import { useRef, useState } from "react"
import { toast } from "sonner"
import { Check, ExternalLink, ImageOff, Loader2, ShieldAlert, X } from "lucide-react"
import { Button } from "@/components/ui/button"
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
import { getApiErrorCode } from "@/lib/api-error"
import { useApproveAdMutation, useRejectAdMutation, type AdminAd, type AdProduct } from "@/store/api/adminApi"
import { classifyCreativeSrc, errorText, formatDate, hasEnded, isSafeHttpsUrl } from "@/components/admin/moderation/shared"

export const AD_PRODUCT_LABEL: Record<AdProduct, string> = {
  banner: "Home banner",
  sponsored: "Sponsored listing",
  featured: "Featured developer",
  project_promotion: "Project promotion",
}

export function adProductLabel(product: string) {
  return AD_PRODUCT_LABEL[product as AdProduct] ?? product
}

/** What approving actually does, per product — not every product does the same thing. */
export const APPROVE_EFFECT: Record<AdProduct, string> = {
  banner: "Goes active and becomes eligible for the homepage banner slot right away.",
  project_promotion: "Goes active and becomes eligible for the project-promotion slot right away.",
  featured: "Goes active and flips the builder's profile to Featured — it shows in the homepage “Featured developers” row.",
  sponsored:
    "Goes active, but nothing visible changes for buyers yet: the sponsored search-ranking boost isn't wired up on the backend (KNOWN-ISSUES #41).",
}

export function adStatusLabel(status: string | null | undefined) {
  return (status || "unknown").replace(/_/g, " ")
}

/** The paid run window is already over — approving now would activate an ad that can't run. */
export function runWindowEnded(ad: AdminAd) {
  return hasEnded(ad.endsAt)
}

export function adTarget(ad: AdminAd) {
  if (ad.listingId) return { label: "Listing", id: ad.listingId }
  if (ad.projectId) return { label: "Project", id: ad.projectId }
  if (ad.targetCity) return { label: "City", text: ad.targetCity }
  return { label: "Target", text: "All cities" }
}

/**
 * Approve / reject an ad (G6). Neither needs step-up per the backend's
 * guards — approve gets an explicit confirmation instead, reject its reason
 * dialog. 409 (no longer pending) / 404 → message + the queue refetches.
 */
export function useAdActions(onDone?: (action: "approved" | "rejected", id: string) => void) {
  const [approve] = useApproveAdMutation()
  const [reject] = useRejectAdMutation()
  const inFlight = useRef(new Set<string>())
  const [busy, setBusy] = useState<Record<string, boolean>>({})

  const run = async (id: string, call: () => Promise<unknown>, onSuccess: () => void, fallback: string) => {
    if (inFlight.current.has(id)) return
    inFlight.current.add(id)
    setBusy((b) => ({ ...b, [id]: true }))
    try {
      await call()
      onSuccess()
    } catch (err) {
      const code = getApiErrorCode(err)
      if (code === "CONFLICT" || code === "NOT_FOUND" || code === "INVALID_STATE_TRANSITION") {
        toast.info(errorText(err, "This ad is no longer waiting for review."), { description: "The queue has been refreshed." })
      } else {
        toast.error(errorText(err, fallback))
      }
    } finally {
      inFlight.current.delete(id)
      setBusy((b) => ({ ...b, [id]: false }))
    }
  }

  return {
    busy: (id: string) => !!busy[id],
    approve: (id: string) =>
      run(
        id,
        () => approve(id).unwrap(),
        () => {
          toast.success("Ad approved — it's active now")
          onDone?.("approved", id)
        },
        "Couldn't approve this ad.",
      ),
    reject: (id: string, reason: string, after?: () => void) =>
      run(
        id,
        () => reject({ id, reason: reason.trim() }).unwrap(),
        () => {
          toast.warning("Ad rejected", { description: "The advertiser sees your reason and can resubmit for free." })
          after?.()
          onDone?.("rejected", id)
        },
        "Couldn't reject this ad.",
      ),
  }
}

export type AdActions = ReturnType<typeof useAdActions>

export function PendingAdButtons({ ad, actions, size = "sm" }: { ad: AdminAd; actions: AdActions; size?: "sm" | "default" }) {
  const [confirming, setConfirming] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState("")
  const busy = actions.busy(ad._id)
  const label = adProductLabel(ad.product)

  return (
    <div className="flex flex-wrap gap-1.5">
      <Button size={size} className="gap-1" disabled={busy} onClick={() => setConfirming(true)} aria-label={`Approve ${label} ad`}>
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Approve
      </Button>
      <Button size={size} variant="destructive" className="gap-1" disabled={busy} onClick={() => setRejecting(true)} aria-label={`Reject ${label} ad`}>
        <X className="h-3.5 w-3.5" /> Reject
      </Button>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve this {label.toLowerCase()} ad?</AlertDialogTitle>
            <AlertDialogDescription>{APPROVE_EFFECT[ad.product as AdProduct] ?? "It goes active immediately."}</AlertDialogDescription>
          </AlertDialogHeader>
          {(runWindowEnded(ad) || hasUnsafeCreative(ad)) && (
            <div role="alert" className="space-y-1.5 border border-red-200 bg-red-50 p-3 text-xs text-red-800">
              {runWindowEnded(ad) && (
                <p className="flex gap-1.5">
                  <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>
                    Its paid run window already ended on <b>{formatDate(ad.endsAt)}</b> — approving makes it “active” for a period
                    that&apos;s over. Consider rejecting it so the advertiser can resubmit.
                  </span>
                </p>
              )}
              {hasUnsafeCreative(ad) && (
                <p className="flex gap-1.5">
                  <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>A creative or click-through URL isn&apos;t https — it would be served to buyers as-is. Reject it instead.</span>
                </p>
              )}
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => actions.approve(ad._id)}>Approve</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <RejectionDialog
        open={rejecting}
        onOpenChange={(o) => {
          setRejecting(o)
          if (!o) setReason("")
        }}
        title="Reject this ad"
        description="The advertiser sees this reason and can resubmit for free — no second payment."
        reason={reason}
        onReasonChange={setReason}
        isSubmitting={busy}
        onConfirm={() =>
          actions.reject(ad._id, reason, () => {
            setRejecting(false)
            setReason("")
          })
        }
        placeholder="e.g. Banner image is low resolution — please re-upload."
      />
    </div>
  )
}

/**
 * Creative preview. The backend stores any string here (verified: it saved
 * `javascript:` and `http:` values), so only https URLs are rendered as an
 * image or link; anything else is shown as inert text and flagged.
 */
export function CreativePreview({ creative }: { creative: NonNullable<AdminAd["creatives"]>[number] }) {
  const [broken, setBroken] = useState(false)
  const src = creative.cloudinaryPublicId
  const kind = classifyCreativeSrc(src)
  const safeSrc = kind === "https"
  const target = creative.targetUrl
  const safeTarget = isSafeHttpsUrl(target)

  return (
    <div className="space-y-2 border border-brand-border p-3">
      {safeSrc && !broken ? (
        <img src={src} alt="Ad creative" referrerPolicy="no-referrer" className="max-h-56 w-full object-contain" onError={() => setBroken(true)} />
      ) : (
        <div className="grid h-32 place-items-center bg-brand-tertiary/40 text-center text-xs text-brand-secondary/60">
          <div className="flex flex-col items-center gap-1.5 px-3">
            {kind === "unsafe" ? <ShieldAlert className="h-4 w-4 text-red-500" /> : <ImageOff className="h-4 w-4" />}
            {safeSrc
              ? "Image failed to load"
              : kind === "asset"
                ? "Cloudinary asset id — no preview available in the admin"
                : kind === "empty"
                  ? "No image attached"
                  : "Unsafe URL (not https) — not rendered"}
            <code className="max-w-full break-all text-[10px] text-brand-secondary/50">{src || "(empty)"}</code>
          </div>
        </div>
      )}
      <div className="text-[11px] text-brand-secondary/65">
        <span className="font-semibold">Click-through: </span>
        {target ? (
          safeTarget ? (
            <a href={target} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 break-all text-brand-primary-dark hover:underline">
              {target} <ExternalLink className="h-3 w-3 shrink-0" />
            </a>
          ) : (
            <span className="break-all text-red-600">
              <code>{target}</code> — unsafe (not https); don&apos;t approve as-is
            </span>
          )
        ) : (
          "none"
        )}
      </div>
    </div>
  )
}

/**
 * True when a creative image or click-through uses a non-https scheme
 * (javascript:, http:, data:…). A bare Cloudinary public id is NOT unsafe.
 */
export function hasUnsafeCreative(ad: AdminAd) {
  return (ad.creatives ?? []).some(
    (c) => classifyCreativeSrc(c.cloudinaryPublicId) === "unsafe" || (!!c.targetUrl && !isSafeHttpsUrl(c.targetUrl)),
  )
}
