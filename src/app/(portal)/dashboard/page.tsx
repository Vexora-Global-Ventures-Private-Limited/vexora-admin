"use client"

import Link from "next/link"
import { Users, Building2, Wallet, TrendingUp, Building, BadgeCheck, Megaphone, ShieldAlert, AlertTriangle } from "lucide-react"
import { StatCard } from "@/components/admin/stat-card"
import { dashboardKpis } from "@/lib/admin-data"
import { useQueueCounts, useSlaBreachCount } from "@/lib/admin-data-store"
import { ROUTES } from "@/lib/routes"

export default function DashboardPage() {
  const activeListings = Object.values(dashboardKpis.activeListingsByTier).reduce((a, b) => a + b, 0)
  const queueCounts = useQueueCounts()
  const slaBreaches = useSlaBreachCount()

  const queues = [
    { label: "Listing approvals", count: queueCounts.listings, href: ROUTES.listings, icon: Building2 },
    { label: "KYC review", count: queueCounts.kyc, href: ROUTES.kyc, icon: BadgeCheck },
    { label: "Ad approvals", count: queueCounts.ads, href: ROUTES.ads, icon: Megaphone },
    { label: "Abuse reports", count: queueCounts.abuse, href: ROUTES.abuse, icon: ShieldAlert },
  ]

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatCard label="Total signups" value={dashboardKpis.totalSignups} icon={Users} />
        <StatCard label="Active listings" value={activeListings} icon={Building} />
        <StatCard label="MRR" value={dashboardKpis.mrr} prefix="₹" icon={Wallet} />
        <StatCard label="Leads (30d)" value={dashboardKpis.leadVolume30d} icon={TrendingUp} />
        <StatCard label="SLA breaches" value={slaBreaches} icon={AlertTriangle} />
        <StatCard
          label="Open queue items"
          value={queues.reduce((a, q) => a + q.count, 0)}
          icon={ShieldAlert}
        />
      </div>

      <div>
        <h2 className="mb-3 font-serif text-lg font-bold text-brand-secondary">Approval queues</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {queues.map((q) => (
            <Link
              key={q.label}
              href={q.href}
              className="card-sheen flex items-center justify-between border border-brand-border/80 bg-card p-5"
            >
              <div>
                <div className="text-2xl font-bold text-brand-secondary">{q.count}</div>
                <div className="text-xs text-brand-muted-foreground">{q.label}</div>
              </div>
              <span className="grid h-10 w-10 place-items-center bg-brand-primary/10 text-brand-primary-dark">
                <q.icon className="h-5 w-5" />
              </span>
            </Link>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {(Object.keys(dashboardKpis.activeListingsByTier) as Array<keyof typeof dashboardKpis.activeListingsByTier>).map((tier) => (
          <div key={tier} className="bg-card p-4 ring-1 ring-brand-border">
            <div className="text-[10px] uppercase tracking-wide text-brand-secondary/55">{tier} tier</div>
            <div className="mt-1 font-serif text-xl font-bold text-brand-secondary">
              {dashboardKpis.activeListingsByTier[tier]} listings
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
