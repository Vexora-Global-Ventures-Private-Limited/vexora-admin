"use client"

import { use, useState } from "react"
import { Check, Mail, FileText, Calendar, X } from "lucide-react"
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

export default function KycDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const initial = useAdminDataStore((s) => s.kyc.find((k) => k.id === id))
  const decideKyc = useAdminDataStore((s) => s.decideKyc)
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState("")
  const stepUp = useStepUp()

  if (!initial) {
    return <NotFoundCard label="KYC submission" id={id} />
  }

  const approve = () =>
    stepUp.run(() => {
      decideKyc(id, true)
      toast.success("KYC approved — Verified badge granted")
    })
  const confirmReject = () =>
    stepUp.run(() => {
      decideKyc(id, false, reason)
      toast.warning("KYC rejected", { description: "Audit-logged." })
      setRejecting(false)
      setReason("")
    })

  const facts = [
    { label: "Applicant", value: initial.userName, icon: FileText },
    { label: "Email", value: initial.userEmail, icon: Mail },
    { label: "Submitted", value: initial.submittedAt, icon: Calendar },
  ]

  return (
    <div className="max-w-2xl space-y-6">
      <DetailBackLink href={ROUTES.kyc} label="KYC review queue" />

      <DetailCard>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="font-serif text-xl font-bold text-brand-secondary">{initial.docType}</div>
            <div className="mt-1 text-sm text-brand-secondary/55">{initial.id}</div>
          </div>
          <StatusPill tone={initial.status === "approved" ? "success" : initial.status === "rejected" ? "danger" : "warning"}>{initial.status}</StatusPill>
        </div>

        {/* Document preview placeholder — no scanned file in the mock dataset. */}
        <div className="mt-5 grid h-40 place-items-center border border-dashed border-brand-border bg-brand-tertiary/40 text-xs text-brand-secondary/45">
          Document preview — {initial.docType}
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {facts.map((f) => (
            <div key={f.label} className="bg-brand-tertiary/40 p-3">
              <f.icon className="h-4 w-4 text-brand-primary-dark" />
              <div className="mt-1 truncate text-xs font-bold text-brand-secondary">{f.value}</div>
              <div className="text-[10px] uppercase tracking-wide text-brand-secondary/50">{f.label}</div>
            </div>
          ))}
        </div>

        {initial.rejectionReason && (
          <div className="mt-4 bg-red-50 p-3 text-xs text-red-700">
            <b>Rejection reason:</b> {initial.rejectionReason}
          </div>
        )}

        {initial.status === "pending" && (
          <div className="mt-5 flex gap-2">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button className="btn-gold gap-1.5"><Check className="h-4 w-4" /> Approve</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Approve this KYC submission?</AlertDialogTitle>
                  <AlertDialogDescription>Grants the Verified badge immediately.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={approve}>Approve</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Button variant="destructive" className="gap-1.5" onClick={() => setRejecting(true)}><X className="h-4 w-4" /> Reject</Button>
          </div>
        )}
      </DetailCard>

      <RejectionDialog
        open={rejecting}
        onOpenChange={setRejecting}
        title="Reject this KYC submission"
        description="The applicant will see this reason and can resubmit."
        reason={reason}
        onReasonChange={setReason}
        onConfirm={confirmReject}
        placeholder="e.g. Document image is illegible — please re-upload."
      />
      <TotpStepUpDialog {...stepUp} />
    </div>
  )
}
