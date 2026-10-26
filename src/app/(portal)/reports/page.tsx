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
import { dashCounts, dashValue, formatCount, formatDateTime, istToday, isPending, LISTING_STATUS_LABEL, TIER_LABEL } from "@/components/admin/dashboard/dashboard-utils"

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
      Object.entries(dashCounts(data, "listings.byStatus")).map(([status, count]) => ({
        status: LISTING_STATUS_LABEL[status] ?? status,
        count,
      })),
    [data],
  )

  const exportSnapshot = () => {
    if (!data) return
    // Every number goes through dashValue(): pending → "not available yet",
    // missing → blank. A pending field never exports as a real-looking 0.
    const NA = "not available yet"
    const v = (path: string) => (isPending(data, path) ? NA : (dashValue(data, path) ?? ""))
    const listingRows: (string | number)[][] = isPending(data, "listings.byStatus")
      ? [["Listings by status", NA]]
      : Object.entries(dashCounts(data, "listings.byStatus")).map(([st, c]) => [`Listings — ${LISTING_STATUS_LABEL[st] ?? st}`, c])
    const tiersPending = isPending(data, "memberships.byTier")
    const byTier = dashCounts(data, "memberships.byTier")
    const rows: (string | number)[][] = [
      ["Metric", "Value"],
      ["Snapshot taken", formatDateTime(new Date(fulfilledTimeStamp ?? Date.now()).toISOString())],
      ["Signups today", v("users.signups.today")],
      ["Signups last 7 days", v("users.signups.last7d")],
      ["Signups last 30 days", v("users.signups.last30d")],
      ["Active users", v("users.active")],
      ["Suspended users", v("users.suspended")],
      ...listingRows,
      ["Listing moderation queue", v("listings.moderationQueue")],
      ...(["mercury", "jupiter", "venus"] as const).map((t) => [`Memberships — ${TIER_LABEL[t]}`, tiersPending ? NA : (byTier[t] ?? 0)]),
      ["Leads last 30 days", v("leads.last30d")],
      // Unit of mrr isn't documented (rupees vs paise) — exported as the raw value.
      ["MRR (raw value)", v("mrr")],
      ["Open abuse reports", v("abuse.open")],
      ["Abuse SLA breaches", v("abuse.slaBreached")],
      ["KYC queue", v("queues.kyc")],
      ["Ads queue", v("queues.ads")],
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
        <StatCard label="Signups (30d)" value={dashValue(data, "users.signups.last30d")} loading={isLoading} />
        <StatCard label="Active users" value={dashValue(data, "users.active")} loading={isLoading} />
        <StatCard label="MRR" value={dashValue(data, "mrr")} prefix="₹" loading={isLoading} />
        <StatCard label="Leads (30d)" value={dashValue(data, "leads.last30d")} loading={isLoading} />
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
            ["Open abuse reports", dashValue(data, "abuse.open")],
            ["Abuse SLA breaches", dashValue(data, "abuse.slaBreached")],
            ["Listing queue", dashValue(data, "listings.moderationQueue")],
            ["Ad queue", dashValue(data, "queues.ads")],
          ].map(([label, value]) => (
            <div key={label as string} className="bg-brand-tertiary/40 p-3">
              <dt className="text-[10px] uppercase tracking-wide text-brand-secondary/55">{label}</dt>
              <dd className="mt-1 font-serif text-xl font-bold text-brand-secondary">
                {isLoading ? "…" : value == null ? <span className="font-sans text-sm text-brand-muted-foreground">Not available yet</span> : formatCount(value as number)}
              </dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  )
}
