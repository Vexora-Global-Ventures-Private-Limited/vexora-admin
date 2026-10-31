"use client"

import Link from "next/link"
import {
  Users, UserX, Building2, Wallet, TrendingUp, Building, BadgeCheck, Megaphone, ShieldAlert, AlertTriangle, UserPlus,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { StatCard } from "@/components/admin/stat-card"
import { useGetDashboardQuery } from "@/store/api/adminApi"
import { getApiErrorMessage } from "@/lib/api-error"
import { ROUTES } from "@/lib/routes"
import { dashCounts, dashSum, dashValue, formatCount, isPending, LISTING_STATUS_LABEL, TIER_LABEL } from "@/components/admin/dashboard/dashboard-utils"

/**
 * G1 — GET /admin/dashboard. Fields listed in `pending` are backend stubs
 * (today: mrr, leads.last30d, memberships.byTier) and render as
 * "Not available yet" rather than a misleading ₹0 / 0.
 */
export default function DashboardPage() {
  // Shares the cache entry the layout polls for the nav badges.
  const { data, isLoading, isError, error, refetch, isFetching } = useGetDashboardQuery(undefined, {
    pollingInterval: 60_000,
    skipPollingIfUnfocused: true,
  })

  if (isError && !data) {
    return (
      <div className="border border-red-200 bg-card p-8 text-center text-sm">
        <p className="font-semibold text-red-700">Couldn&apos;t load the dashboard.</p>
        <p className="mt-1 text-brand-muted-foreground">{getApiErrorMessage(error) ?? "Check your connection and try again."}</p>
        <Button className="mt-4" variant="outline" onClick={() => refetch()} disabled={isFetching}>
          {isFetching ? "Retrying…" : "Retry"}
        </Button>
      </div>
    )
  }

  // Every value goes through dashValue(): pending, missing or malformed
  // fields come back null → "Not available yet", and a stubbed parent the
  // backend sends as null can't crash the page.
  const listingsPending = isPending(data, "listings.byStatus")
  const listingsByStatus = dashCounts(data, "listings.byStatus")
  const liveListings = data && !listingsPending ? (listingsByStatus.live ?? 0) : null
  const signupsToday = dashValue(data, "users.signups.today")
  const signups7d = dashValue(data, "users.signups.last7d")
  const signupHint =
    signupsToday != null && signups7d != null ? `${formatCount(signupsToday)} today · ${formatCount(signups7d)} in 7 days` : undefined
  const QUEUE_PATHS = ["listings.moderationQueue", "queues.kyc", "queues.ads", "abuse.open"]
  // A total that silently skipped a pending queue would look real — null instead.
  const queueTotal = dashSum(data, QUEUE_PATHS)
  const tiersPending = isPending(data, "memberships.byTier")
  const byTier = dashCounts(data, "memberships.byTier")

  const queues = [
    { label: "Listing approvals", count: dashValue(data, "listings.moderationQueue"), href: ROUTES.listings, icon: Building2 },
    { label: "KYC review", count: dashValue(data, "queues.kyc"), href: ROUTES.kyc, icon: BadgeCheck },
    { label: "Ad approvals", count: dashValue(data, "queues.ads"), href: ROUTES.ads, icon: Megaphone },
    { label: "Abuse reports", count: dashValue(data, "abuse.open"), href: ROUTES.abuse, icon: ShieldAlert },
  ]
  // "Open queue items" opens the queue that has work waiting: the only one if
  // just one does, else the busiest; nothing waiting → the queue row below.
  const busiestQueue = queues.filter((q) => (q.count ?? 0) > 0).sort((a, b) => (b.count ?? 0) - (a.count ?? 0))[0]
  const openQueueHref = busiestQueue?.href ?? "#queues-heading"
  const openQueueHint = busiestQueue
    ? `${queues.filter((q) => (q.count ?? 0) > 0).map((q) => `${formatCount(q.count ?? 0)} ${q.label.toLowerCase()}`).join(" · ")}`
    : undefined

  return (
    <div className="space-y-6">
      {isError && data && (
        <p className="border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200" role="status">
          Couldn&apos;t refresh — showing the last numbers loaded.{" "}
          <button type="button" className="font-semibold underline" onClick={() => refetch()} disabled={isFetching}>
            Try again
          </button>
        </p>
      )}
      <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Signups (30d)"
          value={dashValue(data, "users.signups.last30d")}
          hint={signupHint}
          icon={UserPlus}
          loading={isLoading}
          href={ROUTES.users}
        />
        <StatCard
          label="Active users"
          value={dashValue(data, "users.active")}
          icon={Users}
          loading={isLoading}
          href={`${ROUTES.users}?status=active`}
        />
        <StatCard
          label="Suspended users"
          value={dashValue(data, "users.suspended")}
          icon={UserX}
          loading={isLoading}
          href={`${ROUTES.users}?status=suspended`}
        />
        {/* No link: the Listings screen is the moderation queue (pending only), not live listings. */}
        <StatCard label="Live listings" value={liveListings} icon={Building} loading={isLoading} href={ROUTES.listings} />
        <StatCard
          label="MRR"
          value={dashValue(data, "mrr")}
          prefix="₹"
          icon={Wallet}
          loading={isLoading}
          href={ROUTES.payments}
        />
        <StatCard
          label="Leads (30d)"
          value={dashValue(data, "leads.last30d")}
          icon={TrendingUp}
          loading={isLoading}
          href={ROUTES.reports}
        />
        <StatCard
          label="Abuse SLA breaches"
          value={dashValue(data, "abuse.slaBreached")}
          icon={AlertTriangle}
          loading={isLoading}
          href={ROUTES.abuse}
        />
        <StatCard label="Open queue items" value={queueTotal} icon={ShieldAlert} loading={isLoading} href={openQueueHref} hint={openQueueHint} />
      </div>

      <section aria-labelledby="queues-heading">
        <h2 id="queues-heading" className="mb-3 font-serif text-lg font-bold text-brand-secondary">
          Approval queues
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {queues.map((q) => (
            <Link
              key={q.label}
              href={q.href}
              className="card-sheen flex items-center justify-between border border-brand-border/80 bg-card p-5 transition-colors hover:border-brand-primary/50 focus-visible:outline-2 focus-visible:outline-brand-primary"
            >
              <div>
                <div className="text-2xl font-bold text-brand-secondary">
                  {isLoading ? (
                    <span className="inline-block h-7 w-10 animate-pulse bg-brand-tertiary" aria-hidden />
                  ) : q.count == null ? (
                    <span className="font-sans text-sm font-semibold text-brand-muted-foreground">—</span>
                  ) : (
                    formatCount(q.count)
                  )}
                </div>
                <div className="text-xs text-brand-muted-foreground">{q.label}</div>
              </div>
              <span className="grid h-10 w-10 place-items-center bg-brand-primary/10 text-brand-primary-dark" aria-hidden>
                <q.icon className="h-5 w-5" />
              </span>
            </Link>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section aria-labelledby="listings-heading" className="bg-card p-5 ring-1 ring-brand-border">
          <h2 id="listings-heading" className="font-serif text-base font-bold text-brand-secondary">
            Listings by status
          </h2>
          {isLoading ? (
            <div className="mt-3 h-16 animate-pulse bg-brand-tertiary/60" />
          ) : listingsPending ? (
            <p className="mt-3 text-sm text-brand-muted-foreground">Not available yet — the backend still marks this figure as pending.</p>
          ) : Object.keys(listingsByStatus).length === 0 ? (
            <p className="mt-3 text-sm text-brand-muted-foreground">No listings yet.</p>
          ) : (
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {Object.entries(listingsByStatus)
                .sort(([, a], [, b]) => b - a)
                .map(([status, count]) => (
                  <Link
                    key={status}
                    href={ROUTES.listings}
                    title={status === "pending_review" ? "Open the review queue" : "Listings — review queue and live-listing tools"}
                    className="block bg-brand-tertiary/40 p-3 transition-colors hover:bg-brand-tertiary/70 hover:ring-1 hover:ring-brand-primary/50"
                  >
                    <div className="text-[10px] uppercase tracking-wide text-brand-secondary/55">
                      {LISTING_STATUS_LABEL[status] ?? status}
                    </div>
                    <div className="mt-1 font-serif text-xl font-bold text-brand-secondary">{formatCount(count)}</div>
                  </Link>
                ))}
            </div>
          )}
        </section>

        <section aria-labelledby="tiers-heading" className="bg-card p-5 ring-1 ring-brand-border">
          <h2 id="tiers-heading" className="font-serif text-base font-bold text-brand-secondary">
            Active memberships by tier
          </h2>
          {isLoading ? (
            <div className="mt-3 h-16 animate-pulse bg-brand-tertiary/60" />
          ) : tiersPending ? (
            <p className="mt-3 text-sm text-brand-muted-foreground">
              Not available yet — the backend still marks this figure as pending.
            </p>
          ) : (
            <div className="mt-3 grid grid-cols-3 gap-3">
              {(["mercury", "jupiter", "venus"] as const).map((tier) => (
                <Link
                  key={tier}
                  href={`${ROUTES.users}?tier=${tier}`}
                  title={`See ${TIER_LABEL[tier]} members`}
                  className="block bg-brand-tertiary/40 p-3 transition-colors hover:bg-brand-tertiary/70 hover:ring-1 hover:ring-brand-primary/50"
                >
                  <div className="text-[10px] uppercase tracking-wide text-brand-secondary/55">{TIER_LABEL[tier]}</div>
                  <div className="mt-1 font-serif text-xl font-bold text-brand-secondary">
                    {formatCount(byTier[tier] ?? 0)}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
