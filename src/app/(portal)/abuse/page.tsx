"use client"

import { useMemo, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DataTable, type DataTableColumn } from "@/components/admin/data-table"
import { FilterBar } from "@/components/admin/filter-bar"
import { StatusPill } from "@/components/admin/status-pill"
import { TotpStepUpDialog } from "@/components/admin/totp-step-up-dialog"
import { useStepUp } from "@/lib/use-step-up"
import { useAdminDataStore } from "@/lib/admin-data-store"
import type { AbuseReport } from "@/lib/admin-data"

const RESOLUTIONS: NonNullable<AbuseReport["resolution"]>[] = ["none", "warning", "hide", "remove", "suspend"]
const STATUSES: AbuseReport["status"][] = ["open", "resolved"]
const ENTITY_TYPES: AbuseReport["entityType"][] = ["listing", "user", "ad"]

export default function AbusePage() {
  const reports = useAdminDataStore((s) => s.abuseReports)
  const resolveAbuseReport = useAdminDataStore((s) => s.resolveAbuseReport)
  const [resolvingId, setResolvingId] = useState<string | null>(null)
  const [resolution, setResolution] = useState<AbuseReport["resolution"]>("warning")
  const [statusFilter, setStatusFilter] = useState("all")
  const [entityFilter, setEntityFilter] = useState("all")
  const stepUp = useStepUp()

  const filtered = useMemo(
    () =>
      reports
        .filter((r) => statusFilter === "all" || r.status === statusFilter)
        .filter((r) => entityFilter === "all" || r.entityType === entityFilter),
    [reports, statusFilter, entityFilter],
  )

  const confirmResolve = () => {
    if (!resolvingId) return
    const id = resolvingId
    const chosenResolution = resolution!
    // Close this dialog immediately — step-up (if stale) opens its own modal
    // next, rather than stacking on top of this one.
    setResolvingId(null)
    stepUp.run(() => {
      resolveAbuseReport(id, chosenResolution)
      toast.success(`${id} resolved`, { description: `Action recorded: ${chosenResolution} (audit-logged).` })
    })
  }

  const columns: DataTableColumn<AbuseReport>[] = [
    { key: "entity", header: "Entity", sortable: true, sortValue: (r) => r.entityLabel, render: (r) => <span className="font-bold text-brand-secondary">{r.entityLabel}</span> },
    { key: "reason", header: "Reason", sortable: true, sortValue: (r) => r.reason, render: (r) => <span className="text-brand-secondary/65">{r.reason}</span> },
    { key: "reportedBy", header: "Source", render: (r) => r.reportedBy },
    { key: "slaDue", header: "SLA due", sortable: true, sortValue: (r) => r.slaDueAt, render: (r) => <span className="text-brand-secondary/55">{r.slaDueAt}</span> },
    {
      key: "status", header: "Status", sortable: true, sortValue: (r) => r.status, render: (r) => (
        <StatusPill tone={r.status === "resolved" ? "success" : "danger"}>
          {r.status === "resolved" ? `resolved · ${r.resolution}` : "open"}
        </StatusPill>
      ),
    },
    {
      key: "actions", header: "Actions", render: (r) =>
        r.status === "open" ? (
          <Button size="sm" onClick={() => { setResolvingId(r.id); setResolution("warning") }}>Resolve</Button>
        ) : null,
    },
  ]

  return (
    <div className="space-y-4">
      <p className="text-sm text-brand-secondary/60">48h SLA queue — resolutions execute transactionally (BR-83, BR-06).</p>
      <FilterBar
        filters={[
          { key: "status", label: "Status", value: statusFilter, onChange: setStatusFilter, options: STATUSES.map((s) => ({ label: s, value: s })) },
          { key: "entityType", label: "Entity", value: entityFilter, onChange: setEntityFilter, options: ENTITY_TYPES.map((e) => ({ label: e, value: e })) },
        ]}
      />
      <DataTable columns={columns} rows={filtered} rowKey={(r) => r.id} defaultSortKey="slaDue" defaultSortDirection="asc" />

      <Dialog open={!!resolvingId} onOpenChange={(o) => !o && setResolvingId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl">Resolve report</DialogTitle>
            <DialogDescription>Choose a resolution action — this is step-up gated.</DialogDescription>
          </DialogHeader>
          <Select value={resolution} onValueChange={(v) => setResolution(v as AbuseReport["resolution"])}>
            <SelectTrigger className="w-full" aria-label="Resolution action"><SelectValue /></SelectTrigger>
            <SelectContent>
              {RESOLUTIONS.map((r) => (
                <SelectItem key={r} value={r!}>{r}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button className="btn-gold w-full" onClick={confirmResolve}>Confirm resolution</Button>
        </DialogContent>
      </Dialog>

      <TotpStepUpDialog {...stepUp} />
    </div>
  )
}
