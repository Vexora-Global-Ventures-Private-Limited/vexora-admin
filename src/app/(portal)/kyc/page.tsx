"use client"

import Link from "next/link"
import { RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DataTable, type DataTableColumn } from "@/components/admin/data-table"
import { StatusPill } from "@/components/admin/status-pill"
import { QueryState, UserLink, formatDateTime } from "@/components/admin/moderation/shared"
import { BADGE_LABEL, useGetKycQueueQuery, type KycSubmission } from "@/components/admin/kyc/kyc-api"
import { documentLabel, useCanReviewKyc } from "@/components/admin/kyc/kyc-shared"
import { ROUTES } from "@/lib/routes"

/**
 * G5 — pending KYC submissions, oldest first. Open one to see its documents
 * and approve (grants the targeted badge) or reject with a reason. Badges are
 * only ever granted through KYC approval; revoking one is on the user page.
 */
export default function KycPage() {
  const { data, isLoading, isFetching, error, refetch } = useGetKycQueueQuery(undefined, { refetchOnMountOrArgChange: true })
  const canReview = useCanReviewKyc()

  const columns: DataTableColumn<KycSubmission>[] = [
    {
      key: "user",
      header: "Member",
      render: (s) => (
        <div className="space-y-0.5 text-xs">
          {s.userId ? (
            <Link href={ROUTES.userDetail(s.userId)} className="block font-semibold text-brand-secondary hover:underline">
              {s.userName ?? "No name"}
            </Link>
          ) : (
            <div className="font-semibold text-brand-secondary">{s.userName ?? "No name"}</div>
          )}
          {s.userMobile && <div className="text-brand-secondary/60">{s.userMobile}</div>}
          {s.userId && <UserLink id={s.userId} className="text-brand-secondary/50" />}
        </div>
      ),
    },
    {
      key: "badge",
      header: "Applying for",
      sortable: true,
      sortValue: (s) => s.targetBadge ?? "",
      render: (s) => <StatusPill tone="info">{BADGE_LABEL[s.targetBadge ?? ""] ?? s.targetBadge ?? "—"}</StatusPill>,
    },
    {
      key: "docs",
      header: "Documents",
      render: (s) => <span className="text-xs">{s.documents.map((d) => documentLabel(d.type)).join(", ") || "—"}</span>,
    },
    {
      key: "submitted",
      header: "Submitted",
      sortable: true,
      sortValue: (s) => s.submittedAt ?? "",
      render: (s) => <span className="whitespace-nowrap text-xs">{formatDateTime(s.submittedAt)}</span>,
    },
    {
      key: "open",
      header: "",
      render: (s) => (
        <Button asChild size="sm" variant="outline" disabled={!s.id}>
          <Link href={ROUTES.kycDetail(s.id)}>{canReview ? "Review" : "View"}</Link>
        </Button>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="max-w-3xl text-sm text-brand-secondary/60">
          Members waiting for ID verification, oldest first. Approving grants the badge they applied for and updates their
          listings in search. Badges are only ever granted through KYC approval.
          {!canReview && " Only super admins and moderators can approve or reject — view only for your role."}
        </p>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => refetch()} disabled={isFetching}>
          <RotateCcw className={isFetching ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} /> Refresh
        </Button>
      </div>
      <QueryState isLoading={isLoading} error={error} onRetry={refetch} isFetching={isFetching}>
        <DataTable
          columns={columns}
          rows={data ?? []}
          rowKey={(s) => s.id}
          defaultSortKey="submitted"
          defaultSortDirection="asc"
          pageSize={20}
          emptyLabel="No KYC submissions waiting for review."
        />
      </QueryState>
    </div>
  )
}
