"use client"

import { useId, useState } from "react"
import { RotateCcw, Save, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useDeleteConfigMutation, usePutConfigMutation, type ConfigEntry, type ConfigType } from "@/store/api/adminApi"
import { useStepUp } from "@/lib/use-step-up"
import { useAdminSession } from "@/lib/admin-session"
import { TotpStepUpDialog } from "@/components/admin/totp-step-up-dialog"
import { describeAdminError, formatDateTime, STALE_CONFIG_MESSAGE, useFreshConfig } from "@/components/admin/config/config-helpers"
import { cn } from "@/lib/utils"

type JsonShape = "array" | "object" | "string" | "number" | "boolean" | "null"

function jsonShape(v: unknown): JsonShape {
  if (Array.isArray(v)) return "array"
  if (v === null) return "null"
  return typeof v as JsonShape
}

const isPositiveInt = (v: unknown) => Number.isSafeInteger(v) && (v as number) > 0
const isNonEmptyString = (v: unknown) => typeof v === "string" && v.trim().length > 0

/**
 * Extra checks for JSON keys vexora-web reads directly — the backend stores
 * any JSON, so a typo here (e.g. "3" instead of 3 in allowed_bhk_values)
 * would silently break the listing wizard.
 */
const JSON_KEY_RULES: Record<string, (v: unknown) => string | null> = {
  allowed_bhk_values: (v) => (Array.isArray(v) && v.length > 0 && v.every(isPositiveInt) ? null : "A non-empty list of whole numbers, e.g. [1, 2, 3]."),
  listing_reminder_days: (v) => (Array.isArray(v) && v.every(isPositiveInt) ? null : "A list of whole days, e.g. [15, 7, 1]."),
  allowed_property_types: (v) => (Array.isArray(v) && v.length > 0 && v.every(isNonEmptyString) ? null : 'A non-empty list of names, e.g. ["apartment", "villa"].'),
  kyc_document_types: (v) => (Array.isArray(v) && v.every(isNonEmptyString) ? null : 'A list of document names, e.g. ["pan", "aadhaar"].'),
  kyc_required_tiers: (v) => (Array.isArray(v) && v.every(isNonEmptyString) ? null : 'A list of tier names, e.g. ["venus"] (empty = KYC optional).'),
  ad_frequency_multipliers: (v) =>
    jsonShape(v) === "object" && Object.values(v as object).every((n) => typeof n === "number" && n >= 0)
      ? null
      : 'An object of non-negative numbers, e.g. {"standard": 1}.',
}

/**
 * JSON.parse silently keeps only the LAST of two duplicate keys and rounds
 * integers past 2^53 — both change the value without telling anyone. This
 * walks the (already valid) text once and reports either problem.
 */
function jsonLossiness(text: string): string | null {
  let i = 0
  const ws = () => {
    while (i < text.length && /\s/.test(text[i])) i++
  }
  const str = () => {
    const start = i++
    while (i < text.length && text[i] !== '"') i += text[i] === "\\" ? 2 : 1
    i++
    return JSON.parse(text.slice(start, i)) as string
  }
  const value = (): string | null => {
    ws()
    const c = text[i]
    if (c === "{") {
      i++
      const keys = new Set<string>()
      ws()
      if (text[i] === "}") return (i++, null)
      for (;;) {
        ws()
        const key = str()
        if (keys.has(key)) return `Duplicate key "${key}" — JSON would silently keep only the last one.`
        keys.add(key)
        ws()
        i++ // ":"
        const inner = value()
        if (inner) return inner
        ws()
        if (text[i++] === "}") return null
      }
    }
    if (c === "[") {
      i++
      ws()
      if (text[i] === "]") return (i++, null)
      for (;;) {
        const inner = value()
        if (inner) return inner
        ws()
        if (text[i++] === "]") return null
      }
    }
    if (c === '"') return (str(), null)
    const m = /^-?\d+(\.\d+)?([eE][+-]?\d+)?/.exec(text.slice(i))
    if (m) {
      i += m[0].length
      if (!m[1] && !m[2] && !Number.isSafeInteger(Number(m[0]))) return `${m[0]} is too large to store exactly.`
      return null
    }
    i += c === "t" || c === "n" ? 4 : 5 // true / null / false
    return null
  }
  try {
    return value()
  } catch {
    return null
  }
}

/** More than 15 significant digits can't round-trip through a JS number. */
function tooPrecise(t: string) {
  return t.replace(/^-/, "").replace(".", "").replace(/^0+/, "").length > 15
}

/**
 * Turns the editor's text into a typed value, or an error message.
 * `current` (the live value) pins a JSON key to its existing shape — an
 * array stays an array, an object stays an object.
 */
export function parseConfigDraft(type: ConfigType, draft: string, bool: boolean, key = "", current?: unknown): { value?: unknown; error?: string } {
  // Counts, durations and money can't go below zero (e.g. free_contact_limit, listing_validity_days, renewal_fee_paise).
  const nonNegative = /(_days|_limit|_hours|_paise|_count)$/.test(key)
  switch (type) {
    case "boolean":
      return { value: bool }
    case "int": {
      const t = draft.trim()
      if (!/^-?\d+$/.test(t)) return { error: "Enter a whole number." }
      const n = Number(t)
      if (!Number.isSafeInteger(n)) return { error: "That number is too large." }
      // "-0" is a real JS value that serialises as 0 — normalise it.
      return nonNegative && n < 0 ? { error: "This can't be negative." } : { value: n === 0 ? 0 : n }
    }
    case "decimal": {
      const t = draft.trim()
      if (/^-?\d+,\d+$/.test(t)) return { error: "Use a dot for decimals, e.g. 1.5 (not 1,5)." }
      if (!/^-?\d+(\.\d+)?$/.test(t)) return { error: "Enter a number, e.g. 1.5" }
      if (tooPrecise(t)) return { error: "Too many digits to store exactly (max 15 significant)." }
      const n = Number(t)
      return nonNegative && n < 0 ? { error: "This can't be negative." } : { value: n === 0 ? 0 : n }
    }
    case "json": {
      // A pasted byte-order mark makes JSON.parse fail with no visible cause.
      const text = draft.replace(/^\uFEFF/, "")
      let value: unknown
      try {
        value = JSON.parse(text)
      } catch {
        return { error: "Not valid JSON — check brackets, quotes and commas (trailing commas aren't allowed)." }
      }
      const lossy = jsonLossiness(text)
      if (lossy) return { error: lossy }
      // A key that's currently null has no shape to keep.
      if (current !== undefined && current !== null && jsonShape(value) !== jsonShape(current)) {
        return { error: `This setting must stay a JSON ${jsonShape(current)} — the platform reads it as one.` }
      }
      const ruleError = JSON_KEY_RULES[key]?.(value)
      return ruleError ? { error: ruleError } : { value }
    }
    default:
      return { value: draft }
  }
}

export function configDraftFrom(entry: Pick<ConfigEntry, "type" | "value">): string {
  if (entry.type === "json") return JSON.stringify(entry.value, null, 2)
  if (entry.type === "boolean") return ""
  return entry.value === null || entry.value === undefined ? "" : String(entry.value)
}

function formatValue(type: ConfigType, value: unknown) {
  if (type === "boolean") return value ? "On" : "Off"
  if (type === "json") return JSON.stringify(value)
  return value === "" ? '""' : String(value)
}

/**
 * One live G8 config row (GET /admin/config entry; `_id` is the key).
 *
 * Typed editor per `type`; Save is enabled only for a valid, changed value
 * and always goes through a "this is live for every vexora-web user"
 * confirmation before the super_admin + step-up gated PUT. Falsy values
 * (0, false, "") are real values, never "unset". Read-only for any role
 * other than super_admin.
 *
 * Mount with `key={entry._id}` — a newer server copy is handled inside
 * (adopted when there's no unsaved edit, otherwise offered via a banner),
 * so another admin's save never silently wipes a draft.
 */
export function ConfigField({ entry: live, canEdit }: { entry: ConfigEntry; canEdit: boolean }) {
  const id = useId()
  const adminId = useAdminSession((s) => s.adminUser?.id)
  // The server copy this editor started from. A newer copy (our own save or
  // another admin's) is adopted straight away when nothing is unsaved;
  // otherwise the draft is kept and a banner offers the new value.
  const [entry, setEntry] = useState(live)
  const [adoptNext, setAdoptNext] = useState(false)
  const [draft, setDraft] = useState(() => configDraftFrom(live))
  const [bool, setBool] = useState(() => Boolean(live.value))
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteTyped, setDeleteTyped] = useState("")
  const [putConfig, { isLoading: isSaving }] = usePutConfigMutation()
  const [deleteConfig, { isLoading: isDeleting }] = useDeleteConfigMutation()
  const stepUp = useStepUp()
  const freshConfig = useFreshConfig()

  const parsed = parseConfigDraft(entry.type, draft, bool, entry._id, entry.type === "json" ? entry.value : undefined)
  // Any edit at all — including an invalid one — counts as unsaved work.
  const edited = entry.type === "boolean" ? bool !== Boolean(entry.value) : draft !== configDraftFrom(entry)
  const dirty = !parsed.error && JSON.stringify(parsed.value) !== JSON.stringify(entry.value)
  const busy = isSaving || isDeleting || stepUp.open
  const spaceWarning = entry.type === "string" && draft !== draft.trim() ? "Leading or trailing spaces will be saved as part of the value." : null

  const adopt = (next: ConfigEntry) => {
    setEntry(next)
    setDraft(configDraftFrom(next))
    setBool(Boolean(next.value))
    setAdoptNext(false)
  }
  // Strictly newer — right after our own save `entry` is the PUT's response
  // and the cached `live` row is still the OLD copy until the refetch lands.
  const newerOnServer = Date.parse(live.updatedAt) > Date.parse(entry.updatedAt)
  if (newerOnServer && (adoptNext || !edited)) adopt(live)

  const reset = () => adopt(live)

  // Last-write-wins on the backend — re-read the key right before writing
  // and refuse if another admin changed it since this editor loaded.
  const assertUnchanged = async () => {
    const latest = (await freshConfig()).find((e) => e._id === entry._id)
    if (!latest || latest.updatedAt !== entry.updatedAt) throw new Error(STALE_CONFIG_MESSAGE)
  }

  const save = () => {
    setConfirmOpen(false)
    let saved: ConfigEntry | undefined
    stepUp.run(
      async () => {
        await assertUnchanged()
        // Seeded rows always have a description today; fall back to the key
        // rather than fail the PUT if one ever doesn't (it's required).
        saved = await putConfig({ key: entry._id, value: parsed.value, type: entry.type, description: entry.description || entry._id }).unwrap()
      },
      {
        onSuccess: () => {
          // Adopt the server's copy right away — waiting for the list refetch
          // left Save clickable (draft ≠ old entry) and a second click would
          // have been refused as "changed by another admin".
          if (saved) adopt(saved)
          else setAdoptNext(true)
          toast.success(`${entry._id} updated`, { description: "Live now · audit-logged." })
        },
        onError: (err) =>
          toast.error("Couldn't save", {
            description: err instanceof Error ? err.message : describeAdminError(err, "Please try again."),
          }),
      },
    )
  }

  const remove = () => {
    setDeleteOpen(false)
    setDeleteTyped("")
    stepUp.run(
      async () => {
        await assertUnchanged()
        await deleteConfig(entry._id).unwrap()
      },
      {
        onSuccess: () => toast.success(`${entry._id} deleted`, { description: "Audit-logged." }),
        onError: (err) =>
          toast.error("Couldn't delete", {
            description: err instanceof Error ? err.message : describeAdminError(err, "Please try again."),
          }),
      },
    )
  }

  const editedBy = entry.updatedBy ? (entry.updatedBy === adminId ? "you" : `admin …${entry.updatedBy.slice(-6)}`) : "seed"

  return (
    <div className="flex flex-col gap-3 bg-card p-4 ring-1 ring-brand-border">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <label htmlFor={`${id}-value`} className="block break-all font-mono text-sm font-bold text-brand-secondary">
            {entry._id}
          </label>
          <div className="text-xs text-brand-secondary/60">{entry.description || "No description."}</div>
          <div className="mt-1 text-[10px] uppercase tracking-wide text-brand-secondary/40">
            {entry.type} · last edited by {editedBy} · {formatDateTime(entry.updatedAt)}
          </div>
        </div>

        <div className={cn("flex shrink-0 gap-2", entry.type === "json" ? "w-full sm:w-80" : "items-center")}>
          {entry.type === "boolean" ? (
            <div className="flex items-center gap-2">
              <Switch id={`${id}-value`} checked={bool} onCheckedChange={setBool} disabled={!canEdit || busy} />
              <span className="text-xs font-semibold text-brand-secondary/70">{bool ? "On" : "Off"}</span>
            </div>
          ) : entry.type === "json" ? (
            <Textarea
              id={`${id}-value`}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              readOnly={!canEdit}
              disabled={busy}
              rows={Math.min(8, Math.max(2, draft.split("\n").length))}
              spellCheck={false}
              aria-invalid={!!parsed.error}
              aria-describedby={parsed.error ? `${id}-err` : undefined}
              className="w-full font-mono text-xs"
            />
          ) : (
            <Input
              id={`${id}-value`}
              inputMode={entry.type === "int" ? "numeric" : entry.type === "decimal" ? "decimal" : "text"}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              readOnly={!canEdit}
              disabled={busy}
              aria-invalid={!!parsed.error}
              aria-describedby={parsed.error ? `${id}-err` : undefined}
              className="w-full sm:w-40"
            />
          )}
        </div>
      </div>

      {parsed.error && (
        <p id={`${id}-err`} className="text-xs font-semibold text-red-600">
          {parsed.error}
        </p>
      )}
      {!parsed.error && spaceWarning && edited && <p className="text-xs text-amber-700">{spaceWarning}</p>}

      {newerOnServer && !adoptNext && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-2 border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-800">
          <span className="break-all">
            Another admin changed this to <b className="font-mono">{formatValue(live.type, live.value)}</b> while you were editing.
          </span>
          <Button size="sm" variant="outline" onClick={() => adopt(live)} className="h-7 text-xs">
            Load their value (discard mine)
          </Button>
        </div>
      )}

      {canEdit && (
        <div className="flex flex-wrap items-center justify-end gap-2">
          {edited && (
            <Button size="sm" variant="ghost" onClick={reset} disabled={busy} className="gap-1.5">
              <RotateCcw className="h-3.5 w-3.5" /> Undo
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => setDeleteOpen(true)} disabled={busy} className="gap-1.5 text-red-600 hover:text-red-700">
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </Button>
          <Button size="sm" variant="outline" onClick={() => setConfirmOpen(true)} disabled={!dirty || busy || newerOnServer} className="gap-1.5">
            <Save className="h-3.5 w-3.5" /> {isSaving ? "Saving…" : "Save"}
          </Button>
        </div>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Change a live setting?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>
                  <span className="font-mono font-semibold">{entry._id}</span> takes effect <b>immediately</b> for every
                  vexora-web user — there&apos;s no preview or undo step.
                </p>
                <p className="break-all font-mono text-xs">
                  {formatValue(entry.type, entry.value)} → <b>{formatValue(entry.type, parsed.value)}</b>
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={save}>Save live value</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={deleteOpen}
        onOpenChange={(o) => {
          setDeleteOpen(o)
          if (!o) setDeleteTyped("")
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this setting?</AlertDialogTitle>
            <AlertDialogDescription>
              Anything on the platform that reads <span className="font-mono">{entry._id}</span> will stop finding it — only delete keys
              that are no longer used. Type the key to confirm.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            aria-label="Type the key to confirm"
            value={deleteTyped}
            onChange={(e) => setDeleteTyped(e.target.value)}
            placeholder={entry._id}
            autoComplete="off"
            className="font-mono"
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={remove}
              disabled={deleteTyped.trim() !== entry._id}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <TotpStepUpDialog {...stepUp} />
    </div>
  )
}
