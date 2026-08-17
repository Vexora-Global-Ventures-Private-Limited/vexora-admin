"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { ScrollText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { DataTable, type DataTableColumn } from "@/components/admin/data-table"
import { FilterBar } from "@/components/admin/filter-bar"
import { StatusPill } from "@/components/admin/status-pill"
import { TotpStepUpDialog } from "@/components/admin/totp-step-up-dialog"
import { useStepUp } from "@/lib/use-step-up"
import { useAdminDataStore } from "@/lib/admin-data-store"
import type { PaymentLogEntry } from "@/lib/admin-data"
import { ROUTES } from "@/lib/routes"

const STATUSES: PaymentLogEntry["status"][] = ["captured", "refunded", "failed"]

export default function PaymentsPage() {
  const log = useAdminDataStore((s) => s.paymentLog)
  const addRefundNote = useAdminDataStore((s) => s.addRefundNote)
  const [notingId, setNotingId] = useState<string | null>(null)
  const [note, setNote] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const stepUp = useStepUp()

  const filtered = useMemo(
    () => log.filter((p) => statusFilter === "all" || p.status === statusFilter),
    [log, statusFilter],
  )

  const confirmNote = () => {
    if (!notingId) return
    const id = notingId
    const noteText = note
    // Close this dialog immediately — step-up (if stale) opens its own modal
    // next, rather than stacking on top of this one.
    setNotingId(null)
    setNote("")
    stepUp.run(() => {
      addRefundNote(id, noteText)
      toast.success(`Refund note added to ${id}`, { description: "No automated refund engine — this is a manual-only note (audit-logged)." })
    })
  }

  const columns: DataTableColumn<PaymentLogEntry>[] = [
    { key: "id", header: "Payment", sortable: true, sortValue: (p) => p.id, render: (p) => <span className="font-bold text-brand-primary-dark">{p.id}</span> },
    { key: "user", header: "User", sortable: true, sortValue: (p) => p.userName, render: (p) => p.userName },
    { key: "purpose", header: "Purpose", sortable: true, sortValue: (p) => p.purpose, render: (p) => p.purpose },
    { key: "amount", header: "Amount", sortable: true, sortValue: (p) => Number(p.amount.replace(/[₹,]/g, "")), render: (p) => <span className="font-bold">{p.amount}</span> },
    { key: "ref", header: "Razorpay ref", render: (p) => <code className="text-[11px]">{p.razorpayRef}</code> },
    { key: "status", header: "Status", sortable: true, sortValue: (p) => p.status, render: (p) => <StatusPill tone={p.status === "captured" ? "success" : p.status === "refunded" ? "info" : "danger"}>{p.status}</StatusPill> },
    { key: "createdAt", header: "Date", sortable: true, sortValue: (p) => p.createdAt, render: (p) => <span className="text-brand-secondary/55">{p.createdAt}</span> },
    {
      key: "actions", header: "Refund note", render: (p) =>
        p.refundNote ? (
          <span className="text-xs text-brand-secondary/65">{p.refundNote}</span>
        ) : (
          <Button size="sm" variant="outline" onClick={() => setNotingId(p.id)}>Add note</Button>
        ),
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-brand-secondary/60">All payments — manual-only refund notes, no automated refund engine (BRD §6.2).</p>
        <Link href={ROUTES.audit} className="flex items-center gap-1.5 text-xs font-semibold text-brand-primary-dark hover:underline">
          <ScrollText className="h-3.5 w-3.5" /> View audit log →
        </Link>
      </div>
      <FilterBar
        filters={[{ key: "status", label: "Status", value: statusFilter, onChange: setStatusFilter, options: STATUSES.map((s) => ({ label: s, value: s })) }]}
      />
      <DataTable columns={columns} rows={filtered} rowKey={(p) => p.id} defaultSortKey="createdAt" defaultSortDirection="desc" />

      <Dialog open={!!notingId} onOpenChange={(o) => !o && setNotingId(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl">Add refund note</DialogTitle>
            <DialogDescription>This records intent only — no funds are moved automatically.</DialogDescription>
          </DialogHeader>
          <Textarea
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Goodwill refund approved by finance — processed manually via Razorpay dashboard."
            aria-label="Refund note"
          />
          <Button className="btn-gold w-full" onClick={confirmNote}>Save note</Button>
        </DialogContent>
      </Dialog>

      <TotpStepUpDialog {...stepUp} />
    </div>
  )
}
