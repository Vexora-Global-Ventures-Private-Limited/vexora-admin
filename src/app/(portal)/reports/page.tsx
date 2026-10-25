"use client"

import { useMemo } from "react"
import { Download, LineChart as LineChartIcon } from "lucide-react"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { StatCard } from "@/components/admin/stat-card"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { useGetDashboardQuery } from "@/store/api/adminApi"
import { getApiErrorMessage } from "@/lib/api-error"
import { formatDateTime, istToday, isPending, LISTING_STATUS_LABEL, pendingOr, TIER_LABEL } from "@/components/admin/dashboard/dashboard-utils"

const LISTINGS_CONFIG: ChartConfig = { count: { label: "Listings", color: "var(--brand-primary-dark)" } }

/**
 * One CSV cell. Text starting with = + - @ (or a tab/CR) is prefixed with
 * an apostrophe so Excel / Sheets treat it as text, not a formula (CSV
 * injection) — status names come from the backend, so a cell isn't always
 * ours. Real numbers are left alone so they stay numeric.
 */
function csvCell(value: string | number | null | undefined) {
  if (typeof value === "number") return String(value)
  let text = String(value ?? "")
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`
  return `"${text.replace(/"/g, '""')}"`
}

function downloadCsv(filename: string, rows: (string | number)[][]) {
  // BOM so Excel reads the file as UTF-8 (otherwise "₹" turns into mojibake).
  const csv = "\uFEFF" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n")
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  // Revoke after the click has been handled, or some browsers cancel the download.
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

/**
 * G11 — platform report. There's no analytics/history API: the only real
 * source is GET /admin/dashboard (a point-in-time snapshot), so this page
 * shows that snapshot and exports it. Trend charts need time-series data the
 * backend doesn't expose yet — shown as unavailable rather than invented.
 */
export default function ReportsPage() {
  const { data, isLoading, isError, error, refetch, fulfilledTimeStamp } = useGetDashboardQuery()

  const listingsData = useMemo(
    () =>
      Object.entries(data?.listings.byStatus ?? {}).map(([status, count]) => ({
        status: LISTING_STATUS_LABEL[status] ?? status,
        count,
      })),
    [data],
  )

  const exportSnapshot = () => {
    if (!data) return
    const v = (path: string, value: number | null) => (isPending(data, path) ? "not available yet" : (value ?? ""))
    const rows: (string | number)[][] = [
      ["Metric", "Value"],
      ["Snapshot taken (IST)", formatDateTime(new Date(fulfilledTimeStamp ?? Date.now()).toISOString())],
      ["Signups today", v("users.signups.today", data.users.signups.today)],
      ["Signups last 7 days", v("users.signups.last7d", data.users.signups.last7d)],
      ["Signups last 30 days", v("users.signups.last30d", data.users.signups.last30d)],
      ["Active users", v("users.active", data.users.active)],
      ["Suspended users", v("users.suspended", data.users.suspended)],
      ...Object.entries(data.listings.byStatus).map(([s, c]) => [`Listings — ${LISTING_STATUS_LABEL[s] ?? s}`, c]),
      ["Listing moderation queue", data.listings.moderationQueue],
      ...(["mercury", "jupiter", "venus"] as const).map((t) => [
        `Memberships — ${TIER_LABEL[t]}`,
        v("memberships.byTier", data.memberships.byTier[t] ?? 0),
      ]),
      ["Leads last 30 days", v("leads.last30d", data.leads.last30d)],
      ["MRR (₹)", v("mrr", data.mrr)],
      ["Open abuse reports", data.abuse.open],
      ["Abuse SLA breaches", data.abuse.slaBreached],
      ["KYC queue", data.queues.kyc],
      ["Ads queue", data.queues.ads],
    ]
    downloadCsv(`vxa-platform-snapshot-${istToday()}.csv`, rows)
    toast.success("Snapshot downloaded")
  }

  const listingsPending = isPending(data, "listings.byStatus")

  if (isError && !data) {
    return (
      <div className="border border-red-200 bg-card p-8 text-center text-sm">
        <p className="font-semibold text-red-700">Couldn&apos;t load platform numbers.</p>
        <p className="mt-1 text-brand-muted-foreground">{getApiErrorMessage(error) ?? "Please try again."}</p>
        <Button className="mt-4" variant="outline" onClick={() => refetch()}>
          Retry
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-brand-secondary/60">
          Point-in-time platform snapshot from the live dashboard numbers.
          {fulfilledTimeStamp ? ` As of ${formatDateTime(new Date(fulfilledTimeStamp).toISOString())}.` : ""}
        </p>
        <Button variant="outline" size="sm" onClick={exportSnapshot} disabled={!data}>
          <Download className="mr-1.5 h-4 w-4" aria-hidden /> Download snapshot (CSV)
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Signups (30d)" value={data ? pendingOr(data, "users.signups.last30d", data.users.signups.last30d) : 0} loading={isLoading} />
        <StatCard label="Active users" value={data ? pendingOr(data, "users.active", data.users.active) : 0} loading={isLoading} />
        <StatCard label="MRR" value={data ? pendingOr(data, "mrr", data.mrr) : 0} prefix="₹" loading={isLoading} />
        <StatCard label="Leads (30d)" value={data ? pendingOr(data, "leads.last30d", data.leads.last30d) : 0} loading={isLoading} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section aria-labelledby="listings-chart" className="bg-card p-5 ring-1 ring-brand-border">
          <h2 id="listings-chart" className="font-serif text-base font-bold text-brand-secondary">
            Listings by status
          </h2>
          {isLoading ? (
            <div className="mt-3 h-56 animate-pulse bg-brand-tertiary/60" />
          ) : listingsPending ? (
            <p className="mt-3 text-sm text-brand-muted-foreground">Not available yet.</p>
          ) : listingsData.length === 0 ? (
            <p className="mt-3 text-sm text-brand-muted-foreground">No listings yet.</p>
          ) : (
            <ChartContainer config={LISTINGS_CONFIG} className="mt-3 h-56 w-full" aria-label="Bar chart of listings by status">
              <BarChart data={listingsData}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="status" tickLine={false} axisLine={false} fontSize={11} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={32} fontSize={11} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="count" fill="var(--color-count)" radius={0} />
              </BarChart>
            </ChartContainer>
          )}
        </section>

        <section aria-labelledby="trends" className="flex flex-col items-center justify-center bg-card p-5 text-center ring-1 ring-brand-border">
          <LineChartIcon className="h-6 w-6 text-brand-primary-dark" aria-hidden />
          <h2 id="trends" className="mt-2 font-serif text-base font-bold text-brand-secondary">
            Signup &amp; revenue trends
          </h2>
          <p className="mt-1 max-w-sm text-sm text-brand-muted-foreground">
            Not available yet — the backend only exposes current totals, not history. Trends need a time-series analytics
            endpoint.
          </p>
        </section>
      </div>

      <section aria-labelledby="ops" className="bg-card p-5 ring-1 ring-brand-border">
        <h2 id="ops" className="font-serif text-base font-bold text-brand-secondary">
          Operations
        </h2>
        <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["Open abuse reports", data?.abuse.open],
            ["Abuse SLA breaches", data?.abuse.slaBreached],
            ["Listing queue", data?.listings.moderationQueue],
            ["Ad queue", data?.queues.ads],
          ].map(([label, value]) => (
            <div key={label as string} className="bg-brand-tertiary/40 p-3">
              <dt className="text-[10px] uppercase tracking-wide text-brand-secondary/55">{label}</dt>
              <dd className="mt-1 font-serif text-xl font-bold text-brand-secondary">{isLoading ? "…" : (value ?? 0)}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  )
}
