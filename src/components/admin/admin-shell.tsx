"use client"

import type { ReactNode } from "react"
import type { LucideIcon } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { LogOut, ShieldCheck } from "lucide-react"
import { ThemeToggle } from "@/components/admin/theme-toggle"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar"
import { ADMIN_ROLE_NAME, type AdminRole, type AdminUser } from "@/lib/admin-session"

export type AdminNavItem = {
  id: string
  label: string
  icon: LucideIcon
  href: string
  badge?: string | number
  /** Roles allowed to see this item (super_admin always can). Omit = every admin. */
  roles?: AdminRole[]
}

/** Nav link that collapses the mobile sidebar (Sheet) on selection — desktop
 *  icon-collapse behavior is unaffected since setOpenMobile only matters on mobile. */
function NavLink({ item, isActive }: { item: AdminNavItem; isActive: boolean }) {
  const { isMobile, setOpenMobile } = useSidebar()
  return (
    <SidebarMenuButton asChild isActive={isActive} tooltip={item.label}>
      <Link href={item.href} onClick={() => isMobile && setOpenMobile(false)}>
        <item.icon aria-hidden className="h-4 w-4" />
        <span>{item.label}</span>
      </Link>
    </SidebarMenuButton>
  )
}

type AdminShellProps = {
  navItems: AdminNavItem[]
  /** Which nav item is current — the layout decides (e.g. /audit belongs to "Payments & audit"). */
  activeId?: string
  user: AdminUser
  onSignOut: () => void
  topbarTitle: string
  topbarSubtitle?: ReactNode
  children: ReactNode
}

/** Sidebar + topbar chrome for the (portal) route group — mirrors VXP's
 *  DashboardShell, but navigates real routes (Link) instead of a `?tab=`
 *  query param, matching the docs' apps/admin route tree (07-Frontend.md §2.2). */
export function AdminShell({ navItems, activeId, user, onSignOut, topbarTitle, topbarSubtitle, children }: AdminShellProps) {
  const pathname = usePathname()

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon" className="border-brand-border">
        <SidebarHeader>
          <div className="flex items-center gap-2.5 px-1 py-1">
            <div className="grid h-9 w-9 shrink-0 place-items-center bg-gradient-to-br from-brand-primary via-brand-primary to-brand-primary-dark shadow-[var(--shadow-royal-sm)]">
              <ShieldCheck className="h-4.5 w-4.5 text-brand-secondary" />
            </div>
            <div className="min-w-0 group-data-[collapsible=icon]:hidden">
              <div className="truncate font-serif text-base font-bold text-brand-secondary">VXA</div>
              <div className="truncate text-[10px] uppercase tracking-[0.18em] text-brand-primary-dark">
                Vexora Admin
              </div>
            </div>
          </div>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup role="navigation" aria-label="Admin sections">
            <SidebarGroupContent>
              <SidebarMenu>
                {navItems.map((item) => (
                  <SidebarMenuItem key={item.id}>
                    <NavLink item={item} isActive={activeId ? activeId === item.id : pathname.startsWith(item.href)} />
                    {item.badge != null && (
                      <SidebarMenuBadge aria-label={`${item.badge} pending`}>{item.badge}</SidebarMenuBadge>
                    )}
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter>
          <div className="flex items-center gap-2.5 px-2 py-2 group-data-[collapsible=icon]:hidden">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-ink-black to-brand-secondary text-[10px] font-bold text-brand-primary">
              {user.initials}
            </div>
            <div className="min-w-0" title={user.email}>
              <div className="truncate text-xs font-bold text-brand-secondary">{user.name}</div>
              <div className="truncate text-[10px] text-brand-secondary/55">{ADMIN_ROLE_NAME[user.role]}</div>
            </div>
          </div>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton onClick={onSignOut} tooltip={`Sign out ${user.email}`}>
                <LogOut aria-hidden className="h-4 w-4" />
                <span>Sign out</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset>
        <header className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-brand-border bg-card/90 px-4 py-3 backdrop-blur-xl sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <SidebarTrigger className="text-brand-secondary" />
            <div className="min-w-0">
              <h1 className="truncate font-serif text-lg font-bold capitalize text-brand-secondary sm:text-xl">
                {topbarTitle}
              </h1>
              {topbarSubtitle && (
                <p className="truncate text-xs text-brand-muted-foreground">{topbarSubtitle}</p>
              )}
            </div>
          </div>
          <ThemeToggle />
        </header>

        <div className="p-4 sm:p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  )
}
