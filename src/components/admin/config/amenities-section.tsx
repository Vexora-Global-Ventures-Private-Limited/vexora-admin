"use client"

import { useMemo, useState } from "react"
import { Pencil, Plus } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@/components/ui/skeleton"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DataTable, type DataTableColumn } from "@/components/admin/data-table"
import { StatusPill } from "@/components/admin/status-pill"
import { TotpStepUpDialog } from "@/components/admin/totp-step-up-dialog"
import { useCreateAmenityMutation, useGetAmenitiesQuery, useUpdateAmenityMutation, type Amenity } from "@/store/api/adminApi"
import { isStepUpRequired, useStepUp } from "@/lib/use-step-up"
import { describeAdminError, isValidDisplayName, useIsSuperAdmin } from "@/components/admin/config/config-helpers"

const ICON_PATTERN = /^[a-z][a-z0-9_]{1,39}$/

/**
 * Runs a write directly (these aren't documented as step-up gated), and only
 * falls back to the authenticator dialog if the server answers
 * TOTP_STEPUP_REQUIRED — so routine edits don't prompt for a code.
 */
export function useDirectWrite() {
  const stepUp = useStepUp()
  const write = async (action: () => Promise<unknown>, done: { success: string; error: string; after?: () => void }) => {
    const onSuccess = () => {
      toast.success(done.success, { description: "Audit-logged." })
      done.after?.()
    }
    const onError = (err: unknown) => toast.error(done.error, { description: describeAdminError(err, "Please try again.") })
    try {
      await action()
      onSuccess()
    } catch (err) {
      if (isStepUpRequired(err)) stepUp.run(action, { onSuccess, onError })
      else onError(err)
    }
  }
  return { write, stepUp }
}

/** G8 amenities — the picklist sellers choose from in the listing wizard. */
export function AmenitiesSection() {
  const { data: amenities, isLoading, isError, refetch, isFetching } = useGetAmenitiesQuery()
  const canEdit = useIsSuperAdmin()
  const [editing, setEditing] = useState<Amenity | "new" | null>(null)
  const [update, { isLoading: isUpdating }] = useUpdateAmenityMutation()
  const [busyId, setBusyId] = useState<string | null>(null)
  const { write, stepUp } = useDirectWrite()

  const sorted = useMemo(
    () => [...(amenities ?? [])].sort((a, b) => (a.category ?? "").localeCompare(b.category ?? "") || a.name.localeCompare(b.name)),
    [amenities],
  )

  const toggle = async (a: Amenity) => {
    if (busyId || stepUp.open) return
    setBusyId(a._id)
    await write(() => update({ id: a._id, body: { isActive: !a.isActive } }).unwrap(), {
      success: `${a.name} ${a.isActive ? "hidden" : "shown"}`,
      error: "Couldn't update amenity",
    })
    setBusyId(null)
  }

  const columns: DataTableColumn<Amenity>[] = [
    { key: "name", header: "Amenity", sortable: true, sortValue: (a) => a.name, render: (a) => <span className="font-semibold">{a.name}</span> },
    { key: "category", header: "Category", sortable: true, sortValue: (a) => a.category ?? "", render: (a) => <span className="capitalize">{a.category ?? "—"}</span> },
    { key: "icon", header: "Icon key", render: (a) => <code className="text-xs">{a.icon}</code> },
    {
      key: "active",
      header: "Shown to sellers",
      render: (a) =>
        canEdit ? (
          <Switch
            checked={a.isActive}
            onCheckedChange={() => toggle(a)}
            disabled={!!busyId || isUpdating}
            aria-label={`${a.name}: ${a.isActive ? "shown" : "hidden"}`}
          />
        ) : (
          <StatusPill tone={a.isActive ? "success" : "neutral"}>{a.isActive ? "active" : "hidden"}</StatusPill>
        ),
    },
    ...(canEdit
      ? [
          {
            key: "edit",
            header: "",
            render: (a: Amenity) => (
              <Button size="sm" variant="ghost" aria-label={`Edit ${a.name}`} onClick={() => setEditing(a)}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            ),
          } satisfies DataTableColumn<Amenity>,
        ]
      : []),
  ]

  return (
    <section aria-labelledby="amenities-heading" className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="amenities-heading" className="font-serif text-lg font-bold text-brand-secondary">Amenities</h2>
          <p className="text-sm text-brand-secondary/60">The amenity picklist. Hidden amenities stay on existing listings but can&apos;t be picked for new ones.</p>
        </div>
        {canEdit && (
          <Button size="sm" variant="outline" onClick={() => setEditing("new")} className="gap-1.5 self-start sm:self-auto">
            <Plus className="h-3.5 w-3.5" /> Add amenity
          </Button>
        )}
      </div>

      {isLoading && <Skeleton className="h-40 w-full" aria-label="Loading amenities" />}
      {isError && (
        <div role="alert" className="border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Couldn&apos;t load amenities.{" "}
          <button onClick={() => refetch()} disabled={isFetching} className="font-semibold underline">Retry</button>
        </div>
      )}
      {amenities && (
        <DataTable columns={columns} rows={sorted} rowKey={(a) => a._id} pageSize={15} emptyLabel="No amenities yet." />
      )}

      {editing && (
        <AmenityDialog
          amenity={editing === "new" ? undefined : editing}
          existingNames={new Set((amenities ?? []).filter((a) => editing === "new" || a._id !== editing._id).map((a) => a.name.toLowerCase()))}
          categories={Array.from(new Set((amenities ?? []).map((a) => a.category).filter(Boolean) as string[]))}
          onClose={() => setEditing(null)}
        />
      )}
      <TotpStepUpDialog {...stepUp} />
    </section>
  )
}

function AmenityDialog({
  amenity,
  existingNames,
  categories,
  onClose,
}: {
  amenity?: Amenity
  existingNames: Set<string>
  categories: string[]
  onClose: () => void
}) {
  const [name, setName] = useState(amenity?.name ?? "")
  const [icon, setIcon] = useState(amenity?.icon ?? "")
  const [category, setCategory] = useState(amenity?.category ?? "")
  // The icon key follows the name until the admin edits it themselves.
  const [iconEdited, setIconEdited] = useState(!!amenity)
  const [touched, setTouched] = useState(false)
  const [create, { isLoading: isCreating }] = useCreateAmenityMutation()
  const [update, { isLoading: isUpdating }] = useUpdateAmenityMutation()
  const { write, stepUp } = useDirectWrite()
  const busy = isCreating || isUpdating || stepUp.open

  const nameError = !isValidDisplayName(name)
    ? "2–60 characters."
    : existingNames.has(name.trim().toLowerCase())
      ? "An amenity with this name already exists."
      : null
  const iconError = ICON_PATTERN.test(icon) ? null : "Lowercase letters, digits, underscores (e.g. swimming_pool)."
  const categoryError = category && !/^[a-z][a-z_ ]{1,29}$/i.test(category.trim()) ? "Letters, spaces or underscores; 2–30 characters." : null
  const invalid = !!nameError || !!iconError || !!categoryError
  const nothingChanged =
    !!amenity &&
    name.trim() === amenity.name &&
    icon === amenity.icon &&
    category.trim().toLowerCase() === (amenity.category ?? "").toLowerCase()

  const submit = () => {
    setTouched(true)
    if (invalid || busy || nothingChanged) return
    const body = { name: name.trim().replace(/\s+/g, " "), icon, ...(category.trim() ? { category: category.trim().toLowerCase() } : {}) }
    void write(
      () => (amenity ? update({ id: amenity._id, body }).unwrap() : create({ ...body, isActive: true }).unwrap()),
      { success: amenity ? `${body.name} updated` : `${body.name} added`, error: "Couldn't save amenity", after: onClose },
    )
  }

  return (
    <>
      <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{amenity ? `Edit ${amenity.name}` : "Add amenity"}</DialogTitle>
            <DialogDescription>Shown to sellers in the listing wizard straight away.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="am-name">Name</Label>
              <Input
                id="am-name"
                value={name}
                maxLength={60}
                onChange={(e) => {
                  setName(e.target.value)
                  if (!iconEdited) setIcon(e.target.value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""))
                }}
                aria-invalid={touched && !!nameError}
                className="mt-1"
              />
              {touched && nameError && <p className="mt-1 text-xs text-red-600">{nameError}</p>}
            </div>
            <div>
              <Label htmlFor="am-icon">Icon key</Label>
              <Input id="am-icon" value={icon} maxLength={40} onChange={(e) => {
                  setIconEdited(true)
                  setIcon(e.target.value.toLowerCase())
                }} aria-invalid={touched && !!iconError} className="mt-1 font-mono" />
              {touched && iconError && <p className="mt-1 text-xs text-red-600">{iconError}</p>}
            </div>
            <div>
              <Label htmlFor="am-category">Category (optional)</Label>
              <Input id="am-category" value={category} list="am-categories" maxLength={30} onChange={(e) => setCategory(e.target.value)} aria-invalid={touched && !!categoryError} className="mt-1" />
              {amenity?.category && !category.trim() && (
                <p className="mt-1 text-[11px] text-amber-700">A category can&apos;t be removed once set — leaving this empty keeps “{amenity.category}”.</p>
              )}
              <datalist id="am-categories">
                {categories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
              {touched && categoryError && <p className="mt-1 text-xs text-red-600">{categoryError}</p>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
            <Button onClick={submit} disabled={busy || nothingChanged} className="btn-gold">{busy ? "Saving…" : amenity ? "Save" : "Add"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <TotpStepUpDialog {...stepUp} />
    </>
  )
}
