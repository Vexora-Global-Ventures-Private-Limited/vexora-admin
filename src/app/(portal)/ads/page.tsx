"use client"

import { UserCard, UserChip } from "@/components/admin/users/user-chip"
import { useMemo, useState } from "react"
import Link from "next/link"
import { RotateCcw, ShieldAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DataTable, type DataTableColumn } from "@/components/admin/data-table"
import { FilterBar } from "@/components/admin/filter-bar"
import { StatusPill } from "@/components/admin/status-pill"
import {
  AD_PRODUCT_LABEL,
  PendingAdButtons,
  adProductLabel,
  adStatusLabel,
  adTarget,
  hasUnsafeCreative,
  runWindowEnded,
  useAdActions,
} from "@/components/admin/ads/ad-actions"
import { AdPackagesSection } from "@/components/admin/ads/ad-packages"
import { QueryState, ShortId, formatDate, formatDateTime, formatPaise } from "@/components/admin/moderation/shared"
import { useGetAdQueueQuery, type AdminAd } from "@/store/api/adminApi"
import { ROUTES } from "@/lib/routes"

/**
 * G6 ad approval queue — every ad product must pass through here before it
 * goes live (BR-62). Rejection never costs the advertiser a second payment.
 */
export default function AdsPage() {
  const { data, isLoading, isFetching, error, refetch } = useGetAdQueueQuery(undefined, { refetchOnMountOrArgChange: true })
  const actions = useAdActions()
  const [productFilter, setProductFilter] = useState("all")

  const ads = useMemo(() => (data ?? []).filter((a) => productFilter === "all" || a.product === productFilter), [data, productFilter])

  const columns: DataTableColumn<AdminAd>[] = [
    {
      key: "product",
      header: "Ad",
      sortable: true,
      sortValue: (a) => a.product,
      render: (a) => (
        <Link href={ROUTES.adDetail(a._id)} className="block hover:underline">
          <div className="text-xs font-bold text-brand-secondary">{adProductLabel(a.product)}</div>
          <ShortId id={a._id} className="text-brand-secondary/50" />
          {hasUnsafeCreative(a) && (
            <div className="mt-0.5 flex items-center gap-1 text-[10px] font-semibold text-red-600">
              <ShieldAlert className="h-3 w-3" /> unsafe creative URL
            </div>
          )}
        </Link>
      ),
    },
    {
      key: "target",
      header: "Target",
      render: (a) => {
        const t = adTarget(a)
        return (
          <span className="text-xs text-brand-secondary/70">
            {t.label}: {"id" in t ? <ShortId id={t.id} /> : t.text}
          </span>
        )
      },
    },
    { key: "owner", header: "Advertiser", render: (a) => <UserChip id={a.ownerId} className="max-w-[180px]" /> },
    { key: "amount", header: "Amount", sortable: true, sortValue: (a) => a.amountPaise ?? 0, render: (a) => <span className="font-bold">{formatPaise(a.amountPaise)}</span> },
    {
      key: "run",
      header: "Runs",
      render: (a) => (
        <div className="whitespace-nowrap text-[11px] text-brand-secondary/55">
          {a.startsAt ? `${formatDate(a.startsAt)} → ${formatDate(a.endsAt)}` : "—"}
          {runWindowEnded(a) && <div className="font-semibold text-red-600">Run window ended</div>}
        </div>
      ),
    },
    { key: "createdAt", header: "Submitted", sortable: true, sortValue: (a) => a.createdAt, render: (a) => <span className="whitespace-nowrap text-brand-secondary/55">{formatDateTime(a.createdAt)}</span> },
    {
      key: "actions",
      header: "Actions",
      render: (a) =>
        a.status === "pending_review" ? <PendingAdButtons ad={a} actions={actions} /> : <StatusPill>{adStatusLabel(a.status)}</StatusPill>,
    },
  ]

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-brand-secondary/60">
            Paid ads waiting for review. Nothing goes live without approval — rejection never requires a second payment (BR-62/63).
          </p>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => refetch()} disabled={isFetching}>
            <RotateCcw className={isFetching ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} /> Refresh
          </Button>
        </div>
        <FilterBar
          filters={[
            {
              key: "product",
              label: "Product",
              value: productFilter,
              onChange: setProductFilter,
              options: Object.entries(AD_PRODUCT_LABEL).map(([value, label]) => ({ value, label })),
            },
          ]}
        />
        <QueryState isLoading={isLoading} error={error} onRetry={refetch} isFetching={isFetching}>
          <DataTable
            columns={columns}
            rows={ads}
            rowKey={(a) => a._id}
            defaultSortKey="createdAt"
            defaultSortDirection="asc"
            pageSize={10}
            emptyLabel={productFilter === "all" ? "No ads are waiting for review." : "No ads of this product are waiting for review."}
          />
        </QueryState>
      </div>

      <AdPackagesSection />
    </div>
  )
}
