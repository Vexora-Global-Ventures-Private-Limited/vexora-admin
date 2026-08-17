"use client"

import { useState } from "react"
import { Save } from "lucide-react"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import type { PlatformConfigEntry } from "@/lib/admin-data"
import { useAdminDataStore } from "@/lib/admin-data-store"
import { useStepUp } from "@/lib/use-step-up"
import { TotpStepUpDialog } from "@/components/admin/totp-step-up-dialog"

/** One editable G8 config row — writes are step-up gated (BR-80/BR-82) and
 *  persist into the shared admin data store (audit-logged). In the real
 *  system a write would also bust the `config:{key}` Redis cache. */
export function ConfigField({ entry }: { entry: PlatformConfigEntry }) {
  const [value, setValue] = useState(entry.value)
  const updateConfig = useAdminDataStore((s) => s.updateConfig)
  const stepUp = useStepUp()

  const save = () =>
    stepUp.run(() => {
      updateConfig(entry.key, value)
      toast.success(`${entry.label} updated`, { description: `New value: ${String(value)} (audit-logged).` })
    })

  return (
    <div className="flex flex-col gap-3 bg-card p-4 ring-1 ring-brand-border sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="text-sm font-bold text-brand-secondary">{entry.label}</div>
        <div className="text-xs text-brand-secondary/55">{entry.description}</div>
        <div className="mt-1 text-[10px] uppercase tracking-wide text-brand-secondary/35">
          {entry.key} · last edited by {entry.updatedBy} on {entry.updatedAt}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {entry.type === "boolean" ? (
          <Switch aria-label={entry.label} checked={Boolean(value)} onCheckedChange={(v) => setValue(v)} />
        ) : (
          <Input
            aria-label={entry.label}
            type={entry.type === "int" || entry.type === "decimal" ? "number" : "text"}
            value={String(value)}
            onChange={(e) => setValue(entry.type === "int" || entry.type === "decimal" ? Number(e.target.value) : e.target.value)}
            className="w-36"
          />
        )}
        <Button size="sm" variant="outline" onClick={save} className="gap-1.5">
          <Save className="h-3.5 w-3.5" /> Save
        </Button>
      </div>
      <TotpStepUpDialog {...stepUp} />
    </div>
  )
}
