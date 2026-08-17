"use client"

import { useMemo, useState } from "react"
import { DataTable, type DataTableColumn } from "@/components/admin/data-table"
import { FilterBar } from "@/components/admin/filter-bar"
import { useAdminDataStore } from "@/lib/admin-data-store"
import type { AuditLogEntry } from "@/lib/admin-data"

export default function AuditPage() {
  const auditLog = useAdminDataStore((s) => s.auditLog)
  const [entityFilter, setEntityFilter] = useState("all")
  const [adminFilter, setAdminFilter] = useState("all")

  const entityTypes = useMemo(() => Array.from(new Set(auditLog.map((a) => a.entityType))).sort(), [auditLog])
  const adminNames = useMemo(() => Array.from(new Set(auditLog.map((a) => a.adminName))).sort(), [auditLog])

  const filtered = useMemo(
    () =>
      auditLog
        .filter((a) => entityFilter === "all" || a.entityType === entityFilter)
        .filter((a) => adminFilter === "all" || a.adminName === adminFilter),
    [auditLog, entityFilter, adminFilter],
  )

  const columns: DataTableColumn<AuditLogEntry>[] = [
    { key: "id", header: "#", sortable: true, sortValue: (a) => a.id, render: (a) => <span className="text-brand-secondary/55">{a.id}</span> },
    { key: "admin", header: "Admin", sortable: true, sortValue: (a) => a.adminName, render: (a) => <span className="font-bold text-brand-secondary">{a.adminName}</span> },
    { key: "action", header: "Action", sortable: true, sortValue: (a) => a.action, render: (a) => <code className="text-[11px] text-brand-primary-dark">{a.action}</code> },
    { key: "entity", header: "Entity", sortable: true, sortValue: (a) => a.entityType, render: (a) => `${a.entityType} · ${a.entityId}` },
    { key: "ip", header: "IP", render: (a) => <span className="text-brand-secondary/55">{a.ip}</span> },
    { key: "createdAt", header: "When", sortable: true, sortValue: (a) => a.createdAt, render: (a) => <span className="text-brand-secondary/55">{a.createdAt}</span> },
  ]

  return (
    <div className="space-y-4">
      <p className="text-sm text-brand-secondary/60">
        Append-only mutation trail — every admin write lands here in the same transaction (NFR-08). Read-only.
      </p>
      <FilterBar
        filters={[
          { key: "entityType", label: "Entity", value: entityFilter, onChange: setEntityFilter, options: entityTypes.map((e) => ({ label: e, value: e })) },
          { key: "admin", label: "Admin", value: adminFilter, onChange: setAdminFilter, options: adminNames.map((n) => ({ label: n, value: n })) },
        ]}
      />
      <DataTable columns={columns} rows={filtered} rowKey={(a) => String(a.id)} defaultSortKey="createdAt" defaultSortDirection="desc" />
    </div>
  )
}
