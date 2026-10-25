"use client"

import { useId, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { AlertTriangle, Loader2, Pencil, Plus, Power } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { StatusPill } from "@/components/admin/status-pill"
import { TotpStepUpDialog } from "@/components/admin/totp-step-up-dialog"
import { useStepUp } from "@/lib/use-step-up"
import { useAdminSession } from "@/lib/admin-session"
import {
  useCreateAdPackageMutation,
  useDeactivateAdPackageMutation,
  useGetAdPackagesQuery,
  useUpdateAdPackageMutation,
  type AdPackage,
  type AdProduct,
} from "@/store/api/adminApi"
import { AD_PRODUCT_LABEL } from "./ad-actions"
import { QueryState, errorText, formatDate, formatPaise } from "@/components/admin/moderation/shared"

const PRODUCTS = Object.keys(AD_PRODUCT_LABEL) as AdProduct[]
const MAX_DAYS = 365
const MAX_RUPEES = 10_000_000

type Draft = { product: AdProduct; name: string; days: string; price: string }

/** "1499.5" → 149950 paise, integer maths only. null when invalid. */
function rupeesToPaise(value: string): number | null {
  const m = value.trim().match(/^(\d{1,8})(?:\.(\d{1,2}))?$/)
  if (!m) return null
  const paise = Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0"))
  return paise >= 100 && paise <= MAX_RUPEES * 100 ? paise : null
}

function paiseToRupeesInput(paise: number) {
  const r = Math.floor(paise / 100)
  const p = paise % 100
  return p ? `${r}.${String(p).padStart(2, "0")}` : String(r)
}

function validate(d: Draft) {
  const name = d.name.trim().replace(/\s+/g, " ")
  const days = Number(d.days)
  const paise = rupeesToPaise(d.price)
  return {
    name,
    days,
    paise,
    errors: {
      name: name.length < 2 || name.length > 60 ? "2–60 characters." : null,
      days: !/^\d+$/.test(d.days) || days < 1 || days > MAX_DAYS ? `Whole days, 1–${MAX_DAYS}.` : null,
      price: paise == null ? `₹1 to ₹${MAX_RUPEES.toLocaleString("en-IN")}, up to 2 decimals.` : null,
    },
  }
}

/**
 * Ad packages (G6 pricing menu). Every write is super_admin + ⚠ step-up and
 * changes what sellers see on the ad-purchase screen immediately.
 *
 * Verified backend bug: PATCH creates a NEW version (new _id) but leaves the
 * old version active, so sellers would be offered both. After a successful
 * edit this screen deactivates the old id itself, and says so.
 */
export function AdPackagesSection() {
  const role = useAdminSession((s) => s.adminUser?.role)
  const canWrite = role === "super_admin"
  const { data, isLoading, isFetching, error, refetch } = useGetAdPackagesQuery()
  const [createPkg] = useCreateAdPackageMutation()
  const [updatePkg] = useUpdateAdPackageMutation()
  const [deactivatePkg] = useDeactivateAdPackageMutation()
  const stepUp = useStepUp()
  const lock = useRef(false)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState<AdPackage | "new" | null>(null)
  const [deactivating, setDeactivating] = useState<AdPackage | null>(null)
  const [showInactive, setShowInactive] = useState(false)

  const grouped = useMemo(() => {
    const pkgs = data ?? []
    return PRODUCTS.map((product) => ({
      product,
      active: pkgs.filter((p) => p.product === product && p.isActive).sort((a, b) => a.pricePaise - b.pricePaise),
      inactive: pkgs.filter((p) => p.product === product && !p.isActive),
    }))
  }, [data])
  const inactiveCount = grouped.reduce((n, g) => n + g.inactive.length, 0)

  // Duplicate active versions of the same package (same product + name).
  // The backend's PATCH leaves the previous version active (verified bug), so
  // these exist on dev already, and appear again whenever the automatic
  // cleanup after an edit fails. Newest = highest version, then latest created.
  const duplicates = useMemo(() => {
    const byKey = new Map<string, AdPackage[]>()
    for (const p of data ?? []) {
      if (!p.isActive) continue
      const key = `${p.product}::${p.name.trim().toLowerCase()}`
      byKey.set(key, [...(byKey.get(key) ?? []), p])
    }
    return [...byKey.values()]
      .filter((list) => list.length > 1)
      .map((list) => {
        const sorted = [...list].sort((a, b) => b.version - a.version || b.createdAt.localeCompare(a.createdAt))
        return { keep: sorted[0], older: sorted.slice(1) }
      })
  }, [data])

  const guarded = (call: () => Promise<unknown>, onSuccess: () => void, fallback: string) => {
    if (lock.current) return
    stepUp.run(
      async () => {
        lock.current = true
        setSaving(true)
        try {
          await call()
        } finally {
          lock.current = false
          setSaving(false)
        }
      },
      { onSuccess, onError: (err) => toast.error(errorText(err, fallback)) },
    )
  }

  const save = (draft: Draft) => {
    const v = validate(draft)
    if (v.errors.name || v.errors.days || v.errors.price || v.paise == null) return
    const body = { name: v.name, durationDays: v.days, pricePaise: v.paise }
    if (editing === "new") {
      guarded(
        () => createPkg({ product: draft.product, ...body }).unwrap(),
        () => {
          toast.success("Package created", { description: "Sellers can buy it immediately." })
          setEditing(null)
        },
        "Couldn't create the package.",
      )
      return
    }
    if (!editing) return
    const old = editing
    guarded(
      async () => {
        const updated = await updatePkg({ id: old._id, body }).unwrap()
        if (updated._id !== old._id) {
          try {
            await deactivatePkg(old._id).unwrap()
            toast.success("Package updated", { description: `Saved as version ${updated.version}; the previous version was deactivated so sellers only see the new one.` })
          } catch (err) {
            // Not rethrown: that would re-run the whole save and create yet
            // another version. The leftover shows in the duplicates banner
            // above the list, with a one-click deactivate.
            toast.warning("New version saved, but the old one is still active", {
              description: `${errorText(err, "Deactivating it failed.")} Use “Deactivate older versions” above the package list.`,
            })
          }
        } else {
          toast.success("Package updated")
        }
      },
      () => setEditing(null),
      "Couldn't update the package.",
    )
  }

  const deactivateOlder = (older: AdPackage[]) => {
    guarded(
      async () => {
        for (const p of older) await deactivatePkg(p._id).unwrap()
      },
      () => toast.success(`Deactivated ${older.length} older version${older.length === 1 ? "" : "s"}`, { description: "Sellers now see only the newest one." }),
      "Couldn't deactivate the older versions.",
    )
  }

  const confirmDeactivate = () => {
    if (!deactivating) return
    const pkg = deactivating
    setDeactivating(null)
    guarded(
      () => deactivatePkg(pkg._id).unwrap(),
      () => toast.success(`“${pkg.name}” deactivated`, { description: "Existing orders keep working; it's no longer offered." }),
      "Couldn't deactivate the package.",
    )
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="font-serif text-lg font-bold text-brand-secondary">Ad packages</h2>
          <p className="text-xs text-brand-secondary/60">
            Live prices on the seller&apos;s ad-purchase screen — changes apply immediately. {canWrite ? "Every change needs a fresh authenticator code." : "Only a super admin can change these."}
          </p>
        </div>
        {canWrite && (
          <Button size="sm" className="gap-1.5" onClick={() => setEditing("new")} disabled={saving}>
            <Plus className="h-3.5 w-3.5" /> New package
          </Button>
        )}
      </div>

      <QueryState isLoading={isLoading} error={error} onRetry={refetch} isFetching={isFetching} rows={3}>
        {duplicates.length > 0 && (
          <div role="alert" className="space-y-2 border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
            <p className="flex gap-1.5 font-semibold">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {duplicates.length} package{duplicates.length === 1 ? " has" : "s have"} more than one active version — sellers are offered
              every one of them.
            </p>
            <ul className="space-y-1.5 pl-5">
              {duplicates.map(({ keep, older }) => (
                <li key={keep._id} className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    {AD_PRODUCT_LABEL[keep.product]} · “{keep.name}”: keeping v{keep.version} ({formatPaise(keep.pricePaise)}, {keep.durationDays}d),{" "}
                    {older.map((o) => `v${o.version} (${formatPaise(o.pricePaise)}, ${o.durationDays}d)`).join(", ")} still active
                  </span>
                  {canWrite && (
                    <Button size="sm" variant="outline" className="h-7 bg-card" disabled={saving} onClick={() => deactivateOlder(older)}>
                      Deactivate older version{older.length === 1 ? "" : "s"}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
            <p className="text-[11px] text-amber-800/80">
              “Newest” is the highest version number. If two versions are genuinely different offers, rename one instead.
            </p>
          </div>
        )}
        <div className="grid gap-3 md:grid-cols-2">
          {grouped.map((g) => (
            <div key={g.product} className="border border-brand-border bg-card p-4">
              <div className="mb-2 text-xs font-bold uppercase tracking-wide text-brand-primary-dark">{AD_PRODUCT_LABEL[g.product]}</div>
              {g.active.length === 0 ? (
                <p className="text-xs text-brand-secondary/55">No active packages — sellers can&apos;t buy this product.</p>
              ) : (
                <ul className="divide-y divide-brand-border/70">
                  {g.active.map((p) => (
                    <li key={p._id} className="flex items-center justify-between gap-2 py-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-brand-secondary">{p.name}</div>
                        <div className="text-[11px] text-brand-secondary/55">
                          {formatPaise(p.pricePaise)} · {p.durationDays} day{p.durationDays === 1 ? "" : "s"} · v{p.version}
                        </div>
                      </div>
                      {canWrite && (
                        <div className="flex shrink-0 gap-1">
                          <Button size="icon" variant="ghost" className="h-8 w-8" title="Edit" aria-label={`Edit ${p.name}`} disabled={saving} onClick={() => setEditing(p)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-red-600" title="Deactivate" aria-label={`Deactivate ${p.name}`} disabled={saving} onClick={() => setDeactivating(p)}>
                            <Power className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {showInactive && g.inactive.length > 0 && (
                <ul className="mt-2 space-y-1 border-t border-dashed border-brand-border pt-2">
                  {g.inactive.map((p) => (
                    <li key={p._id} className="flex items-center justify-between gap-2 text-[11px] text-brand-secondary/50">
                      <span className="truncate">
                        {p.name} · {formatPaise(p.pricePaise)} · {p.durationDays}d · v{p.version}
                      </span>
                      <StatusPill tone="neutral">inactive</StatusPill>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
        {inactiveCount > 0 && (
          <Button variant="link" size="sm" className="px-0" onClick={() => setShowInactive((s) => !s)}>
            {showInactive ? "Hide" : "Show"} {inactiveCount} inactive package{inactiveCount === 1 ? "" : "s"}
          </Button>
        )}
      </QueryState>

      {editing && (
        <PackageDialog
          key={editing === "new" ? "new" : editing._id}
          pkg={editing === "new" ? null : editing}
          saving={saving}
          onClose={() => !saving && setEditing(null)}
          onSave={save}
        />
      )}

      <AlertDialog open={!!deactivating} onOpenChange={(o) => !o && setDeactivating(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate “{deactivating?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              It stops being offered for new purchases. Orders that already reference it keep working. This is a soft
              deactivation — nothing is deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeactivate}>Deactivate</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <TotpStepUpDialog {...stepUp} />
    </section>
  )
}

function PackageDialog({
  pkg,
  saving,
  onClose,
  onSave,
}: {
  pkg: AdPackage | null
  saving: boolean
  onClose: () => void
  onSave: (draft: Draft) => void
}) {
  const id = useId()
  const [draft, setDraft] = useState<Draft>({
    product: pkg?.product ?? "banner",
    name: pkg?.name ?? "",
    days: pkg ? String(pkg.durationDays) : "30",
    price: pkg ? paiseToRupeesInput(pkg.pricePaise) : "",
  })
  const [touched, setTouched] = useState(false)
  const v = validate(draft)
  const invalid = !!(v.errors.name || v.errors.days || v.errors.price)
  const unchanged = !!pkg && v.name === pkg.name && v.days === pkg.durationDays && v.paise === pkg.pricePaise
  const show = (key: keyof typeof v.errors) => (touched ? v.errors[key] : null)

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl">{pkg ? "Edit package" : "New ad package"}</DialogTitle>
          <DialogDescription>
            {pkg
              ? `Changing price or duration saves a new version (v${pkg.version + 1}); the current one is deactivated automatically.`
              : "Offered to sellers immediately after saving."}
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            setTouched(true)
            if (!invalid && !unchanged) onSave(draft)
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-product`} className="text-xs font-semibold">Product</Label>
            <Select value={draft.product} onValueChange={(v) => setDraft({ ...draft, product: v as AdProduct })} disabled={!!pkg || saving}>
              <SelectTrigger id={`${id}-product`} className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PRODUCTS.map((p) => (
                  <SelectItem key={p} value={p}>{AD_PRODUCT_LABEL[p]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-name`} className="text-xs font-semibold">Name</Label>
            <Input id={`${id}-name`} value={draft.name} maxLength={60} disabled={saving} aria-invalid={!!show("name")} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="e.g. 30 days" />
            {show("name") && <p className="text-[11px] text-red-600">{show("name")}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor={`${id}-days`} className="text-xs font-semibold">Duration (days)</Label>
              <Input id={`${id}-days`} value={draft.days} inputMode="numeric" disabled={saving} aria-invalid={!!show("days")} onChange={(e) => setDraft({ ...draft, days: e.target.value.replace(/\D/g, "").slice(0, 3) })} />
              {show("days") && <p className="text-[11px] text-red-600">{show("days")}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${id}-price`} className="text-xs font-semibold">Price (₹)</Label>
              <Input id={`${id}-price`} value={draft.price} inputMode="decimal" disabled={saving} aria-invalid={!!show("price")} onChange={(e) => setDraft({ ...draft, price: e.target.value.replace(/[^\d.]/g, "").slice(0, 11) })} placeholder="1500" />
              {show("price") && <p className="text-[11px] text-red-600">{show("price")}</p>}
            </div>
          </div>
          {pkg && <p className="text-[11px] text-brand-secondary/50">Created {formatDate(pkg.createdAt)} · current v{pkg.version}</p>}
          <Button type="submit" className="btn-gold w-full gap-1.5" disabled={saving || (touched && invalid) || unchanged}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {saving ? "Saving…" : unchanged ? "No changes" : pkg ? "Save new version" : "Create package"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
