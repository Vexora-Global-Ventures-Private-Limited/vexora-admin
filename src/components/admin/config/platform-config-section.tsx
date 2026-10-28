"use client"

import { useMemo, useState } from "react"
import { Plus, Search } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ConfigField, parseConfigDraft } from "@/components/admin/config-field"
import { TotpStepUpDialog } from "@/components/admin/totp-step-up-dialog"
import { useGetConfigQuery, usePutConfigMutation, type ConfigType } from "@/store/api/adminApi"
import { useStepUp } from "@/lib/use-step-up"
import { describeAdminError, useFreshConfig, useIsSuperAdmin } from "@/components/admin/config/config-helpers"

const CONFIG_TYPES: ConfigType[] = ["string", "int", "decimal", "boolean", "json"]
const KEY_PATTERN = /^[a-z][a-z0-9_]{1,63}$/

/** G8 platform config — GET /admin/config, one editable row per key. */
export function PlatformConfigSection() {
  const { data: entries, isLoading, isError, refetch, isFetching } = useGetConfigQuery()
  const canEdit = useIsSuperAdmin()
  const [query, setQuery] = useState("")
  const [adding, setAdding] = useState(false)

  const sorted = useMemo(() => [...(entries ?? [])].sort((a, b) => a._id.localeCompare(b._id)), [entries])
  const q = query.trim().toLowerCase()
  const matches = (e: (typeof sorted)[number]) => !q || e._id.toLowerCase().includes(q) || (e.description ?? "").toLowerCase().includes(q)
  const matchCount = sorted.filter(matches).length

  return (
    <section aria-labelledby="platform-config-heading" className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="platform-config-heading" className="font-serif text-lg font-bold text-brand-secondary">
            Platform configuration
          </h2>
          <p className="text-sm text-brand-secondary/60">
            Live values — prices, quotas, validity days, thresholds. Changes apply to vexora-web immediately, no deploy.
            {canEdit ? " Writes need a fresh authenticator check." : " Read-only for your role."}
          </p>
        </div>
        {canEdit && (
          <Button size="sm" variant="outline" onClick={() => setAdding(true)} className="gap-1.5 self-start sm:self-auto">
            <Plus className="h-3.5 w-3.5" /> Add key
          </Button>
        )}
      </div>

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-brand-secondary/40" />
        <Input
          aria-label="Search config keys"
          placeholder="Search keys or descriptions…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-8"
        />
      </div>

      {isLoading && (
        <div className="space-y-2.5" aria-busy="true" aria-label="Loading configuration">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      )}

      {isError && (
        <div role="alert" className="border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Couldn&apos;t load configuration.{" "}
          <button onClick={() => refetch()} disabled={isFetching} className="font-semibold underline">
            {isFetching ? "Retrying…" : "Retry"}
          </button>
        </div>
      )}

      {entries && matchCount === 0 && (
        <p className="border border-dashed border-brand-border p-6 text-center text-sm text-brand-secondary/55">
          {query ? `No keys match “${query}”.` : "No config keys yet."}
        </p>
      )}

      {/* Rows that don't match the search are hidden, not unmounted — an
          unsaved edit in a row must survive typing in the search box. */}
      <div className="space-y-2.5">
        {sorted.map((entry) => (
          <div key={entry._id} hidden={!matches(entry)}>
            <ConfigField entry={entry} canEdit={canEdit} />
          </div>
        ))}
      </div>

      {adding && (
        <AddConfigDialog existingKeys={new Set((entries ?? []).map((e) => e._id))} onClose={() => setAdding(false)} />
      )}
    </section>
  )
}

function AddConfigDialog({ existingKeys, onClose }: { existingKeys: Set<string>; onClose: () => void }) {
  const [key, setKey] = useState("")
  const [type, setType] = useState<ConfigType>("int")
  const [draft, setDraft] = useState("")
  const [bool, setBool] = useState(false)
  const [description, setDescription] = useState("")
  const [touched, setTouched] = useState(false)
  const [putConfig, { isLoading }] = usePutConfigMutation()
  const stepUp = useStepUp()
  const freshConfig = useFreshConfig()

  const keyError = !KEY_PATTERN.test(key)
    ? "Lowercase letters, digits and underscores; starts with a letter (2–64 chars)."
    : existingKeys.has(key)
      ? "That key already exists — edit it in the list instead."
      : null
  const parsed = parseConfigDraft(type, draft, bool, key)
  const descError = description.trim().length < 5 ? "Describe what this setting controls (min 5 characters)." : null
  const invalid = !!keyError || !!parsed.error || !!descError

  const submit = () => {
    setTouched(true)
    if (invalid || isLoading) return
    stepUp.run(
      async () => {
        // PUT upserts — if another admin created this key meanwhile, it
        // would be silently overwritten. Re-check against the server first.
        if ((await freshConfig()).some((e) => e._id === key)) {
          throw new Error("Another admin just created this key — close this and edit it in the list instead.")
        }
        await putConfig({ key, value: parsed.value, type, description: description.trim() }).unwrap()
      },
      {
        onSuccess: () => {
          toast.success(`${key} added`, { description: "Live now · audit-logged." })
          onClose()
        },
        onError: (err) =>
          toast.error("Couldn't add key", { description: err instanceof Error ? err.message : describeAdminError(err, "Please try again.") }),
      },
    )
  }

  return (
    <>
      <Dialog open onOpenChange={(o) => !o && !isLoading && !stepUp.open && onClose()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add a config key</DialogTitle>
            <DialogDescription>
              Only add keys the backend actually reads — an unused key does nothing. It&apos;s live as soon as it&apos;s saved.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="cfg-key">Key</Label>
              <Input
                id="cfg-key"
                value={key}
                onChange={(e) => setKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"))}
                placeholder="e.g. listing_validity_days"
                className="mt-1 font-mono"
                aria-invalid={touched && !!keyError}
              />
              {touched && keyError && <p className="mt-1 text-xs text-red-600">{keyError}</p>}
            </div>
            <div>
              <Label htmlFor="cfg-type">Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as ConfigType)}>
                <SelectTrigger id="cfg-type" className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONFIG_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="cfg-value">Value</Label>
              {type === "boolean" ? (
                <div className="mt-2 flex items-center gap-2">
                  <Switch id="cfg-value" checked={bool} onCheckedChange={setBool} />
                  <span className="text-xs">{bool ? "On" : "Off"}</span>
                </div>
              ) : type === "json" ? (
                <Textarea id="cfg-value" value={draft} onChange={(e) => setDraft(e.target.value)} rows={4} spellCheck={false} className="mt-1 font-mono text-xs" placeholder='e.g. [1, 2, 3] or {"a": 1}' />
              ) : (
                <Input id="cfg-value" value={draft} onChange={(e) => setDraft(e.target.value)} className="mt-1" inputMode={type === "int" ? "numeric" : type === "decimal" ? "decimal" : "text"} />
              )}
              {touched && parsed.error && <p className="mt-1 text-xs text-red-600">{parsed.error}</p>}
            </div>
            <div>
              <Label htmlFor="cfg-desc">Description</Label>
              <Input id="cfg-desc" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={200} className="mt-1" />
              {touched && descError && <p className="mt-1 text-xs text-red-600">{descError}</p>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={onClose} disabled={isLoading || stepUp.open}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={isLoading || stepUp.open} className="btn-gold">
              {isLoading ? "Saving…" : "Add live key"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <TotpStepUpDialog {...stepUp} />
    </>
  )
}
