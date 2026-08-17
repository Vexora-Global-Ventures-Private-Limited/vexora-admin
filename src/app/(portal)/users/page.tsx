"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { Search } from "lucide-react"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { DataTable, type DataTableColumn } from "@/components/admin/data-table"
import { FilterBar } from "@/components/admin/filter-bar"
import { StatusPill } from "@/components/admin/status-pill"
import { TotpStepUpDialog } from "@/components/admin/totp-step-up-dialog"
import { useStepUp } from "@/lib/use-step-up"
import { useAdminDataStore } from "@/lib/admin-data-store"
import type { AdminManagedUser, Tier } from "@/lib/admin-data"
import { ROUTES } from "@/lib/routes"

const TIERS: Tier[] = ["Free", "Mercury", "Jupiter", "Venus"]
const STATUSES: AdminManagedUser["status"][] = ["Active", "Pending", "Suspended"]

export default function UsersPage() {
  const users = useAdminDataStore((s) => s.users)
  const toggleUserStatus = useAdminDataStore((s) => s.toggleUserStatus)
  const [query, setQuery] = useState("")
  const [tierFilter, setTierFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const stepUp = useStepUp()

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return users
      .filter((u) => !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || u.id.toLowerCase().includes(q))
      .filter((u) => tierFilter === "all" || u.tier === tierFilter)
      .filter((u) => statusFilter === "all" || u.status === statusFilter)
  }, [users, query, tierFilter, statusFilter])

  const confirmToggle = (user: AdminManagedUser) => {
    const suspending = user.status !== "Suspended"
    stepUp.run(() => {
      toggleUserStatus(user.id)
      toast[suspending ? "warning" : "success"](suspending ? "User suspended" : "User reinstated", {
        description: "Mirrors the production session-revocation path (audit-logged).",
      })
    })
  }

  const columns: DataTableColumn<AdminManagedUser>[] = [
    {
      key: "user", header: "User", sortable: true, sortValue: (u) => u.name, render: (u) => (
        <Link href={ROUTES.userDetail(u.id)} className="hover:underline">
          <div className="text-xs font-bold text-brand-secondary">{u.name}</div>
          <div className="text-[10px] text-brand-secondary/55">{u.id}</div>
        </Link>
      ),
    },
    { key: "email", header: "Email", sortable: true, sortValue: (u) => u.email, render: (u) => <span className="text-brand-secondary/65">{u.email}</span> },
    { key: "tier", header: "Tier", sortable: true, sortValue: (u) => TIERS.indexOf(u.tier), render: (u) => <span className="rounded-full bg-brand-tertiary px-2 py-0.5 text-[10px] font-bold text-brand-primary-dark">{u.tier}</span> },
    { key: "listings", header: "Listings", sortable: true, sortValue: (u) => u.listings, render: (u) => u.listings },
    { key: "leads", header: "Leads", sortable: true, sortValue: (u) => u.leads, render: (u) => u.leads },
    { key: "reports", header: "Reports", sortable: true, sortValue: (u) => u.reports, render: (u) => (u.reports > 0 ? <span className="font-bold text-red-600">{u.reports}</span> : "0") },
    { key: "joinedAt", header: "Joined", sortable: true, sortValue: (u) => u.joinedAt, render: (u) => <span className="text-brand-secondary/55">{u.joinedAt}</span> },
    {
      key: "status", header: "Status", sortable: true, sortValue: (u) => u.status, render: (u) => (
        <StatusPill tone={u.status === "Active" ? "success" : u.status === "Pending" ? "warning" : "danger"}>{u.status}</StatusPill>
      ),
    },
    {
      key: "actions", header: "Actions", render: (u) => (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button size="sm" variant="outline">{u.status === "Suspended" ? "Reinstate" : "Suspend"}</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{u.status === "Suspended" ? "Reinstate this user?" : "Suspend this user?"}</AlertDialogTitle>
              <AlertDialogDescription>
                {u.status === "Suspended"
                  ? "Their sessions and listing visibility are restored."
                  : "Their sessions are revoked and listings hidden where applicable."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => confirmToggle(u)}>Confirm</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative max-w-sm flex-1 min-w-[220px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-secondary/40" />
          <Input
            aria-label="Search users"
            placeholder="Search by name, email or ID…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <FilterBar
          filters={[
            { key: "tier", label: "Tier", value: tierFilter, onChange: setTierFilter, options: TIERS.map((t) => ({ label: t, value: t })) },
            { key: "status", label: "Status", value: statusFilter, onChange: setStatusFilter, options: STATUSES.map((s) => ({ label: s, value: s })) },
          ]}
        />
      </div>
      <DataTable columns={columns} rows={filtered} rowKey={(u) => u.id} defaultSortKey="joinedAt" defaultSortDirection="desc" />
      <TotpStepUpDialog {...stepUp} />
    </div>
  )
}
