"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { ROUTES } from "@/lib/routes"

// Templates feature disabled for now — nav entry commented out in
// (portal)/layout.tsx; this redirect covers direct URL access too.
// Uncomment the block below (and the nav entry) to re-enable.
export default function TemplatesPage() {
  const router = useRouter()
  useEffect(() => {
    router.replace(ROUTES.dashboard)
  }, [router])
  return null
}

/*
import { useMemo, useState } from "react"
import Link from "next/link"
import { DataTable, type DataTableColumn } from "@/components/admin/data-table"
import { FilterBar } from "@/components/admin/filter-bar"
import { useAdminDataStore } from "@/lib/admin-data-store"
import type { NotificationTemplate } from "@/lib/admin-data"

const CHANNEL_LABEL: Record<NotificationTemplate["channel"], string> = {
  email: "Email", sms: "SMS", whatsapp: "WhatsApp", push: "Push",
}
const CHANNELS: NotificationTemplate["channel"][] = ["email", "sms", "whatsapp", "push"]

export default function TemplatesPage() {
  const notificationTemplates = useAdminDataStore((s) => s.templates)
  const [channelFilter, setChannelFilter] = useState("all")

  const filtered = useMemo(
    () => notificationTemplates.filter((t) => channelFilter === "all" || t.channel === channelFilter),
    [notificationTemplates, channelFilter],
  )

  const columns: DataTableColumn<NotificationTemplate>[] = [
    {
      key: "event", header: "Event", sortable: true, sortValue: (t) => t.eventLabel, render: (t) => (
        <Link href={ROUTES.templateDetail(t.eventKey, t.channel)} className="hover:underline">
          <div className="text-xs font-bold text-brand-secondary">{t.eventLabel}</div>
          <div className="text-[10px] text-brand-secondary/55">{t.eventKey}</div>
        </Link>
      ),
    },
    { key: "channel", header: "Channel", sortable: true, sortValue: (t) => t.channel, render: (t) => <span className="rounded-full bg-brand-tertiary px-2 py-0.5 text-[10px] font-bold text-brand-primary-dark">{CHANNEL_LABEL[t.channel]}</span> },
    { key: "version", header: "Version", sortable: true, sortValue: (t) => t.version, render: (t) => `v${t.version}` },
    { key: "updatedAt", header: "Updated", sortable: true, sortValue: (t) => t.updatedAt, render: (t) => <span className="text-brand-secondary/55">{t.updatedAt}</span> },
    { key: "preview", header: "Preview", render: (t) => <span className="text-brand-secondary/65">{t.bodyPreview}</span> },
  ]

  return (
    <div className="space-y-4">
      <p className="text-sm text-brand-secondary/60">
        23 core events × channel, versioned. WhatsApp bodies must map to BSP-approved template names (BR-90–92).
      </p>
      <FilterBar
        filters={[{ key: "channel", label: "Channel", value: channelFilter, onChange: setChannelFilter, options: CHANNELS.map((c) => ({ label: CHANNEL_LABEL[c], value: c })) }]}
      />
      <DataTable columns={columns} rows={filtered} rowKey={(t) => `${t.eventKey}-${t.channel}`} defaultSortKey="updatedAt" defaultSortDirection="desc" />
    </div>
  )
}
*/
