"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
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
import { DataTable, type DataTableColumn } from "@/components/admin/data-table"
import { FilterBar } from "@/components/admin/filter-bar"
import { StatusPill } from "@/components/admin/status-pill"
import { TotpStepUpDialog } from "@/components/admin/totp-step-up-dialog"
import { RejectionDialog } from "@/components/admin/rejection-dialog"
import { useStepUp } from "@/lib/use-step-up"
import { useAdminDataStore } from "@/lib/admin-data-store"
import type { AdQueueItem } from "@/lib/admin-data"
import { ROUTES } from "@/lib/routes"

const SLOTS: AdQueueItem["slot"][] = ["Homepage Hero", "Search Spotlight", "Featured Developer"]
const PAYMENT_STATUSES: AdQueueItem["paymentStatus"][] = ["Paid", "Pending"]
const APPROVAL_STATUSES: AdQueueItem["approvalStatus"][] = ["Under Review", "Approved", "Rejected"]

export default function AdsPage() {
  const queue = useAdminDataStore((s) => s.ads)
  const publishAd = useAdminDataStore((s) => s.publishAd)
  const rejectAd = useAdminDataStore((s) => s.rejectAd)
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [reason, setReason] = useState("")
  const [slotFilter, setSlotFilter] = useState("all")
  const [paymentFilter, setPaymentFilter] = useState("all")
  const [approvalFilter, setApprovalFilter] = useState("all")
  const stepUp = useStepUp()

  const filtered = useMemo(
    () =>
      queue
        .filter((a) => slotFilter === "all" || a.slot === slotFilter)
        .filter((a) => paymentFilter === "all" || a.paymentStatus === paymentFilter)
        .filter((a) => approvalFilter === "all" || a.approvalStatus === approvalFilter),
    [queue, slotFilter, paymentFilter, approvalFilter],
  )

  const publish = (id: string) =>
    stepUp.run(() => {
      publishAd(id)
      toast.success(`${id} published`)
    })
  const confirmReject = () => {
    if (!rejectingId) return
    stepUp.run(() => {
      rejectAd(rejectingId, reason)
      toast.warning(`${rejectingId} rejected — advertiser can resubmit free`, { description: "Audit-logged." })
      setRejectingId(null)
      setReason("")
    })
  }

  const columns: DataTableColumn<AdQueueItem>[] = [
    {
      key: "ad", header: "Ad", sortable: true, sortValue: (a) => a.headline, render: (a) => (
        <Link href={ROUTES.adDetail(a.id)} className="hover:underline">
          <div className="flex items-center gap-2">
            <span className="font-bold text-brand-primary-dark">{a.id}</span>
            <span className="rounded-full bg-brand-tertiary px-2 py-0.5 text-[10px] font-bold text-brand-primary-dark">{a.slot}</span>
          </div>
          <div className="text-xs font-bold text-brand-secondary">{a.headline}</div>
        </Link>
      ),
    },
    { key: "advertiser", header: "Advertiser", sortable: true, sortValue: (a) => a.advertiser, render: (a) => <span className="text-brand-secondary/65">{a.advertiser}</span> },
    { key: "amount", header: "Amount", sortable: true, sortValue: (a) => Number(a.amount.replace(/[₹,]/g, "")), render: (a) => <span className="font-bold">{a.amount}</span> },
    { key: "submittedAt", header: "Submitted", sortable: true, sortValue: (a) => a.submittedAt, render: (a) => <span className="text-brand-secondary/55">{a.submittedAt}</span> },
    { key: "payment", header: "Payment", sortable: true, sortValue: (a) => a.paymentStatus, render: (a) => <StatusPill tone={a.paymentStatus === "Paid" ? "success" : "warning"}>{a.paymentStatus}</StatusPill> },
    { key: "approval", header: "Approval", sortable: true, sortValue: (a) => a.approvalStatus, render: (a) => <StatusPill tone={a.approvalStatus === "Approved" ? "success" : a.approvalStatus === "Rejected" ? "danger" : "warning"}>{a.approvalStatus}</StatusPill> },
    {
      key: "actions", header: "Actions", render: (a) =>
        a.approvalStatus === "Under Review" && a.paymentStatus === "Paid" ? (
          <div className="flex gap-1.5">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" className="btn-gold">Publish</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Publish this ad?</AlertDialogTitle>
                  <AlertDialogDescription>It goes live in its slot immediately.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => publish(a.id)}>Publish</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Button size="sm" variant="destructive" onClick={() => setRejectingId(a.id)}>Reject</Button>
          </div>
        ) : (
          <Link href={ROUTES.adDetail(a.id)} className="text-[11px] font-bold text-brand-primary-dark hover:underline">
            View →
          </Link>
        ),
    },
  ]

  return (
    <div className="space-y-4">
      <p className="text-sm text-brand-secondary/60">Confirm ad payment, review creative, publish or reject — rejection never requires a second payment (BR-62/63).</p>
      <FilterBar
        filters={[
          { key: "slot", label: "Slot", value: slotFilter, onChange: setSlotFilter, options: SLOTS.map((s) => ({ label: s, value: s })) },
          { key: "payment", label: "Payment", value: paymentFilter, onChange: setPaymentFilter, options: PAYMENT_STATUSES.map((s) => ({ label: s, value: s })) },
          { key: "approval", label: "Approval", value: approvalFilter, onChange: setApprovalFilter, options: APPROVAL_STATUSES.map((s) => ({ label: s, value: s })) },
        ]}
      />
      <DataTable columns={columns} rows={filtered} rowKey={(a) => a.id} defaultSortKey="submittedAt" defaultSortDirection="asc" />

      <RejectionDialog
        open={!!rejectingId}
        onOpenChange={(o) => !o && setRejectingId(null)}
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
