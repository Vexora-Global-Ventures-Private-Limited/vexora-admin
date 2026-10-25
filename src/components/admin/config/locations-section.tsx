"use client"

import { useMemo, useState } from "react"
import { Pencil, Plus, Search } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DataTable, type DataTableColumn } from "@/components/admin/data-table"
import { StatusPill } from "@/components/admin/status-pill"
import { TotpStepUpDialog } from "@/components/admin/totp-step-up-dialog"
import {
  useCreateLocationMutation,
  useGetLocationsQuery,
  useUpdateLocationMutation,
  type AdminLocation,
  type LocationActivation,
  type LocationType,
} from "@/store/api/adminApi"
import { isValidDisplayName, useIsSuperAdmin } from "@/components/admin/config/config-helpers"
import { useDirectWrite } from "@/components/admin/config/amenities-section"

const TYPES: LocationType[] = ["country", "state", "district", "city", "locality"]
const TYPE_RANK: Record<LocationType, number> = { country: 0, state: 1, district: 2, city: 3, locality: 4 }
const ACTIVATIONS: { value: LocationActivation; label: string; tone: "success" | "warning" | "neutral" }[] = [
  { value: "active", label: "Active", tone: "success" },
  { value: "coming_soon", label: "Coming soon", tone: "warning" },
  { value: "inactive", label: "Inactive", tone: "neutral" },
]
const activationOf = (v: LocationActivation) => ACTIVATIONS.find((a) => a.value === v) ?? ACTIVATIONS[2]

/** Comma-separated aliases → unique list (case-insensitive), minus any that just repeat the name. */
function parseAliases(text: string, name = "") {
  const seen = new Set([name.trim().toLowerCase()])
  const out: string[] = []
  for (const raw of text.split(",")) {
    const a = raw.trim().replace(/\s+/g, " ")
    if (!a || seen.has(a.toLowerCase())) continue
    seen.add(a.toLowerCase())
    out.push(a)
  }
  return out
}

/**
 * G8 Location Master — the source of vexora-web's city pickers
 * (`GET /locations/active`). Only active locations reach the website.
 */
export function LocationsSection() {
  const { data: locations, isLoading, isError, refetch, isFetching } = useGetLocationsQuery({})
  const canEdit = useIsSuperAdmin()
  const [query, setQuery] = useState("")
  const [typeFilter, setTypeFilter] = useState<LocationType | "all">("all")
  const [activationFilter, setActivationFilter] = useState<LocationActivation | "all">("all")
  const [editing, setEditing] = useState<AdminLocation | "new" | null>(null)

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return [...(locations ?? [])]
      .filter((l) => typeFilter === "all" || l.type === typeFilter)
      .filter((l) => activationFilter === "all" || l.activation === activationFilter)
      .filter((l) => !q || (l.displayPath ?? l.name).toLowerCase().includes(q) || (l.aliases ?? []).some((a) => a.toLowerCase().includes(q)))
      .sort((a, b) => TYPE_RANK[a.type] - TYPE_RANK[b.type] || (a.displayPath ?? a.name).localeCompare(b.displayPath ?? b.name))
  }, [locations, query, typeFilter, activationFilter])

  const columns: DataTableColumn<AdminLocation>[] = [
    {
      key: "name",
      header: "Location",
      sortable: true,
      sortValue: (l) => l.displayPath,
      render: (l) => (
        <div>
          <div className="font-semibold">{l.name}</div>
          <div className="text-[11px] text-brand-secondary/55">{l.displayPath}</div>
        </div>
      ),
    },
    { key: "type", header: "Type", sortable: true, sortValue: (l) => TYPE_RANK[l.type], render: (l) => <span className="capitalize">{l.type}</span> },
    { key: "aliases", header: "Aliases", render: (l) => <span className="text-xs text-brand-secondary/70">{(l.aliases ?? []).join(", ") || "—"}</span> },
    {
      key: "activation",
      header: "On the website",
      sortable: true,
      sortValue: (l) => l.activation,
      render: (l) => <StatusPill tone={activationOf(l.activation).tone}>{activationOf(l.activation).label}</StatusPill>,
    },
    ...(canEdit
      ? [
          {
            key: "edit",
            header: "",
            render: (l: AdminLocation) => (
              <Button size="sm" variant="ghost" aria-label={`Edit ${l.name}`} onClick={() => setEditing(l)}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            ),
          } satisfies DataTableColumn<AdminLocation>,
        ]
      : []),
  ]

  return (
    <section aria-labelledby="locations-heading" className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="locations-heading" className="font-serif text-lg font-bold text-brand-secondary">Locations</h2>
          <p className="text-sm text-brand-secondary/60">
            The Location Master behind vexora-web&apos;s city pickers and search. Only <b>active</b> locations appear on the website.
          </p>
        </div>
        {canEdit && (
          <Button size="sm" variant="outline" onClick={() => setEditing("new")} className="gap-1.5 self-start sm:self-auto">
            <Plus className="h-3.5 w-3.5" /> Add location
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative sm:max-w-xs sm:flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-brand-secondary/40" />
          <Input aria-label="Search locations" placeholder="Search name, path or alias…" value={query} onChange={(e) => setQuery(e.target.value)} className="pl-8" />
        </div>
        <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as LocationType | "all")}>
          <SelectTrigger aria-label="Filter by type" className="sm:w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {TYPES.map((t) => (
              <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={activationFilter} onValueChange={(v) => setActivationFilter(v as LocationActivation | "all")}>
          <SelectTrigger aria-label="Filter by status" className="sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any status</SelectItem>
            {ACTIVATIONS.map((a) => (
              <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading && <Skeleton className="h-40 w-full" aria-label="Loading locations" />}
      {isError && (
        <div role="alert" className="border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Couldn&apos;t load locations.{" "}
          <button onClick={() => refetch()} disabled={isFetching} className="font-semibold underline">Retry</button>
        </div>
      )}
      {locations && (
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(l) => l._id}
          pageSize={20}
          emptyLabel={query || typeFilter !== "all" || activationFilter !== "all" ? "No locations match these filters." : "No locations yet."}
        />
      )}

      {editing && (
        <LocationDialog location={editing === "new" ? undefined : editing} all={locations ?? []} onClose={() => setEditing(null)} />
      )}
    </section>
  )
}

function LocationDialog({ location, all, onClose }: { location?: AdminLocation; all: AdminLocation[]; onClose: () => void }) {
  const [name, setName] = useState(location?.name ?? "")
  const [type, setType] = useState<LocationType>(location?.type ?? "city")
  const [parentId, setParentId] = useState<string>(location?.parentId ?? "")
  const [activation, setActivation] = useState<LocationActivation>(location?.activation ?? "active")
  const [aliases, setAliases] = useState((location?.aliases ?? []).join(", "))
  const [touched, setTouched] = useState(false)
  const [create, { isLoading: isCreating }] = useCreateLocationMutation()
  const [update, { isLoading: isUpdating }] = useUpdateLocationMutation()
  const { write, stepUp } = useDirectWrite()
  const busy = isCreating || isUpdating || stepUp.open

  // A parent must sit higher in the hierarchy (country > state > district > city > locality).
  const parentOptions = all
    .filter((l) => TYPE_RANK[l.type] < TYPE_RANK[type] && l._id !== location?._id)
    .sort((a, b) => a.displayPath.localeCompare(b.displayPath))
  const parent = all.find((l) => l._id === parentId)
  const aliasList = parseAliases(aliases, name)
  const siblings = all.filter((l) => l._id !== location?._id && (l.parentId ?? "") === (location ? location.parentId ?? "" : parentId))

  const nameError = !isValidDisplayName(name)
    ? "2–60 characters."
    : siblings.some((l) => l.name.toLowerCase() === name.trim().toLowerCase())
      ? "A location with this name already exists under the same parent."
      : null
  const parentError = !location && type !== "country" && !parentId ? "Pick where this sits in the hierarchy." : null
  const aliasError = aliasList.some((a) => !isValidDisplayName(a)) ? "Each alias: 2–60 characters, comma-separated." : null
  const invalid = !!nameError || !!parentError || !!aliasError
  const nothingChanged =
    !!location &&
    name.trim() === location.name &&
    activation === location.activation &&
    JSON.stringify(aliasList) === JSON.stringify(location.aliases ?? [])

  const submit = () => {
    setTouched(true)
    if (invalid || busy || nothingChanged) return
    const action = location
      ? () => update({ id: location._id, body: { name: name.trim().replace(/\s+/g, " "), activation, aliases: aliasList } }).unwrap()
      : async () => {
          const created = await create({ name: name.trim().replace(/\s+/g, " "), type, ...(parentId ? { parentId } : {}), aliases: aliasList }).unwrap()
          // POST takes no activation — new places start in whatever state the
          // backend defaults to. Say so when it isn't live on the website yet.
          if (created?.activation && created.activation !== "active") {
            toast.info(`${created.name} isn't on the website yet`, {
              description: `It was created as "${activationOf(created.activation).label}". Edit it and set "On the website" to Active to show it in vexora-web's city pickers.`,
            })
          }
        }
    void write(action, {
      success: location ? `${name.trim()} updated` : `${name.trim()} added`,
      error: "Couldn't save location",
      after: onClose,
    })
  }

  return (
    <>
      <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{location ? `Edit ${location.name}` : "Add location"}</DialogTitle>
            <DialogDescription>
              {location
                ? `${location.type} · ${location.displayPath}. Type and parent can't be changed after creation.`
                : "Adds a place vexora-web can offer in its city pickers once it's active."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {!location && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="loc-type">Type</Label>
                  <Select
                    value={type}
                    onValueChange={(v) => {
                      setType(v as LocationType)
                      setParentId("")
                    }}
                  >
                    <SelectTrigger id="loc-type" className="mt-1 capitalize">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TYPES.map((t) => (
                        <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {type !== "country" && (
                  <div>
                    <Label htmlFor="loc-parent">Inside</Label>
                    <Select value={parentId} onValueChange={setParentId}>
                      <SelectTrigger id="loc-parent" className="mt-1" aria-invalid={touched && !!parentError}>
                        <SelectValue placeholder="Pick parent…" />
                      </SelectTrigger>
                      <SelectContent>
                        {parentOptions.length === 0 && (
                          <div className="px-2 py-1.5 text-xs text-brand-secondary/60">Add a higher-level place first.</div>
                        )}
                        {parentOptions.map((l) => (
                          <SelectItem key={l._id} value={l._id}>
                            {l.displayPath} <span className="text-[10px] capitalize opacity-60">({l.type})</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {touched && parentError && <p className="mt-1 text-xs text-red-600">{parentError}</p>}
                  </div>
                )}
              </div>
            )}
            <div>
              <Label htmlFor="loc-name">Name</Label>
              <Input id="loc-name" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} aria-invalid={touched && !!nameError} className="mt-1" placeholder="e.g. Pune" />
              {touched && nameError && <p className="mt-1 text-xs text-red-600">{nameError}</p>}
              {!location && parent && name.trim() && (
                <p className="mt-1 text-[11px] text-brand-secondary/55">Will show as: {name.trim()}, {parent.displayPath}</p>
              )}
            </div>
            <div>
              <Label htmlFor="loc-aliases">Aliases (optional, comma-separated)</Label>
              <Input id="loc-aliases" value={aliases} onChange={(e) => setAliases(e.target.value)} aria-invalid={touched && !!aliasError} className="mt-1" placeholder="e.g. Bangalore, Bengaluru" />
              {touched && aliasError && <p className="mt-1 text-xs text-red-600">{aliasError}</p>}
            </div>
            {location && (
              <div>
                <Label htmlFor="loc-activation">On the website</Label>
                <Select value={activation} onValueChange={(v) => setActivation(v as LocationActivation)}>
                  <SelectTrigger id="loc-activation" className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ACTIVATIONS.map((a) => (
                      <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {activation !== "active" && location.activation === "active" && (
                  <p className="mt-1 text-[11px] text-amber-700">This removes it from vexora-web&apos;s city pickers immediately.</p>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
            <Button onClick={submit} disabled={busy || nothingChanged} className="btn-gold">{busy ? "Saving…" : location ? "Save" : "Add location"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <TotpStepUpDialog {...stepUp} />
    </>
  )
}
