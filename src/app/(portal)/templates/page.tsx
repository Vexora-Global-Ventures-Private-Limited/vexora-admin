"use client"

import { Suspense, useMemo, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { AlertTriangle, Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { DataTable, type DataTableColumn } from "@/components/admin/data-table"
import { FilterBar } from "@/components/admin/filter-bar"
import { StatusPill } from "@/components/admin/status-pill"
import { useGetTemplatesQuery, type TemplateEvent, type TemplateVersion } from "@/store/api/adminApi"
import { formatDateTime } from "@/components/admin/config/config-helpers"
import { CHANNEL_LABEL, channelLabel, needsWhatsappName } from "@/components/admin/templates/template-helpers"
import { ROUTES } from "@/lib/routes"
import { useSetUrlParams } from "@/components/admin/url-state"

type Row = { event: TemplateEvent; channel: string; template: TemplateVersion }

export default function TemplatesPage() {
  return (
    <Suspense fallback={null}>
      <TemplatesList />
    </Suspense>
  )
}

/**
 * G7 — every notification event × channel with its active template version.
 * Search and filters live in the URL, so coming back from the editor (or
 * sharing a link) keeps the same view.
 */
function TemplatesList() {
  const { data: events, isLoading, isError, refetch, isFetching } = useGetTemplatesQuery()
  const searchParams = useSearchParams()
  const setUrlParams = useSetUrlParams()
  const channelFilter = searchParams.get("channel") ?? "all"
  const domainFilter = searchParams.get("domain") ?? "all"
  // The text box is local so typing stays smooth; the URL follows it.
  const [query, setQueryState] = useState(() => searchParams.get("q") ?? "")
  const setQuery = (q: string) => {
    setQueryState(q)
    setUrlParams({ q: q.trim() || undefined })
  }
  const setChannelFilter = (v: string) => setUrlParams({ channel: v })
  const setDomainFilter = (v: string) => setUrlParams({ domain: v })

  const rows = useMemo<Row[]>(
    () =>
      (events ?? []).flatMap((event) =>
        // Skip empty channel slots defensively — a row needs a live template to edit.
        Object.entries(event.channels ?? {})
          .filter(([, template]) => !!template)
          .map(([channel, template]) => ({ event, channel, template })),
      ),
    [events],
  )
  const channels = Array.from(new Set(rows.map((r) => r.channel)))
  const domains = Array.from(new Set((events ?? []).map((e) => e.domain))).sort()
  const missingWhatsappNames = rows.filter((r) => needsWhatsappName(r.channel, r.template)).length

  const filtered = rows.filter((r) => {
    const q = query.trim().toLowerCase()
    return (
      (channelFilter === "all" || r.channel === channelFilter) &&
      (domainFilter === "all" || r.event.domain === domainFilter) &&
      (!q || r.event.eventKey.toLowerCase().includes(q) || (r.template.body ?? "").toLowerCase().includes(q))
    )
  })

  const columns: DataTableColumn<Row>[] = [
    {
      key: "event",
      header: "Event",
      sortable: true,
      sortValue: (r) => r.event.eventKey,
      render: (r) => (
        <Link href={ROUTES.templateDetail(r.event.eventKey, r.channel)} className="font-mono text-xs font-bold text-brand-secondary hover:underline">
          {r.event.eventKey}
        </Link>
      ),
    },
    {
      key: "channel",
      header: "Channel",
      sortable: true,
      sortValue: (r) => r.channel,
      render: (r) => (
        <span className="inline-flex items-center gap-1.5">
          <span className="rounded-full bg-brand-tertiary px-2 py-0.5 text-[10px] font-bold text-brand-primary-dark">{channelLabel(r.channel)}</span>
          {needsWhatsappName(r.channel, r.template) && (
            <span title="No approved WhatsApp template name — sends will fail" aria-label="Missing WhatsApp template name">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
            </span>
          )}
        </span>
      ),
    },
    {
      key: "variables",
      header: "Variables",
      render: (r) =>
        r.event.variables === null ? (
          <StatusPill tone="warning">not wired</StatusPill>
        ) : (
          <span className="font-mono text-[11px] text-brand-secondary/70">{r.event.variables.map((v) => `{{${v}}}`).join(" ") || "none"}</span>
        ),
    },
    { key: "version", header: "Version", sortable: true, sortValue: (r) => r.template.version, render: (r) => `v${r.template.version}` },
    {
      key: "updated",
      header: "Updated",
      sortable: true,
      sortValue: (r) => r.template.updatedAt,
      render: (r) => <span className="text-xs text-brand-secondary/55">{formatDateTime(r.template.updatedAt)}</span>,
    },
    {
      key: "body",
      header: "Body",
      render: (r) => <span className="line-clamp-2 max-w-xs break-words text-xs text-brand-secondary/65">{r.template.body || "—"}</span>,
    },
  ]

  return (
    <div className="space-y-4">
      <p className="text-sm text-brand-secondary/60">
        Every notification event × channel. Saving creates a new version and makes it live immediately; transactional events can&apos;t be
        switched off by users.
      </p>

      {missingWhatsappNames > 0 && (
        <div role="status" className="flex items-start gap-2 border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {missingWhatsappNames} WhatsApp template{missingWhatsappNames === 1 ? " has" : "s have"} no approved template name — WhatsApp
          messages for {missingWhatsappNames === 1 ? "it" : "them"} can&apos;t be delivered until one is set.
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative sm:max-w-xs sm:flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-brand-secondary/40" />
          <Input aria-label="Search templates" placeholder="Search event or body…" value={query} onChange={(e) => setQuery(e.target.value)} className="pl-8" />
        </div>
        <FilterBar
          filters={[
            { key: "domain", label: "Domain", value: domainFilter, onChange: setDomainFilter, options: domains.map((d) => ({ label: d, value: d })) },
            { key: "channel", label: "Channel", value: channelFilter, onChange: setChannelFilter, options: channels.map((c) => ({ label: CHANNEL_LABEL[c] ?? c, value: c })) },
          ]}
        />
      </div>

      {isLoading && <Skeleton className="h-64 w-full" aria-label="Loading templates" />}
      {isError && (
        <div role="alert" className="border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Couldn&apos;t load templates.{" "}
          <button onClick={() => refetch()} disabled={isFetching} className="font-semibold underline">Retry</button>
        </div>
      )}
      {events && (
        <DataTable
          columns={columns}
          rows={filtered}
          rowKey={(r) => `${r.event.eventKey}-${r.channel}`}
          pageSize={20}
          defaultSortKey="event"
          emptyLabel="No templates match these filters."
        />
      )}
    </div>
  )
}
