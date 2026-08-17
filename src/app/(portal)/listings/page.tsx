"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
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
import { DataTable, type DataTableColumn } from "@/components/admin/data-table"
import { FilterBar } from "@/components/admin/filter-bar"
import { StatusPill } from "@/components/admin/status-pill"
import { TotpStepUpDialog } from "@/components/admin/totp-step-up-dialog"
import { RejectionDialog } from "@/components/admin/rejection-dialog"
import { useStepUp } from "@/lib/use-step-up"
import { useAdminDataStore } from "@/lib/admin-data-store"
import { LISTING_STATUS_TONE, LISTING_STATUSES } from "@/lib/listing-status"
import type { ListingQueueItem } from "@/lib/admin-data"
import { ROUTES } from "@/lib/routes"

export default function ListingsPage() {
  const queue = useAdminDataStore((s) => s.listings)
  const approveListing = useAdminDataStore((s) => s.approveListing)
  const rejectListing = useAdminDataStore((s) => s.rejectListing)
  const extendListing = useAdminDataStore((s) => s.extendListing)
  const removeListing = useAdminDataStore((s) => s.removeListing)
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [reason, setReason] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const stepUp = useStepUp()

  const filtered = useMemo(
    () => queue.filter((l) => statusFilter === "all" || l.status === statusFilter),
    [queue, statusFilter],
  )

  // Approve/reject stay ungated by step-up — extend/remove already carry the
  // higher-risk TOTP gate, and reject already has its reason-capture dialog
  // as a soft confirmation; approve gets an AlertDialog instead.
  const approve = (id: string) => {
    approveListing(id)
    toast.success(`${id} approved — now live`)
  }
  const confirmReject = () => {
    if (!rejectingId) return
    rejectListing(rejectingId, reason)
    toast.warning(`${rejectingId} rejected`, { description: "Audit-logged." })
    setRejectingId(null)
    setReason("")
  }
  const extend = (id: string) =>
    stepUp.run(() => {
      const newExpiresAt = extendListing(id, 30)
      toast.success(`${id} extended to ${newExpiresAt}`, { description: "Audit-logged." })
    })
  const remove = (id: string) =>
    stepUp.run(() => {
      removeListing(id)
      toast.warning(`${id} removed from marketplace`, { description: "Audit-logged." })
    })

  const columns: DataTableColumn<ListingQueueItem>[] = [
    {
      key: "title", header: "Listing", sortable: true, sortValue: (l) => l.title, render: (l) => (
        <Link href={ROUTES.listingDetail(l.id)} className="hover:underline">
          <div className="text-xs font-bold text-brand-secondary">{l.title}</div>
          <div className="text-[10px] text-brand-secondary/55">{l.location}</div>
        </Link>
      ),
    },
    { key: "submittedBy", header: "Submitted by", sortable: true, sortValue: (l) => l.submittedBy, render: (l) => <span className="text-brand-secondary/65">{l.submittedBy}</span> },
    { key: "submittedAt", header: "Submitted", sortable: true, sortValue: (l) => l.submittedAt, render: (l) => <span className="text-brand-secondary/55">{l.submittedAt}</span> },
    { key: "status", header: "Status", sortable: true, sortValue: (l) => l.status, render: (l) => <StatusPill tone={LISTING_STATUS_TONE[l.status]}>{l.status.replace("_", " ")}</StatusPill> },
    {
      key: "actions", header: "Actions", render: (l) => (
        <div className="flex flex-wrap gap-1.5">
          {l.status === "pending_review" && (
            <>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" className="gap-1"><Check className="h-3.5 w-3.5" /> Approve</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Approve this listing?</AlertDialogTitle>
                    <AlertDialogDescription>It goes live immediately and becomes publicly visible.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => approve(l.id)}>Approve</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <Button size="sm" variant="destructive" onClick={() => setRejectingId(l.id)} className="gap-1"><X className="h-3.5 w-3.5" /> Reject</Button>
            </>
          )}
          {l.status === "live" && (
            <>
              <Button size="sm" variant="outline" onClick={() => extend(l.id)} className="gap-1"><Clock className="h-3.5 w-3.5" /> Extend</Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="destructive" className="gap-1"><Trash2 className="h-3.5 w-3.5" /> Remove</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Remove this listing?</AlertDialogTitle>
                    <AlertDialogDescription>It's taken down from the marketplace immediately.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => remove(l.id)}>Remove</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <FilterBar
        filters={[{ key: "status", label: "Status", value: statusFilter, onChange: setStatusFilter, options: LISTING_STATUSES.map((s) => ({ label: s.replace("_", " "), value: s })) }]}
      />
      <DataTable columns={columns} rows={filtered} rowKey={(l) => l.id} defaultSortKey="submittedAt" defaultSortDirection="asc" />

      <RejectionDialog
        open={!!rejectingId}
        onOpenChange={(o) => !o && setRejectingId(null)}
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
