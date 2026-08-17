"use client"

import { use, useState } from "react"
import { Building2, Wallet, Calendar, Megaphone } from "lucide-react"
import { toast } from "sonner"
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
import { ROUTES } from "@/lib/routes"

export default function AdDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const initial = useAdminDataStore((s) => s.ads.find((a) => a.id === id))
  const publishAd = useAdminDataStore((s) => s.publishAd)
  const rejectAd = useAdminDataStore((s) => s.rejectAd)
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState("")
  const stepUp = useStepUp()

  if (!initial) {
    return <NotFoundCard label="Ad" id={id} />
  }

  const publish = () =>
    stepUp.run(() => {
      publishAd(id)
      toast.success(`${initial.id} published`)
    })
  const confirmReject = () =>
    stepUp.run(() => {
      rejectAd(id, reason)
      toast.warning(`${initial.id} rejected — advertiser can resubmit free`, { description: "Audit-logged." })
      setRejecting(false)
      setReason("")
    })

  const facts = [
    { label: "Advertiser", value: initial.advertiser, icon: Building2 },
    { label: "Slot", value: initial.slot, icon: Megaphone },
    { label: "Amount", value: initial.amount, icon: Wallet },
    { label: "Submitted", value: initial.submittedAt, icon: Calendar },
  ]

  return (
    <div className="max-w-2xl space-y-6">
      <DetailBackLink href={ROUTES.ads} label="Ad approval queue" />

      <DetailCard>
        <div className="flex items-start justify-between gap-4">
          <div>
            <span className="font-bold text-brand-primary-dark">{initial.id}</span>
            <div className="mt-1 font-serif text-xl font-bold text-brand-secondary">{initial.headline}</div>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <StatusPill tone={initial.paymentStatus === "Paid" ? "success" : "warning"}>Payment: {initial.paymentStatus}</StatusPill>
            <StatusPill tone={initial.approvalStatus === "Approved" ? "success" : initial.approvalStatus === "Rejected" ? "danger" : "warning"}>{initial.approvalStatus}</StatusPill>
          </div>
        </div>

        {/* Creative preview placeholder — no media asset in the mock dataset, so this
            represents where the ReviewPanel's creative-vs-slot-spec comparison would render. */}
        <div className="mt-5 grid h-40 place-items-center border border-dashed border-brand-border bg-brand-tertiary/40 text-xs text-brand-secondary/45">
          Creative preview — {initial.slot} spec
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {facts.map((f) => (
            <div key={f.label} className="bg-brand-tertiary/40 p-3">
              <f.icon className="h-4 w-4 text-brand-primary-dark" />
              <div className="mt-1 text-xs font-bold text-brand-secondary">{f.value}</div>
              <div className="text-[10px] uppercase tracking-wide text-brand-secondary/50">{f.label}</div>
            </div>
          ))}
        </div>

        {initial.rejectionReason && (
          <div className="mt-4 bg-red-50 p-3 text-xs text-red-700">
            <b>Rejection reason:</b> {initial.rejectionReason} — advertiser can resubmit free, no additional payment.
          </div>
        )}

        {initial.approvalStatus === "Under Review" && initial.paymentStatus === "Paid" && (
          <div className="mt-5 flex gap-2">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button className="btn-gold">Publish ad</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Publish this ad?</AlertDialogTitle>
                  <AlertDialogDescription>It goes live in its slot immediately.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={publish}>Publish</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Button variant="destructive" onClick={() => setRejecting(true)}>Reject</Button>
          </div>
        )}
      </DetailCard>

      <RejectionDialog
        open={rejecting}
        onOpenChange={setRejecting}
        title="Reject this ad"
        description="The advertiser will see this reason and can resubmit for free."
        reason={reason}
        onReasonChange={setReason}
        onConfirm={confirmReject}
        placeholder="e.g. Creative image is low resolution — please re-upload."
      />
      <TotpStepUpDialog {...stepUp} />
    </div>
  )
}
