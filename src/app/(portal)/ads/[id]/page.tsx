"use client"

import { use } from "react"
import { useRouter } from "next/navigation"
import { Info, ShieldAlert } from "lucide-react"
import { StatusPill } from "@/components/admin/status-pill"
import { DetailBackLink, DetailCard } from "@/components/admin/detail-page-shell"
import {
  APPROVE_EFFECT,
  CreativePreview,
  PendingAdButtons,
  adProductLabel,
  adStatusLabel,
  adTarget,
  runWindowEnded,
  useAdActions,
} from "@/components/admin/ads/ad-actions"
import { Fact, QueryState, ShortId, UserLink, formatDate, formatDateTime, formatPaise } from "@/components/admin/moderation/shared"
import { useGetAdPackagesQuery, useGetAdQueueQuery, type AdProduct } from "@/store/api/adminApi"
import { ROUTES } from "@/lib/routes"

/**
 * There's no admin "get ad by id" endpoint, so the review card is derived
 * from the approval queue; an ad that's no longer pending gets an honest
 * "not in the queue" state rather than a blank page.
 */
export default function AdDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { data, isLoading, isFetching, error, refetch } = useGetAdQueueQuery(undefined, { refetchOnMountOrArgChange: true })
  const { data: packages } = useGetAdPackagesQuery()
  const actions = useAdActions(() => router.push(ROUTES.ads))
  const ad = data?.find((a) => a._id === id)
  const pkg = ad?.packageId ? packages?.find((p) => p._id === ad.packageId) : undefined

  return (
    <div className="max-w-2xl space-y-6">
      <DetailBackLink href={ROUTES.ads} label="Ad approval queue" />

      <QueryState isLoading={isLoading} error={error} onRetry={refetch} isFetching={isFetching} rows={3}>
        {!ad ? (
          <DetailCard>
            <div className="font-serif text-lg font-bold text-brand-secondary">Not in the approval queue</div>
            <p className="mt-1 text-sm text-brand-secondary/65">
              Ad <span className="break-all font-mono text-xs">{id}</span> isn&apos;t waiting for review — it was already approved or
              rejected, or the id is wrong.
            </p>
          </DetailCard>
        ) : (
          <DetailCard>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="font-serif text-xl font-bold text-brand-secondary">{adProductLabel(ad.product)} ad</div>
                <ShortId id={ad._id} className="text-brand-secondary/50" />
              </div>
              <StatusPill tone={ad.status === "pending_review" ? "warning" : "neutral"}>{adStatusLabel(ad.status)}</StatusPill>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
              <Fact label="Advertiser" value={<UserLink id={ad.ownerId} />} />
              <Fact
                label={adTarget(ad).label}
                value={(() => {
                  const t = adTarget(ad)
                  return "id" in t ? <ShortId id={t.id} /> : t.text
                })()}
              />
              <Fact label="Amount paid" value={formatPaise(ad.amountPaise)} />
              <Fact label="Package" value={pkg ? `${pkg.name} · ${pkg.durationDays}d` : ad.packageId ? <ShortId id={ad.packageId} /> : "—"} />
              <Fact label="Runs" value={ad.startsAt ? `${formatDate(ad.startsAt)} → ${formatDate(ad.endsAt)}` : "—"} />
              <Fact label="Submitted" value={formatDateTime(ad.createdAt)} />
            </div>

            {runWindowEnded(ad) && (
              <div role="alert" className="mt-5 flex gap-2 border border-red-200 bg-red-50 p-3 text-xs text-red-800">
                <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  The paid run window ended on <b>{formatDate(ad.endsAt)}</b>. Approving now activates an ad for a period that&apos;s
                  already over — rejecting lets the advertiser resubmit for free.
                </span>
              </div>
            )}

            <div className="mt-5">
              <div className="mb-2 text-[10px] uppercase tracking-wide text-brand-secondary/50">Creative</div>
              {ad.creatives && ad.creatives.length > 0 ? (
                <div className="space-y-3">
                  {ad.creatives.map((c, i) => (
                    <CreativePreview key={i} creative={c} />
                  ))}
                </div>
              ) : (
                <p className="text-xs text-brand-secondary/55">
                  {ad.product === "sponsored" || ad.product === "featured"
                    ? "This product has no creative — it reuses the listing's / builder profile's own content."
                    : "No creative attached (the ad queue doesn't always include creatives)."}
                </p>
              )}
            </div>

            <div className="mt-5 flex gap-2 bg-brand-tertiary/40 p-3 text-xs text-brand-secondary/75">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>On approval: {APPROVE_EFFECT[ad.product as AdProduct] ?? "it goes active immediately."}</span>
            </div>

            {ad.status === "pending_review" && (
              <div className="mt-5">
                <PendingAdButtons ad={ad} actions={actions} size="default" />
              </div>
            )}
          </DetailCard>
        )}
      </QueryState>
    </div>
  )
}
