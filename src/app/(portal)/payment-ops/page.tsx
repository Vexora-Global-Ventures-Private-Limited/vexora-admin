"use client"

import { useMemo, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { DataTable, type DataTableColumn } from "@/components/admin/data-table"
import { FilterBar } from "@/components/admin/filter-bar"
import { StatusPill } from "@/components/admin/status-pill"
import { TotpStepUpDialog } from "@/components/admin/totp-step-up-dialog"
import { useStepUp } from "@/lib/use-step-up"
import { useAdminDataStore } from "@/lib/admin-data-store"
import type { StuckOrder } from "@/lib/admin-data"

const STATUSES: StuckOrder["status"][] = ["processing", "failed"]

export default function PaymentOpsPage() {
  const orders = useAdminDataStore((s) => s.stuckOrders)
  const manualActivateOrder = useAdminDataStore((s) => s.manualActivateOrder)
  const [statusFilter, setStatusFilter] = useState("all")
  const stepUp = useStepUp()

  const filtered = useMemo(
    () => orders.filter((o) => statusFilter === "all" || o.status === statusFilter),
    [orders, statusFilter],
  )

  const activate = (id: string) =>
    stepUp.run(() => {
      manualActivateOrder(id)
      toast.success(`${id} manually activated`, {
        description: "Audit-logged. (In production this runs the same activation service as the Razorpay webhook: receipts, referral rewards, lead release.)",
      })
    })

  const columns: DataTableColumn<StuckOrder>[] = [
    { key: "id", header: "Order", sortable: true, sortValue: (o) => o.id, render: (o) => <span className="font-bold text-brand-primary-dark">{o.id}</span> },
    {
      key: "user", header: "User", sortable: true, sortValue: (o) => o.userName, render: (o) => (
        <div>
          <div className="text-xs font-bold text-brand-secondary">{o.userName}</div>
          <div className="text-[10px] text-brand-secondary/55">{o.userEmail}</div>
        </div>
      ),
    },
    { key: "plan", header: "Plan", render: (o) => o.plan },
    { key: "amount", header: "Amount", render: (o) => <span className="font-bold">{o.amount}</span> },
    { key: "ref", header: "Razorpay ref", render: (o) => <code className="text-[11px]">{o.razorpayRef}</code> },
    { key: "status", header: "Status", sortable: true, sortValue: (o) => o.status, render: (o) => <StatusPill tone={o.status === "failed" ? "danger" : "warning"}>{o.status}</StatusPill> },
    { key: "stuck", header: "Stuck for", sortable: true, sortValue: (o) => o.minutesStuck, render: (o) => `${o.minutesStuck} min · since ${o.stuckSince}` },
    {
      key: "actions", header: "Actions", render: (o) => (
        <Button size="sm" onClick={() => activate(o.id)} className="btn-gold">Manual activate</Button>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <p className="text-sm text-brand-secondary/60">
        Orders stuck in <code>processing</code>/<code>failed</code> for more than 10 minutes with a Razorpay reference (BR-33).
      </p>
      <FilterBar
        filters={[{ key: "status", label: "Status", value: statusFilter, onChange: setStatusFilter, options: STATUSES.map((s) => ({ label: s, value: s })) }]}
      />
      <DataTable
        columns={columns}
        rows={filtered}
        rowKey={(o) => o.id}
        emptyLabel="No stuck orders — payment ops queue is clear."
        defaultSortKey="stuck"
        defaultSortDirection="desc"
      />
      <TotpStepUpDialog {...stepUp} />
    </div>
  )
}
