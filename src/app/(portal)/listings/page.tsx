"use client"

import Link from "next/link"
import { RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DataTable, type DataTableColumn } from "@/components/admin/data-table"
import { StatusPill } from "@/components/admin/status-pill"
import { PendingListingButtons, LiveListingTools, useListingActions } from "@/components/admin/moderation/listing-actions"
import { QueryState, UserLink, formatDateTime, formatPaise } from "@/components/admin/moderation/shared"
import { listingStatusLabel, listingStatusTone } from "@/lib/listing-status"
import { useGetListingQueueQuery, type AdminListing } from "@/store/api/adminApi"
import { ROUTES } from "@/lib/routes"

function place(l: AdminListing) {
  return [l.locality, l.city].filter(Boolean).join(", ") || "Location not given"
}

function specs(l: AdminListing) {
  return [l.bhk ? `${l.bhk} BHK` : null, l.propertyType, l.purpose === "rent" ? "for rent" : l.purpose === "sale" ? "for sale" : l.purpose]
    .filter(Boolean)
    .join(" · ")
}

/**
 * G4 moderation queue — every listing in `pending_review`, oldest first.
 * The API returns full raw listing documents; only the fields a reviewer
 * needs are shown. A submitted listing stays invisible to buyers until it's
 * approved here.
 */
export default function ListingsPage() {
  const { data, isLoading, isFetching, error, refetch } = useGetListingQueueQuery(undefined, { refetchOnMountOrArgChange: true })
  const actions = useListingActions()
  const listings = data ?? []

  const columns: DataTableColumn<AdminListing>[] = [
    {
      key: "title",
      header: "Listing",
      sortable: true,
      sortValue: (l) => l.title ?? "",
      render: (l) => (
        <Link href={ROUTES.listingDetail(l._id)} className="block max-w-[260px] hover:underline">
          <div className="truncate text-xs font-bold text-brand-secondary">{l.title || "Untitled listing"}</div>
          <div className="truncate text-[10px] text-brand-secondary/55">{place(l)}</div>
        </Link>
      ),
    },
    { key: "specs", header: "Type", render: (l) => <span className="text-xs text-brand-secondary/70">{specs(l) || "—"}</span> },
    { key: "price", header: "Price", sortable: true, sortValue: (l) => l.pricePaise ?? 0, render: (l) => <span className="font-bold">{formatPaise(l.pricePaise)}</span> },
    { key: "seller", header: "Seller", render: (l) => <UserLink id={l.sellerId} className="text-brand-secondary/65" /> },
    {
      key: "submittedAt",
      header: "Submitted",
      sortable: true,
      sortValue: (l) => l.submittedAt ?? l.updatedAt ?? l.createdAt,
      render: (l) => <span className="whitespace-nowrap text-brand-secondary/55">{formatDateTime(l.submittedAt ?? l.updatedAt ?? l.createdAt)}</span>,
    },
    {
      key: "status",
      header: "Status",
      render: (l) => <StatusPill tone={listingStatusTone(l.status)}>{listingStatusLabel(l.status)}</StatusPill>,
    },
    {
      key: "actions",
      header: "Actions",
      render: (l) =>
        l.status === "pending_review" ? <PendingListingButtons id={l._id} title={l.title || "this listing"} actions={actions} /> : null,
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-brand-secondary/60">
          Listings waiting for review, oldest first. Approving makes a listing visible to every buyer immediately.
        </p>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => refetch()} disabled={isFetching}>
          <RotateCcw className={isFetching ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} /> Refresh
        </Button>
      </div>

      <QueryState isLoading={isLoading} error={error} onRetry={refetch} isFetching={isFetching}>
        <DataTable
          columns={columns}
          rows={listings}
          rowKey={(l) => l._id}
          defaultSortKey="submittedAt"
          defaultSortDirection="asc"
          pageSize={10}
          emptyLabel="The review queue is empty — no listings are waiting for a decision."
        />
      </QueryState>

      <LiveListingTools actions={actions} />
    </div>
  )
}
