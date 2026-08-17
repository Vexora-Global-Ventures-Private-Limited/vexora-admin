"use client"

import { use, useState } from "react"
import { toast } from "sonner"
import { Check, X, Clock, Trash2 } from "lucide-react"
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { StatusPill } from "@/components/admin/status-pill"
import { TotpStepUpDialog } from "@/components/admin/totp-step-up-dialog"
import { RejectionDialog } from "@/components/admin/rejection-dialog"
import { DetailBackLink, DetailCard } from "@/components/admin/detail-page-shell"
import { NotFoundCard } from "@/components/admin/not-found-card"
import { useStepUp } from "@/lib/use-step-up"
import { useAdminDataStore } from "@/lib/admin-data-store"
import { LISTING_STATUS_TONE } from "@/lib/listing-status"
import { ROUTES } from "@/lib/routes"

export default function ListingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const initial = useAdminDataStore((s) => s.listings.find((l) => l.id === id))
  const approveListing = useAdminDataStore((s) => s.approveListing)
  const rejectListing = useAdminDataStore((s) => s.rejectListing)
  const extendListing = useAdminDataStore((s) => s.extendListing)
  const removeListing = useAdminDataStore((s) => s.removeListing)
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState("")
  const stepUp = useStepUp()

  if (!initial) {
    return <NotFoundCard label="Listing" id={id} />
  }

  const approve = () => {
    approveListing(id)
    toast.success("Listing approved — now live")
  }
  const confirmReject = () => {
    rejectListing(id, reason)
    toast.warning("Listing rejected", { description: "Audit-logged." })
    setRejecting(false)
    setReason("")
  }
  const extend = () =>
    stepUp.run(() => {
      const newExpiresAt = extendListing(id, 30)
      toast.success(`Listing extended to ${newExpiresAt}`, { description: "Audit-logged." })
    })
  const remove = () =>
    stepUp.run(() => {
      removeListing(id)
      toast.warning("Listing removed from marketplace", { description: "Audit-logged." })
    })

  return (
    <div className="max-w-2xl space-y-6">
      <DetailBackLink href={ROUTES.listings} label="Listing queue" />

      <DetailCard>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="font-serif text-xl font-bold text-brand-secondary">{initial.title}</div>
            <div className="mt-1 text-sm text-brand-secondary/55">{initial.location}</div>
          </div>
          <StatusPill tone={LISTING_STATUS_TONE[initial.status]}>{initial.status.replace("_", " ")}</StatusPill>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
          <div className="bg-brand-tertiary/40 p-3">
            <div className="text-[10px] uppercase tracking-wide text-brand-secondary/50">Submitted by</div>
            <div className="font-bold text-brand-secondary">{initial.submittedBy}</div>
          </div>
          <div className="bg-brand-tertiary/40 p-3">
            <div className="text-[10px] uppercase tracking-wide text-brand-secondary/50">Submitted at</div>
            <div className="font-bold text-brand-secondary">{initial.submittedAt}</div>
          </div>
          {initial.expiresAt && (
            <div className="bg-brand-tertiary/40 p-3">
              <div className="text-[10px] uppercase tracking-wide text-brand-secondary/50">Expires</div>
              <div className="font-bold text-brand-secondary">{initial.expiresAt}</div>
            </div>
          )}
        </div>

        {initial.rejectionReason && (
          <div className="mt-4 bg-red-50 p-3 text-xs text-red-700">
            <b>Rejection reason:</b> {initial.rejectionReason}
          </div>
        )}

        <div className="mt-5 flex flex-wrap gap-2">
          {initial.status === "pending_review" && (
            <>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button className="btn-gold gap-1.5"><Check className="h-4 w-4" /> Approve listing</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Approve this listing?</AlertDialogTitle>
                    <AlertDialogDescription>It goes live immediately and becomes publicly visible.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={approve}>Approve</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <Button variant="destructive" className="gap-1.5" onClick={() => setRejecting(true)}><X className="h-4 w-4" /> Reject listing</Button>
            </>
          )}
          {initial.status === "live" && (
            <>
              <Button variant="outline" className="gap-1.5" onClick={extend}><Clock className="h-4 w-4" /> Extend validity</Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="gap-1.5"><Trash2 className="h-4 w-4" /> Remove listing</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Remove this listing?</AlertDialogTitle>
                    <AlertDialogDescription>It's taken down from the marketplace immediately.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={remove}>Remove</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
        </div>
      </DetailCard>

      <RejectionDialog
        open={rejecting}
        onOpenChange={setRejecting}
        title="Reject this listing"
        description="The submitter will see this reason and can correct & resubmit."
        reason={reason}
        onReasonChange={setReason}
        onConfirm={confirmReject}
        placeholder="e.g. Missing RERA registration number."
      />
      <TotpStepUpDialog {...stepUp} />
    </div>
  )
}
