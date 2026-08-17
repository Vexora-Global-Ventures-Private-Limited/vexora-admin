"use client"

import { useMemo } from "react"
import { Download, FileSpreadsheet } from "lucide-react"
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts"
import { Button } from "@/components/ui/button"
import { StatCard } from "@/components/admin/stat-card"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { useAdminDataStore } from "@/lib/admin-data-store"
import { dashboardKpis, signupsTrend, revenueTrend } from "@/lib/admin-data"

const MONTH_LABEL = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
function monthLabel(month: string) {
  return MONTH_LABEL[Number(month.split("-")[1]) - 1]
}

const LISTING_STATUS_LABEL: Record<string, string> = {
  pending_review: "Pending review",
  live: "Live",
  rejected: "Rejected",
  removed: "Removed",
}
const LISTING_STATUSES = ["pending_review", "live", "rejected", "removed"] as const

const SIGNUPS_CONFIG: ChartConfig = { value: { label: "Signups", color: "var(--brand-primary-dark)" } }
const REVENUE_CONFIG: ChartConfig = { value: { label: "MRR (₹)", color: "var(--semantic-info)" } }
const LISTINGS_CONFIG: ChartConfig = { count: { label: "Listings", color: "var(--brand-primary-dark)" } }

function downloadCsv(filename: string, rows: (string | number)[][]) {
  const csv = rows.map((r) => r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n")
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

/** Turns a row array into a CSV table given an explicit column list — one
 *  helper shared by every per-entity report below, so adding a new
 *  downloadable report is just a new columns array + store selector. */
function toCsvTable<T>(items: T[], columns: { header: string; value: (item: T) => string | number }[]) {
  return [columns.map((c) => c.header), ...items.map((item) => columns.map((c) => c.value(item)))]
}

export default function ReportsPage() {
  const users = useAdminDataStore((s) => s.users)
  const listings = useAdminDataStore((s) => s.listings)
  const kyc = useAdminDataStore((s) => s.kyc)
  const badges = useAdminDataStore((s) => s.badges)
  const ads = useAdminDataStore((s) => s.ads)
  const stuckOrders = useAdminDataStore((s) => s.stuckOrders)
  const paymentLog = useAdminDataStore((s) => s.paymentLog)
  const platformConfig = useAdminDataStore((s) => s.platformConfig)
  const membershipPlanVersions = useAdminDataStore((s) => s.membershipPlanVersions)
  const abuseReports = useAdminDataStore((s) => s.abuseReports)
  const auditLog = useAdminDataStore((s) => s.auditLog)

  const signupsData = useMemo(() => signupsTrend.map((m) => ({ month: monthLabel(m.month), value: m.value })), [])
  const revenueData = useMemo(() => revenueTrend.map((m) => ({ month: monthLabel(m.month), value: m.value })), [])

  const listingsByStatus = useMemo(
    () => LISTING_STATUSES.map((status) => ({ status: LISTING_STATUS_LABEL[status], count: listings.filter((l) => l.status === status).length })),
    [listings],
  )

  const kycApprovalRate = useMemo(() => {
    const decided = kyc.filter((k) => k.status !== "pending")
    const approved = decided.filter((k) => k.status === "approved").length
    return decided.length ? Math.round((approved / decided.length) * 100) : 0
  }, [kyc])

  const abuseStats = useMemo(() => {
    const resolved = abuseReports.filter((r) => r.status === "resolved")
    const rate = abuseReports.length ? Math.round((resolved.length / abuseReports.length) * 100) : 0
    const withTimes = resolved.filter((r) => r.resolvedAt)
    const avgHours = withTimes.length
      ? withTimes.reduce((sum, r) => sum + (new Date(r.resolvedAt!).getTime() - new Date(r.reportedAt).getTime()) / 3_600_000, 0) / withTimes.length
      : 0
    return { rate, avgHours: Math.round(avgHours * 10) / 10 }
  }, [abuseReports])

  const exportSummary = () => {
    downloadCsv("vxa-report-summary.csv", [
      ["Metric", "Value"],
      ["Total signups", dashboardKpis.totalSignups],
      ["MRR (₹)", dashboardKpis.mrr],
      ["Leads (30d)", dashboardKpis.leadVolume30d],
      ["KYC approval rate (%)", kycApprovalRate],
      ["Abuse resolution rate (%)", abuseStats.rate],
      ["Avg abuse resolution time (h)", abuseStats.avgHours],
      [],
      ["Month", "Signups"],
      ...signupsTrend.map((m) => [m.month, m.value]),
      [],
      ["Month", "MRR (₹)"],
      ...revenueTrend.map((m) => [m.month, m.value]),
      [],
      ["Listing status", "Count"],
      ...listingsByStatus.map((l) => [l.status, l.count]),
    ])
  }

  // Every downloadable report — one entry per G-group's underlying data.
  // Add a new report by adding an entry here; nothing else needs to change.
  const reports = [
    {
      id: "summary",
      label: "Platform summary",
      description: "KPIs, monthly trends, and queue/resolution rates.",
      count: undefined,
      download: exportSummary,
    },
    {
      id: "users",
      label: "Users (G2)",
      description: "Every managed user — tier, activity, status.",
      count: users.length,
      download: () =>
        downloadCsv(
          "vxa-report-users.csv",
          toCsvTable(users, [
            { header: "ID", value: (u) => u.id },
            { header: "Name", value: (u) => u.name },
            { header: "Email", value: (u) => u.email },
            { header: "Tier", value: (u) => u.tier },
            { header: "Role", value: (u) => u.role },
            { header: "Listings", value: (u) => u.listings },
            { header: "Leads", value: (u) => u.leads },
            { header: "Payments", value: (u) => u.payments },
            { header: "Reports", value: (u) => u.reports },
            { header: "Status", value: (u) => u.status },
            { header: "Joined", value: (u) => u.joinedAt },
          ]),
        ),
    },
    {
      id: "listings",
      label: "Listings (G4)",
      description: "Moderation queue — status, submitter, validity.",
      count: listings.length,
      download: () =>
        downloadCsv(
          "vxa-report-listings.csv",
          toCsvTable(listings, [
            { header: "ID", value: (l) => l.id },
            { header: "Title", value: (l) => l.title },
            { header: "Location", value: (l) => l.location },
            { header: "Submitted by", value: (l) => l.submittedBy },
            { header: "Submitted at", value: (l) => l.submittedAt },
            { header: "Status", value: (l) => l.status },
            { header: "Rejection reason", value: (l) => l.rejectionReason ?? "" },
            { header: "Expires", value: (l) => l.expiresAt ?? "" },
          ]),
        ),
    },
    {
      id: "kyc",
      label: "KYC submissions (G5)",
      description: "Document review queue and outcomes.",
      count: kyc.length,
      download: () =>
        downloadCsv(
          "vxa-report-kyc.csv",
          toCsvTable(kyc, [
            { header: "ID", value: (k) => k.id },
            { header: "User", value: (k) => k.userName },
            { header: "Email", value: (k) => k.userEmail },
            { header: "Document", value: (k) => k.docType },
            { header: "Submitted at", value: (k) => k.submittedAt },
            { header: "Status", value: (k) => k.status },
            { header: "Rejection reason", value: (k) => k.rejectionReason ?? "" },
          ]),
        ),
    },
    {
      id: "badges",
      label: "Badges (G5)",
      description: "Jupiter Verified / Featured Developer grant queue.",
      count: badges.length,
      download: () =>
        downloadCsv(
          "vxa-report-badges.csv",
          toCsvTable(badges, [
            { header: "ID", value: (b) => b.id },
            { header: "Entity", value: (b) => b.entityName },
            { header: "Badge type", value: (b) => b.badgeType },
            { header: "Submitted at", value: (b) => b.submittedAt },
            { header: "Status", value: (b) => b.status },
          ]),
        ),
    },
    {
      id: "ads",
      label: "Ads (G6)",
      description: "Ad slot approval queue — payment + approval status.",
      count: ads.length,
      download: () =>
        downloadCsv(
          "vxa-report-ads.csv",
          toCsvTable(ads, [
            { header: "ID", value: (a) => a.id },
            { header: "Headline", value: (a) => a.headline },
            { header: "Advertiser", value: (a) => a.advertiser },
            { header: "Slot", value: (a) => a.slot },
            { header: "Amount", value: (a) => a.amount },
            { header: "Payment status", value: (a) => a.paymentStatus },
            { header: "Approval status", value: (a) => a.approvalStatus },
            { header: "Submitted at", value: (a) => a.submittedAt },
            { header: "Rejection reason", value: (a) => a.rejectionReason ?? "" },
          ]),
        ),
    },
    {
      id: "payment-ops",
      label: "Payment ops (G3)",
      description: "Stuck membership orders awaiting manual activation.",
      count: stuckOrders.length,
      download: () =>
        downloadCsv(
          "vxa-report-payment-ops.csv",
          toCsvTable(stuckOrders, [
            { header: "ID", value: (o) => o.id },
            { header: "User", value: (o) => o.userName },
            { header: "Email", value: (o) => o.userEmail },
            { header: "Plan", value: (o) => o.plan },
            { header: "Amount", value: (o) => o.amount },
            { header: "Razorpay ref", value: (o) => o.razorpayRef },
            { header: "Status", value: (o) => o.status },
            { header: "Stuck since", value: (o) => o.stuckSince },
            { header: "Minutes stuck", value: (o) => o.minutesStuck },
          ]),
        ),
    },
    {
      id: "payments",
      label: "Payments & refunds (G10)",
      description: "Full payment log with manual refund notes.",
      count: paymentLog.length,
      download: () =>
        downloadCsv(
          "vxa-report-payments.csv",
          toCsvTable(paymentLog, [
            { header: "ID", value: (p) => p.id },
            { header: "User", value: (p) => p.userName },
            { header: "Purpose", value: (p) => p.purpose },
            { header: "Amount", value: (p) => p.amount },
            { header: "Status", value: (p) => p.status },
            { header: "Razorpay ref", value: (p) => p.razorpayRef },
            { header: "Date", value: (p) => p.createdAt },
            { header: "Refund note", value: (p) => p.refundNote ?? "" },
          ]),
        ),
    },
    {
      id: "abuse",
      label: "Abuse reports (G9)",
      description: "48h-SLA abuse queue with resolutions.",
      count: abuseReports.length,
      download: () =>
        downloadCsv(
          "vxa-report-abuse.csv",
          toCsvTable(abuseReports, [
            { header: "ID", value: (r) => r.id },
            { header: "Entity type", value: (r) => r.entityType },
            { header: "Entity", value: (r) => r.entityLabel },
            { header: "Reason", value: (r) => r.reason },
            { header: "Reported by", value: (r) => r.reportedBy },
            { header: "Reported at", value: (r) => r.reportedAt },
            { header: "SLA due", value: (r) => r.slaDueAt },
            { header: "Status", value: (r) => r.status },
            { header: "Resolution", value: (r) => r.resolution ?? "" },
            { header: "Resolved at", value: (r) => r.resolvedAt ?? "" },
          ]),
        ),
    },
    {
      id: "config",
      label: "Platform config (G8)",
      description: "Current value of every typed config key.",
      count: platformConfig.length,
      download: () =>
        downloadCsv(
          "vxa-report-config.csv",
          toCsvTable(platformConfig, [
            { header: "Key", value: (c) => c.key },
            { header: "Label", value: (c) => c.label },
            { header: "Value", value: (c) => String(c.value) },
            { header: "Type", value: (c) => c.type },
            { header: "Description", value: (c) => c.description },
            { header: "Updated by", value: (c) => c.updatedBy },
            { header: "Updated at", value: (c) => c.updatedAt },
          ]),
        ),
    },
    {
      id: "membership-plans",
      label: "Membership plan versions (G8)",
      description: "Versioned pricing history per tier.",
      count: membershipPlanVersions.length,
      download: () =>
        downloadCsv(
          "vxa-report-membership-plans.csv",
          toCsvTable(membershipPlanVersions, [
            { header: "Tier", value: (p) => p.tier },
            { header: "Version", value: (p) => p.version },
            { header: "Price (₹)", value: (p) => p.priceInr },
            { header: "Billing cycle (months)", value: (p) => p.billingCycleMonths },
            { header: "Effective from", value: (p) => p.effectiveFrom },
            { header: "Current", value: (p) => (p.isCurrent ? "yes" : "no") },
          ]),
        ),
    },
    {
      id: "audit",
      label: "Audit log (G10)",
      description: "Append-only trail of every admin mutation this session.",
      count: auditLog.length,
      download: () =>
        downloadCsv(
          "vxa-report-audit-log.csv",
          toCsvTable(auditLog, [
            { header: "#", value: (a) => a.id },
            { header: "Admin", value: (a) => a.adminName },
            { header: "Action", value: (a) => a.action },
            { header: "Entity type", value: (a) => a.entityType },
            { header: "Entity ID", value: (a) => a.entityId },
            { header: "IP", value: (a) => a.ip },
            { header: "When", value: (a) => a.createdAt },
          ]),
        ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-brand-secondary/60">Platform-wide trends and resolution metrics, derived live from the current session's data.</p>
        <Button variant="outline" size="sm" onClick={exportSummary} className="gap-1.5">
          <Download className="h-3.5 w-3.5" /> Export summary
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total signups" value={dashboardKpis.totalSignups} />
        <StatCard label="MRR" value={dashboardKpis.mrr} prefix="₹" />
        <StatCard label="KYC approval rate" value={kycApprovalRate} suffix="%" />
        <StatCard label="Abuse resolution rate" value={abuseStats.rate} suffix="%" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="bg-card p-6 ring-1 ring-brand-border">
          <h2 className="mb-4 font-serif text-lg font-bold text-brand-secondary">Signups over time</h2>
          <ChartContainer config={SIGNUPS_CONFIG} className="h-64 w-full">
            <LineChart data={signupsData}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="month" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} width={40} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Line type="monotone" dataKey="value" stroke="var(--color-value)" strokeWidth={2} dot={false} />
            </LineChart>
          </ChartContainer>
        </div>

        <div className="bg-card p-6 ring-1 ring-brand-border">
          <h2 className="mb-4 font-serif text-lg font-bold text-brand-secondary">Revenue trend (MRR)</h2>
          <ChartContainer config={REVENUE_CONFIG} className="h-64 w-full">
            <LineChart data={revenueData}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="month" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} width={56} tickFormatter={(v) => `₹${Math.round(v / 1000)}k`} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Line type="monotone" dataKey="value" stroke="var(--color-value)" strokeWidth={2} dot={false} />
            </LineChart>
          </ChartContainer>
        </div>

        <div className="bg-card p-6 ring-1 ring-brand-border">
          <h2 className="mb-4 font-serif text-lg font-bold text-brand-secondary">Listings by status</h2>
          <ChartContainer config={LISTINGS_CONFIG} className="h-64 w-full">
            <BarChart data={listingsByStatus}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="status" tickLine={false} axisLine={false} interval={0} tick={{ fontSize: 11 }} />
              <YAxis tickLine={false} axisLine={false} width={32} allowDecimals={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="count" fill="var(--color-count)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </div>

        <div className="bg-card p-6 ring-1 ring-brand-border">
          <h2 className="mb-4 font-serif text-lg font-bold text-brand-secondary">Abuse queue resolution</h2>
          <div className="grid h-64 grid-cols-2 gap-3">
            <div className="flex flex-col justify-center bg-brand-tertiary/40 p-4 text-center">
              <div className="font-serif text-3xl font-bold text-brand-secondary">{abuseStats.rate}%</div>
              <div className="mt-1 text-[11px] uppercase tracking-wide text-brand-secondary/50">Resolved</div>
            </div>
            <div className="flex flex-col justify-center bg-brand-tertiary/40 p-4 text-center">
              <div className="font-serif text-3xl font-bold text-brand-secondary">{abuseStats.avgHours}h</div>
              <div className="mt-1 text-[11px] uppercase tracking-wide text-brand-secondary/50">Avg resolution time</div>
            </div>
          </div>
        </div>
      </div>

      <div>
        <h2 className="mb-1 font-serif text-lg font-bold text-brand-secondary">Downloadable reports</h2>
        <p className="mb-4 text-sm text-brand-secondary/60">One CSV per data domain — every G-group's current data, exportable independently.</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {reports.map((r) => (
            <div key={r.id} className="flex flex-col justify-between gap-3 bg-card p-4 ring-1 ring-brand-border">
              <div className="flex items-start gap-2.5">
                <span className="grid h-8 w-8 shrink-0 place-items-center bg-brand-primary/10 text-brand-primary-dark">
                  <FileSpreadsheet className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <div className="truncate text-sm font-bold text-brand-secondary">
                    {r.label}
                    {r.count != null && <span className="ml-1.5 font-normal text-brand-secondary/45">({r.count})</span>}
                  </div>
                  <div className="text-xs text-brand-secondary/55">{r.description}</div>
                </div>
              </div>
              <Button size="sm" variant="outline" onClick={r.download} className="w-full gap-1.5">
                <Download className="h-3.5 w-3.5" /> Download CSV
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
