"use client"

import { Suspense, useId, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { DataTable, type DataTableColumn } from "@/components/admin/data-table"
import { FilterBar } from "@/components/admin/filter-bar"
import { AuditDiff } from "@/components/admin/audit/audit-diff"
import { formatDateTime, istDayEnd, istDayStart, istToday } from "@/components/admin/dashboard/dashboard-utils"
import { parsePage, useSetUrlParams } from "@/components/admin/url-state"
import { useGetAuditLogQuery, type AuditEntry } from "@/store/api/adminApi"
import { useAdminSession } from "@/lib/admin-session"
import { getApiErrorCode, getApiErrorMessage } from "@/lib/api-error"

const PAGE_SIZE = 50
// Entity types / actions the backend's withAudit() was seen writing live
// (2026-10-25). Both filters are EXACT matches server-side ("user" finds 0,
// "user.suspend" finds them), so they're pickers, not free text. Any other
// value that shows up in the loaded entries is added to the pickers too, so
// a newly audited action never becomes unfilterable.
const KNOWN_ENTITY_TYPES = ["abuse_report", "ad", "ad_package", "amenity", "config", "listing", "location", "membership_plan", "user"]
const KNOWN_ACTIONS = [
  "abuse.resolve",
  "ad.approve",
  "ad.reject",
  "ad_package.create",
  "ad_package.deactivate",
  "ad_package.update",
  "amenity.create",
  "amenity.update",
  "config.delete",
  "config.update",
  "listing.approve",
  "listing.extend",
  "listing.reject",
  "listing.remove",
  "location.create",
  "location.update",
  "membership_plan.create",
  "membership_plan.deactivate",
  "membership_plan.update",
  "user.reinstate",
  "user.suspend",
]
const SAFE_VALUE = /^[a-z0-9_.]{1,60}$/
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export default function AuditPage() {
  return (
    <Suspense fallback={null}>
      <AuditLog />
    </Suspense>
  )
}

/**
 * GET /admin/audit-log — super_admin only (any other role gets a friendly
 * "no access" state). Filters use bracket syntax (filter[entityType] etc.),
 * which is correct for this one endpoint. The backend silently ignores a
 * malformed from/to, so dates are validated here before they're sent.
 */
function AuditLog() {
  const searchParams = useSearchParams()
  const setParams = useSetUrlParams()
  const me = useAdminSession((s) => s.adminUser)
  const isSuperAdmin = me?.role === "super_admin"
  const ids = useId()

  const entityParam = searchParams.get("entity") ?? ""
  const entityType = SAFE_VALUE.test(entityParam) ? entityParam : undefined
  const actionParam = searchParams.get("action") ?? ""
  const action = SAFE_VALUE.test(actionParam) ? actionParam : undefined
  const mine = searchParams.get("mine") === "1"
  const fromDate = searchParams.get("from") ?? ""
  const toDate = searchParams.get("to") ?? ""
  const page = parsePage(searchParams.get("page"))
  const today = istToday()

  const [draftFrom, setDraftFrom] = useState(fromDate)
  const [draftTo, setDraftTo] = useState(toDate)
  // Follow back/forward navigation into the date inputs.
  const [seenDates, setSeenDates] = useState(`${fromDate}|${toDate}`)
  if (`${fromDate}|${toDate}` !== seenDates) {
    setSeenDates(`${fromDate}|${toDate}`)
    setDraftFrom(fromDate)
    setDraftTo(toDate)
  }

  const dateError =
    (draftFrom && !DATE_RE.test(draftFrom)) || (draftTo && !DATE_RE.test(draftTo))
      ? "Use a valid date."
      : draftFrom && draftTo && draftFrom > draftTo
        ? "“From” must be on or before “To”."
        : (draftFrom && draftFrom > today) || (draftTo && draftTo > today)
          ? "Dates can't be in the future."
          : null

  // IST day bounds (the admin's day, matching the IST timestamps shown).
  // Only valid, ordered dates ever reach the API — it ignores bad ones silently.
  const validFrom = DATE_RE.test(fromDate) ? istDayStart(fromDate) : undefined
  const validTo = DATE_RE.test(toDate) ? istDayEnd(toDate) : undefined
  const rangeOk = !fromDate || !toDate || fromDate <= toDate

  const { data, isLoading, isFetching, isError, error, refetch } = useGetAuditLogQuery(
    {
      entityType,
      action,
      adminUserId: mine ? me?.id : undefined,
      from: rangeOk ? validFrom : undefined,
      to: rangeOk ? validTo : undefined,
      page,
      limit: PAGE_SIZE,
    },
    { skip: !isSuperAdmin },
  )

  if (!isSuperAdmin || getApiErrorCode(error) === "ADMIN_FORBIDDEN") {
    return (
      <div className="border border-brand-border bg-card p-8 text-center text-sm text-brand-muted-foreground">
        The audit log is visible to Super Admins only.
      </div>
    )
  }

  const entries = data?.entries ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const entityOptions = Array.from(new Set([...KNOWN_ENTITY_TYPES, ...entries.map((e) => e.entityType), ...(entityType ? [entityType] : [])])).sort()
  const actionOptions = Array.from(new Set([...KNOWN_ACTIONS, ...entries.map((e) => e.action), ...(action ? [action] : [])]))
    .filter((a) => !entityType || a.startsWith(`${entityType.replace(/_report$/, "")}.`) || a === action)
    .sort()
  const hasFilters = !!(action || fromDate || toDate || entityType || mine)
  const goToPage = (next: number) => {
    setParams({ page: next })
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const columns: DataTableColumn<AuditEntry>[] = [
    {
      key: "when",
      header: "When",
      render: (a) => <span className="whitespace-nowrap text-brand-secondary/60">{formatDateTime(a.createdAt)}</span>,
    },
    {
      key: "admin",
      header: "Admin",
      render: (a) =>
        a.adminUserId === me?.id ? (
          <span className="font-bold text-brand-secondary">You</span>
        ) : (
          // There's no admin directory endpoint, so other admins show by id.
          <span className="font-mono text-[10px] text-brand-secondary/60" title="Another admin (no admin directory API yet)">
            {a.adminUserId}
          </span>
        ),
    },
    { key: "action", header: "Action", render: (a) => <code className="text-[11px] text-brand-primary-dark">{a.action}</code> },
    {
      key: "entity",
      header: "Entity",
      render: (a) => (
        <div>
          <div className="text-xs font-semibold text-brand-secondary">{a.entityType}</div>
          <div className="font-mono text-[10px] text-brand-secondary/50">{a.entityId}</div>
        </div>
      ),
    },
    { key: "change", header: "Change", className: "min-w-[220px]", render: (a) => <AuditDiff before={a.before} after={a.after} /> },
    { key: "ip", header: "IP", render: (a) => <span className="text-brand-secondary/55">{a.ip ?? "—"}</span> },
  ]

  return (
    <div className="space-y-4">
      <p className="text-sm text-brand-secondary/60">
        Append-only trail — every sensitive admin write is recorded here automatically. Read-only.
      </p>

      <div className="flex flex-wrap items-end gap-2.5">
        <FilterBar
          filters={[
            {
              key: "entity",
              label: "Entity",
              value: entityType ?? "all",
              // A new entity narrows the action list, so drop an action that no longer fits.
              onChange: (v) => setParams({ entity: v, action: undefined, page: 1 }),
              options: entityOptions.map((e) => ({ label: e, value: e })),
            },
            {
              key: "action",
              label: "Action",
              value: action ?? "all",
              onChange: (v) => setParams({ action: v, page: 1 }),
              options: actionOptions.map((a) => ({ label: a, value: a })),
            },
            {
              key: "admin",
              label: "Admin",
              value: mine ? "mine" : "all",
              onChange: (v) => setParams({ mine: v === "mine" ? "1" : undefined, page: 1 }),
              options: [{ label: "Only my actions", value: "mine" }],
            },
          ]}
        />
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (dateError) return
            setParams({ from: draftFrom, to: draftTo, page: 1 })
          }}
        >
          <div>
            <label htmlFor={`${ids}-from`} className="block text-[10px] font-semibold uppercase tracking-wide text-brand-muted-foreground">
              From
            </label>
            <Input id={`${ids}-from`} type="date" value={draftFrom} max={draftTo || today} onChange={(e) => setDraftFrom(e.target.value)} className="h-8 w-40" aria-invalid={!!dateError} />
          </div>
          <div>
            <label htmlFor={`${ids}-to`} className="block text-[10px] font-semibold uppercase tracking-wide text-brand-muted-foreground">
              To
            </label>
            <Input id={`${ids}-to`} type="date" value={draftTo} min={draftFrom || undefined} max={today} onChange={(e) => setDraftTo(e.target.value)} className="h-8 w-40" aria-invalid={!!dateError} />
          </div>
          <Button type="submit" size="sm" disabled={!!dateError}>
            Apply dates
          </Button>
          {hasFilters && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setDraftFrom("")
                setDraftTo("")
                setParams({ entity: undefined, action: undefined, mine: undefined, from: undefined, to: undefined, page: 1 })
              }}
            >
              Clear
            </Button>
          )}
        </form>
      </div>
      {dateError && <p className="text-xs font-semibold text-red-600" role="alert">{dateError}</p>}
      <p className="text-[11px] text-brand-muted-foreground">Times and date filters are in IST.</p>

      {isError ? (
        <div className="border border-red-200 bg-card p-6 text-center text-sm">
          <p className="font-semibold text-red-700">Couldn&apos;t load the audit log.</p>
          <p className="mt-1 text-brand-muted-foreground">{getApiErrorMessage(error) ?? "Please try again."}</p>
          <Button className="mt-3" size="sm" variant="outline" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      ) : (
        <>
          <DataTable
            ariaLabel="Audit log"
            columns={columns}
            rows={entries}
            rowKey={(a) => a._id}
            loading={isLoading}
            pageSize={Math.max(entries.length, 1)}
            emptyLabel={hasFilters ? "No audit entries match these filters." : "No audit entries yet."}
          />
          {data && page > totalPages && total > 0 ? (
            <div className="text-center text-sm text-brand-muted-foreground">
              Nothing on page {page}.{" "}
              <button type="button" className="font-semibold text-brand-primary-dark underline" onClick={() => goToPage(1)}>
                Go to the newest entries
              </button>
            </div>
          ) : (totalPages > 1 || page > 1) && (
            <nav className="flex flex-wrap items-center justify-between gap-2 text-xs text-brand-muted-foreground" aria-label="Audit log pagination">
              <span>
                {total.toLocaleString("en-IN")} entries · page {page} of {totalPages}
                {isFetching ? " · updating…" : ""}
              </span>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" disabled={page <= 1 || isFetching} onClick={() => goToPage(page - 1)}>
                  Newer
                </Button>
                <Button size="sm" variant="outline" disabled={!data?.hasMore || isFetching} onClick={() => goToPage(page + 1)}>
                  Older
                </Button>
              </div>
            </nav>
          )}
        </>
      )}
    </div>
  )
}
