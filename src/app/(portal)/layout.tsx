"use client"

import { usePathname } from "next/navigation"
import {
  LayoutDashboard, Users, Wallet, Building2, BadgeCheck,
  Megaphone, SlidersHorizontal, ShieldAlert, Receipt, BarChart3,
  // MessageSquareText, // templates nav icon — restore when templates is re-enabled
} from "lucide-react"
import { AdminShell, type AdminNavItem } from "@/components/admin/admin-shell"
import { useAdminGuard } from "@/lib/use-admin-guard"
import { useAdminSession } from "@/lib/admin-session"
import { useQueueCounts } from "@/lib/admin-data-store"
import { ROUTES } from "@/lib/routes"

const NAV_ITEMS: AdminNavItem[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, href: ROUTES.dashboard },
  { id: "users", label: "Users", icon: Users, href: ROUTES.users },
  { id: "payment-ops", label: "Payment ops", icon: Wallet, href: ROUTES.paymentOps },
  { id: "listings", label: "Listings", icon: Building2, href: ROUTES.listings },
  { id: "kyc", label: "KYC & badges", icon: BadgeCheck, href: ROUTES.kyc },
  { id: "ads", label: "Ad approval", icon: Megaphone, href: ROUTES.ads },
  // { id: "templates", label: "Templates", icon: MessageSquareText, href: ROUTES.templates }, // disabled for now
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
  // templates: "23 events × channel, versioned — G7", // disabled for now
  reports: "Platform analytics & exportable summaries — G11",
  config: "Live-edit pricing & quotas — G8",
  abuse: "48h SLA resolution queue — G9",
  payments: "Payment log, refund notes & audit trail — G10",
}

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const { ready, adminUser, elevated } = useAdminGuard()
  const logout = useAdminSession((s) => s.logout)
  const pathname = usePathname()
  const queueCounts = useQueueCounts()

  const matchPath = pathname.startsWith(ROUTES.audit) ? ROUTES.payments : pathname
  const activeItem = NAV_ITEMS.slice().reverse().find((item) => matchPath.startsWith(item.href))
  const badges: Record<string, number> = {
    listings: queueCounts.listings,
    kyc: queueCounts.kyc,
    ads: queueCounts.ads,
    abuse: queueCounts.abuse,
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
