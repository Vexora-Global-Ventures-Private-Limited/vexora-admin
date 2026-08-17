"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { Check, X } from "lucide-react"
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
import type { KycSubmission, BadgeQueueItem } from "@/lib/admin-data"
import { ROUTES } from "@/lib/routes"

const KYC_STATUSES: KycSubmission["status"][] = ["pending", "approved", "rejected"]
const DOC_TYPES: KycSubmission["docType"][] = ["PAN", "Aadhaar", "RERA Certificate", "GST Certificate"]
const BADGE_STATUSES: BadgeQueueItem["status"][] = ["pending", "granted", "revoked"]
const BADGE_TYPES: BadgeQueueItem["badgeType"][] = ["Jupiter Verified", "Featured Developer"]

export default function KycPage() {
  const kyc = useAdminDataStore((s) => s.kyc)
  const badges = useAdminDataStore((s) => s.badges)
  const decideKyc = useAdminDataStore((s) => s.decideKyc)
  const decideBadge = useAdminDataStore((s) => s.decideBadge)
  const [kycStatusFilter, setKycStatusFilter] = useState("all")
  const [docTypeFilter, setDocTypeFilter] = useState("all")
  const [badgeStatusFilter, setBadgeStatusFilter] = useState("all")
  const [badgeTypeFilter, setBadgeTypeFilter] = useState("all")
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [reason, setReason] = useState("")
  const stepUp = useStepUp()

  const filteredKyc = useMemo(
    () =>
      kyc
        .filter((k) => kycStatusFilter === "all" || k.status === kycStatusFilter)
        .filter((k) => docTypeFilter === "all" || k.docType === docTypeFilter),
    [kyc, kycStatusFilter, docTypeFilter],
  )

  const filteredBadges = useMemo(
    () =>
      badges
        .filter((b) => badgeStatusFilter === "all" || b.status === badgeStatusFilter)
        .filter((b) => badgeTypeFilter === "all" || b.badgeType === badgeTypeFilter),
    [badges, badgeStatusFilter, badgeTypeFilter],
  )

  const approveKyc = (id: string) =>
    stepUp.run(() => {
      decideKyc(id, true)
      toast.success("KYC approved — Verified badge granted")
    })
  const confirmRejectKyc = () => {
    if (!rejectingId) return
    stepUp.run(() => {
      decideKyc(rejectingId, false, reason)
      toast.warning("KYC rejected", { description: "Audit-logged." })
      setRejectingId(null)
      setReason("")
    })
  }

  const decideBadgeAction = (id: string, granted: boolean) =>
    stepUp.run(() => {
      decideBadge(id, granted)
      toast[granted ? "success" : "warning"](granted ? "Badge granted" : "Badge revoked", { description: "Audit-logged." })
    })

  const kycColumns: DataTableColumn<KycSubmission>[] = [
    {
      key: "user", header: "User", sortable: true, sortValue: (k) => k.userName, render: (k) => (
        <Link href={ROUTES.kycDetail(k.id)} className="hover:underline">
          <div className="text-xs font-bold text-brand-secondary">{k.userName}</div>
          <div className="text-[10px] text-brand-secondary/55">{k.userEmail}</div>
        </Link>
      ),
    },
    { key: "docType", header: "Document", sortable: true, sortValue: (k) => k.docType, render: (k) => k.docType },
    { key: "submittedAt", header: "Submitted", sortable: true, sortValue: (k) => k.submittedAt, render: (k) => <span className="text-brand-secondary/55">{k.submittedAt}</span> },
    { key: "status", header: "Status", sortable: true, sortValue: (k) => k.status, render: (k) => <StatusPill tone={k.status === "approved" ? "success" : k.status === "rejected" ? "danger" : "warning"}>{k.status}</StatusPill> },
    {
      key: "actions", header: "Actions", render: (k) =>
        k.status === "pending" ? (
          <div className="flex gap-1.5">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" className="gap-1"><Check className="h-3.5 w-3.5" /> Approve</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Approve this KYC submission?</AlertDialogTitle>
                  <AlertDialogDescription>Grants the Verified badge immediately.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => approveKyc(k.id)}>Approve</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Button size="sm" variant="destructive" onClick={() => setRejectingId(k.id)} className="gap-1"><X className="h-3.5 w-3.5" /> Reject</Button>
          </div>
        ) : null,
    },
  ]

  const badgeColumns: DataTableColumn<BadgeQueueItem>[] = [
    { key: "entity", header: "Entity", sortable: true, sortValue: (b) => b.entityName, render: (b) => <span className="font-bold text-brand-secondary">{b.entityName}</span> },
    { key: "type", header: "Badge", sortable: true, sortValue: (b) => b.badgeType, render: (b) => <span className="rounded-full bg-brand-tertiary px-2 py-0.5 text-[10px] font-bold text-brand-primary-dark">{b.badgeType}</span> },
    { key: "submittedAt", header: "Submitted", sortable: true, sortValue: (b) => b.submittedAt, render: (b) => <span className="text-brand-secondary/55">{b.submittedAt}</span> },
    { key: "status", header: "Status", sortable: true, sortValue: (b) => b.status, render: (b) => <StatusPill tone={b.status === "granted" ? "success" : b.status === "revoked" ? "danger" : "warning"}>{b.status}</StatusPill> },
    {
      key: "actions", header: "Actions", render: (b) =>
        b.status === "pending" ? (
          <div className="flex gap-1.5">
            <Button size="sm" onClick={() => decideBadgeAction(b.id, true)}>Grant</Button>
            <Button size="sm" variant="destructive" onClick={() => decideBadgeAction(b.id, false)}>Deny</Button>
          </div>
        ) : (
          <Button size="sm" variant="outline" onClick={() => decideBadgeAction(b.id, b.status !== "granted")}>
            {b.status === "granted" ? "Revoke" : "Re-grant"}
          </Button>
        ),
    },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h2 className="mb-3 font-serif text-lg font-bold text-brand-secondary">KYC document review</h2>
        <FilterBar
          filters={[
            { key: "status", label: "Status", value: kycStatusFilter, onChange: setKycStatusFilter, options: KYC_STATUSES.map((s) => ({ label: s, value: s })) },
            { key: "docType", label: "Document", value: docTypeFilter, onChange: setDocTypeFilter, options: DOC_TYPES.map((d) => ({ label: d, value: d })) },
          ]}
        />
        <div className="mt-3">
          <DataTable columns={kycColumns} rows={filteredKyc} rowKey={(k) => k.id} defaultSortKey="submittedAt" defaultSortDirection="asc" />
        </div>
      </div>
      <div>
        <h2 className="mb-3 font-serif text-lg font-bold text-brand-secondary">Badge curation — Jupiter Verified &amp; Featured Developer</h2>
        <p className="mb-3 text-xs text-brand-secondary/55">Grant/revoke requires a fresh TOTP check (step-up).</p>
        <FilterBar
          filters={[
            { key: "status", label: "Status", value: badgeStatusFilter, onChange: setBadgeStatusFilter, options: BADGE_STATUSES.map((s) => ({ label: s, value: s })) },
            { key: "badgeType", label: "Badge", value: badgeTypeFilter, onChange: setBadgeTypeFilter, options: BADGE_TYPES.map((t) => ({ label: t, value: t })) },
          ]}
        />
        <div className="mt-3">
          <DataTable columns={badgeColumns} rows={filteredBadges} rowKey={(b) => b.id} defaultSortKey="submittedAt" defaultSortDirection="asc" />
        </div>
      </div>

      <RejectionDialog
        open={!!rejectingId}
        onOpenChange={(o) => !o && setRejectingId(null)}
        title="Reject this KYC submission"
        description="The applicant will see this reason and can resubmit."
        reason={reason}
        onReasonChange={setReason}
        onConfirm={confirmRejectKyc}
        placeholder="e.g. Document image is illegible — please re-upload."
      />
      <TotpStepUpDialog {...stepUp} />
    </div>
  )
}
