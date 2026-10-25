"use client"

import { usePathname } from "next/navigation"
import {
  LayoutDashboard, Users, Wallet, Building2, BadgeCheck,
  Megaphone, SlidersHorizontal, ShieldAlert, Receipt, BarChart3,
  MessageSquareText,
} from "lucide-react"
import { AdminShell, type AdminNavItem } from "@/components/admin/admin-shell"
import { useAdminGuard } from "@/lib/use-admin-guard"
import { useAdminAuth } from "@/hooks/use-admin-auth"
import { useGetDashboardQuery } from "@/store/api/adminApi"
import { ROUTES } from "@/lib/routes"

const NAV_ITEMS: AdminNavItem[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, href: ROUTES.dashboard },
  { id: "users", label: "Users", icon: Users, href: ROUTES.users },
  { id: "payment-ops", label: "Payment ops", icon: Wallet, href: ROUTES.paymentOps },
  { id: "listings", label: "Listings", icon: Building2, href: ROUTES.listings },
  { id: "kyc", label: "KYC & badges", icon: BadgeCheck, href: ROUTES.kyc },
  { id: "ads", label: "Ad approval", icon: Megaphone, href: ROUTES.ads },
  { id: "templates", label: "Templates", icon: MessageSquareText, href: ROUTES.templates },
  { id: "reports", label: "Reports", icon: BarChart3, href: ROUTES.reports },
  { id: "config", label: "Platform config", icon: SlidersHorizontal, href: ROUTES.config },
  { id: "abuse", label: "Abuse queue", icon: ShieldAlert, href: ROUTES.abuse },
  { id: "payments", label: "Payments & audit", icon: Receipt, href: ROUTES.payments },
]

const TOPBAR_SUBTITLE: Record<string, string> = {
  dashboard: "Platform-wide health & pending approvals — G1",
  users: "Search, suspend & reinstate — G2",
  "payment-ops": "Stuck orders & manual activation — G3",
  listings: "Approve · reject · extend · remove — G4",
  kyc: "KYC review + Verified / Featured badges — G5",
  ads: "Creative review vs. slot specs — G6",
  templates: "Notification copy per event × channel, versioned — G7",
  reports: "Platform analytics & exportable summaries — G11",
  config: "Live-edit pricing & quotas — G8",
  abuse: "48h SLA resolution queue — G9",
  payments: "Payment log & audit trail — G10",
}

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const { ready, adminUser, elevated } = useAdminGuard()
  // Clears the real accessToken (localStorage), not just the cached
  // adminUser display state — the raw zustand store's logout() alone would
  // leave a still-valid 8h bearer token sitting in localStorage after
  // "Sign out" (no server-side revoke exists for it either — admin_auth.json
  // has no logout endpoint, so the token would keep working until it
  // naturally expires).
  const { logout } = useAdminAuth()
  const pathname = usePathname()
  // Real queue depths for the sidebar badges — the same cached query the
  // dashboard reads, polled while the tab is focused. Skipped until the
  // session is elevated so it never fires a request without a token.
  const { data: dashboard } = useGetDashboardQuery(undefined, {
    skip: !ready || !elevated,
    pollingInterval: 60_000,
    skipPollingIfUnfocused: true,
  })

  const matchPath = pathname.startsWith(ROUTES.audit) ? ROUTES.payments : pathname
  const activeItem = NAV_ITEMS.slice().reverse().find((item) => matchPath.startsWith(item.href))
  const badges: Record<string, number> = {
    listings: dashboard?.listings.moderationQueue ?? 0,
    kyc: dashboard?.queues.kyc ?? 0,
    ads: dashboard?.queues.ads ?? 0,
    abuse: dashboard?.abuse.open ?? 0,
  }
  const navWithBadges = NAV_ITEMS.map((item) => ({ ...item, badge: badges[item.id] || undefined }))

  if (!ready || !elevated || !adminUser) return null

  return (
    <AdminShell
      navItems={navWithBadges}
      user={adminUser}
      onSignOut={logout}
      topbarTitle={activeItem?.label ?? "Dashboard"}
      topbarSubtitle={activeItem ? TOPBAR_SUBTITLE[activeItem.id] : undefined}
    >
      {children}
    </AdminShell>
  )
}
