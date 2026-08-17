"use client"

import { ConfigField } from "@/components/admin/config-field"
import { DataTable, type DataTableColumn } from "@/components/admin/data-table"
import { PaginationControls } from "@/components/admin/pagination-controls"
import { StatusPill } from "@/components/admin/status-pill"
import { usePagination } from "@/lib/use-pagination"
import { useAdminDataStore } from "@/lib/admin-data-store"
import type { MembershipPlanVersion } from "@/lib/admin-data"

const CONFIG_PAGE_SIZE = 5

export default function ConfigPage() {
  const platformConfig = useAdminDataStore((s) => s.platformConfig)
  const membershipPlanVersions = useAdminDataStore((s) => s.membershipPlanVersions)
  const { page, setPage, totalPages, start, pageRows } = usePagination(platformConfig, CONFIG_PAGE_SIZE)

  const planColumns: DataTableColumn<MembershipPlanVersion>[] = [
    { key: "tier", header: "Tier", render: (p) => <span className="rounded-full bg-brand-tertiary px-2 py-0.5 text-[10px] font-bold text-brand-primary-dark">{p.tier}</span> },
    { key: "version", header: "Version", render: (p) => `v${p.version}` },
    { key: "price", header: "Price", render: (p) => `₹${p.priceInr.toLocaleString()} / ${p.billingCycleMonths}mo` },
    { key: "effective", header: "Effective from", render: (p) => p.effectiveFrom },
    { key: "status", header: "Status", render: (p) => <StatusPill tone={p.isCurrent ? "success" : "neutral"}>{p.isCurrent ? "current" : "superseded"}</StatusPill> },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h2 className="mb-1 font-serif text-lg font-bold text-brand-secondary">Platform configuration</h2>
        <p className="mb-4 text-sm text-brand-secondary/60">
          Live-edit prices, quotas, validity days & thresholds — Redis-cached, no deploy needed. Writes require step-up (BR-82).
        </p>
        <div className="space-y-2.5">
          {pageRows.map((entry) => (
            <ConfigField key={entry.key} entry={entry} />
          ))}
        </div>
        {totalPages > 1 && (
          <div className="mt-2 border border-brand-border">
            <PaginationControls
              page={page}
              setPage={setPage}
              totalPages={totalPages}
              start={start}
              pageSize={CONFIG_PAGE_SIZE}
              totalRows={platformConfig.length}
            />
          </div>
        )}
      </div>

      <div>
        <h2 className="mb-1 font-serif text-lg font-bold text-brand-secondary">Membership plan versions</h2>
        <p className="mb-3 text-sm text-brand-secondary/60">Price changes create a new version row — never mutate one in place.</p>
        <DataTable columns={planColumns} rows={membershipPlanVersions} rowKey={(p) => `${p.tier}-${p.version}`} />
      </div>
    </div>
  )
}
