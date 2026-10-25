"use client"

import { useState } from "react"
import { Pencil, Plus, Power } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { DataTable, type DataTableColumn } from "@/components/admin/data-table"
import { StatusPill } from "@/components/admin/status-pill"
import { TotpStepUpDialog } from "@/components/admin/totp-step-up-dialog"
import {
  useCreateMembershipPlanMutation,
  useDeactivateMembershipPlanMutation,
  useGetMembershipPlansQuery,
  useUpdateMembershipPlanMutation,
  type AdminMembershipPlan,
} from "@/store/api/adminApi"
import { useStepUp } from "@/lib/use-step-up"
import { getApiErrorCode } from "@/lib/api-error"
import {
  describeAdminError, formatDateTime, formatPaise, isValidDisplayName, paiseToRupeesInput, rupeesToPaise, useIsSuperAdmin,
} from "@/components/admin/config/config-helpers"

type Tier = AdminMembershipPlan["tier"]
const TIERS: Tier[] = ["mercury", "jupiter", "venus"]
const TIER_ORDER: Record<Tier, number> = { mercury: 0, jupiter: 1, venus: 2 }
/** Feature flags vexora-web reads; any extra flag a plan already has is kept and shown too. */
const KNOWN_FEATURES: { key: string; label: string }[] = [
  { key: "crmBoard", label: "CRM Kanban board" },
  { key: "badges", label: "Verification badges" },
  { key: "coBroker", label: "Co-broking" },
  { key: "inventory", label: "Project inventory (Venus)" },
]
const MAX_PRICE_PAISE = 10_000_000 * 100 // ₹1 crore — a sanity ceiling, not a business rule
const featureLabel = (key: string) => KNOWN_FEATURES.find((f) => f.key === key)?.label ?? key

type PlanForm = { name: string; price: string; durationDays: string; listingQuota: string; features: Record<string, boolean> }

function formFromPlan(plan?: AdminMembershipPlan): PlanForm {
  const features: Record<string, boolean> = Object.fromEntries(KNOWN_FEATURES.map((f) => [f.key, false]))
  return {
    name: plan?.name ?? "",
    price: plan ? paiseToRupeesInput(plan.pricePaise) : "",
    durationDays: plan ? String(plan.durationDays) : "365",
    listingQuota: plan ? String(plan.listingQuota) : "",
    features: { ...features, ...(plan?.features ?? {}) },
  }
}

function validate(form: PlanForm) {
  const pricePaise = rupeesToPaise(form.price)
  const durationDays = /^\d+$/.test(form.durationDays.trim()) ? Number(form.durationDays) : NaN
  const listingQuota = /^\d+$/.test(form.listingQuota.trim()) ? Number(form.listingQuota) : NaN
  const errors: Partial<Record<keyof PlanForm, string>> = {}
  if (!isValidDisplayName(form.name)) errors.name = "2–60 characters."
  if (pricePaise === null || pricePaise > MAX_PRICE_PAISE) errors.price = "Enter a price in ₹ (0 for free), up to 2 decimals."
  if (!(durationDays >= 1 && durationDays <= 3650)) errors.durationDays = "1–3650 days."
  if (!(listingQuota >= 0 && listingQuota <= 10000)) errors.listingQuota = "0–10000 listings."
  return { errors, values: { name: form.name.trim(), pricePaise: pricePaise ?? 0, durationDays, listingQuota, features: form.features } }
}

/** G8 membership plans — LIVE prices/quotas for vexora-web's membership page and checkout. */
export function MembershipPlansSection() {
  const { data: plans, isLoading, isError, refetch, isFetching } = useGetMembershipPlansQuery()
  const canEdit = useIsSuperAdmin()
  const [editing, setEditing] = useState<AdminMembershipPlan | "new" | null>(null)
  const [toggling, setToggling] = useState<AdminMembershipPlan | null>(null)
  const [deactivate, { isLoading: isDeactivating }] = useDeactivateMembershipPlanMutation()
  const [update, { isLoading: isUpdating }] = useUpdateMembershipPlanMutation()
  const stepUp = useStepUp()

  const sorted = [...(plans ?? [])].sort((a, b) => TIER_ORDER[a.tier] - TIER_ORDER[b.tier] || b.version - a.version)
  const missingTiers = TIERS.filter((t) => !(plans ?? []).some((p) => p.tier === t))

  const toggleActive = (plan: AdminMembershipPlan) => {
    setToggling(null)
    if (stepUp.open) return
    const action = plan.isActive ? () => deactivate(plan._id).unwrap() : () => update({ id: plan._id, body: { isActive: true } }).unwrap()
    stepUp.run(action, {
      onSuccess: () => toast.success(`${plan.name} ${plan.isActive ? "deactivated" : "reactivated"}`, { description: "Audit-logged." }),
      onError: (err) => toast.error("Couldn't update plan", { description: describeAdminError(err, "Please try again.") }),
    })
  }

  const columns: DataTableColumn<AdminMembershipPlan>[] = [
    {
      key: "tier",
      header: "Tier",
      render: (p) => <span className="rounded-full bg-brand-tertiary px-2 py-0.5 text-[10px] font-bold capitalize text-brand-primary-dark">{p.tier}</span>,
    },
    { key: "name", header: "Name", render: (p) => <span className="font-semibold">{p.name}</span> },
    { key: "price", header: "Price", render: (p) => `${formatPaise(p.pricePaise)} / ${p.durationDays}d` },
    { key: "quota", header: "Listings", render: (p) => p.listingQuota },
    {
      key: "features",
      header: "Features",
      render: (p) => (
        <span className="text-xs text-brand-secondary/70">
          {Object.entries(p.features ?? {}).filter(([, on]) => on).map(([k]) => featureLabel(k)).join(", ") || "—"}
        </span>
      ),
    },
    { key: "version", header: "Version", render: (p) => `v${p.version}` },
    {
      key: "status",
      header: "Status",
      render: (p) => <StatusPill tone={p.isActive ? "success" : "neutral"}>{p.isActive ? "active" : "inactive"}</StatusPill>,
    },
    { key: "updated", header: "Updated", render: (p) => <span className="text-xs text-brand-secondary/55">{formatDateTime(p.updatedAt)}</span> },
    ...(canEdit
      ? [
          {
            key: "actions",
            header: "",
            render: (p: AdminMembershipPlan) => (
              <div className="flex justify-end gap-1">
                <Button size="sm" variant="ghost" aria-label={`Edit ${p.name}`} onClick={() => setEditing(p)} disabled={isDeactivating || isUpdating || stepUp.open}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={`${p.isActive ? "Deactivate" : "Reactivate"} ${p.name}`}
                  onClick={() => setToggling(p)}
                  disabled={isDeactivating || isUpdating || stepUp.open}
                >
                  <Power className="h-3.5 w-3.5" />
                </Button>
              </div>
            ),
          } satisfies DataTableColumn<AdminMembershipPlan>,
        ]
      : []),
  ]

  return (
    <section aria-labelledby="plans-heading" className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="plans-heading" className="font-serif text-lg font-bold text-brand-secondary">Membership plans</h2>
          <p className="text-sm text-brand-secondary/60">
            Live prices on vexora-web — every change applies to new purchases and renewals immediately. Deactivating hides a plan
            from new purchases; it&apos;s never deleted.
          </p>
        </div>
        {canEdit && missingTiers.length > 0 && (
          <Button size="sm" variant="outline" onClick={() => setEditing("new")} className="gap-1.5 self-start sm:self-auto">
            <Plus className="h-3.5 w-3.5" /> New plan
          </Button>
        )}
      </div>

      {isLoading && <Skeleton className="h-40 w-full" aria-label="Loading plans" />}
      {isError && (
        <div role="alert" className="border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Couldn&apos;t load membership plans.{" "}
          <button onClick={() => refetch()} disabled={isFetching} className="font-semibold underline">
            Retry
          </button>
        </div>
      )}
      {plans && <DataTable columns={columns} rows={sorted} rowKey={(p) => p._id} emptyLabel="No membership plans yet." />}

      {editing && (
        <PlanDialog
          plan={editing === "new" ? undefined : editing}
          availableTiers={editing === "new" ? missingTiers : []}
          onClose={() => setEditing(null)}
        />
      )}

      <AlertDialog open={!!toggling} onOpenChange={(o) => !o && setToggling(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{toggling?.isActive ? "Deactivate" : "Reactivate"} {toggling?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              {toggling?.isActive
                ? "It disappears from vexora-web's membership page immediately — nobody can buy or renew it. Existing members keep their membership."
                : "It becomes purchasable on vexora-web immediately at its current price."}
              {toggling?.isActive &&
                !(plans ?? []).some((p) => p.tier === toggling.tier && p._id !== toggling._id && p.isActive) && (
                  <b className="mt-2 block text-red-700">
                    This is the only active {toggling.tier} plan — the {toggling.tier} tier will have nothing to buy.
                  </b>
                )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => toggling && toggleActive(toggling)}>
              {toggling?.isActive ? "Deactivate" : "Reactivate"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <TotpStepUpDialog {...stepUp} />
    </section>
  )
}

function PlanDialog({ plan, availableTiers, onClose }: { plan?: AdminMembershipPlan; availableTiers: Tier[]; onClose: () => void }) {
  const [form, setForm] = useState<PlanForm>(() => formFromPlan(plan))
  const [tier, setTier] = useState<Tier | "">(availableTiers[0] ?? "")
  const [touched, setTouched] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [create, { isLoading: isCreating }] = useCreateMembershipPlanMutation()
  const [update, { isLoading: isUpdating }] = useUpdateMembershipPlanMutation()
  const stepUp = useStepUp()
  const busy = isCreating || isUpdating || stepUp.open

  const { errors, values } = validate(form)
  const invalid = Object.keys(errors).length > 0 || (!plan && !tier)

  // Only send what changed on an edit — keeps cosmetic edits from versioning the plan.
  const changes: Partial<AdminMembershipPlan> = {}
  if (plan) {
    if (values.name !== plan.name) changes.name = values.name
    if (values.pricePaise !== plan.pricePaise) changes.pricePaise = values.pricePaise
    if (values.durationDays !== plan.durationDays) changes.durationDays = values.durationDays
    if (values.listingQuota !== plan.listingQuota) changes.listingQuota = values.listingQuota
    if (JSON.stringify(values.features) !== JSON.stringify({ ...formFromPlan().features, ...plan.features })) changes.features = values.features
  }
  const versions = plan && ("pricePaise" in changes || "durationDays" in changes || "listingQuota" in changes)
  const changedFeatures = plan
    ? Object.keys(values.features).filter((k) => !!values.features[k] !== !!(plan.features ?? {})[k])
    : []
  const nothingChanged = !!plan && Object.keys(changes).length === 0

  const set = <K extends keyof PlanForm>(k: K, v: PlanForm[K]) => setForm((f) => ({ ...f, [k]: v }))

  const review = () => {
    setTouched(true)
    if (invalid || nothingChanged) return
    setConfirming(true)
  }

  const submit = () => {
    setConfirming(false)
    let saved: AdminMembershipPlan | undefined
    const action = plan
      ? async () => {
          saved = await update({ id: plan._id, body: changes }).unwrap()
        }
      : async () => {
          saved = await create({ tier: tier as Tier, ...values }).unwrap()
        }
    stepUp.run(action, {
      onSuccess: () => {
        // Report what the server actually did — the API documents price /
        // duration / quota edits as "new version", but on dev past edits
        // updated the plan in place (still v1).
        const how =
          plan && saved
            ? saved._id !== plan._id
              ? `Saved as a new version (v${saved.version}).`
              : saved.version !== plan.version
                ? `Now v${saved.version}.`
                : `Updated in place (v${saved.version}).`
            : "Created."
        toast.success(plan ? `${values.name} updated` : `${values.name} created`, { description: `${how} Live on vexora-web · audit-logged.` })
        onClose()
      },
      onError: (err) =>
        toast.error("Couldn't save plan", {
          description:
            getApiErrorCode(err) === "CONFLICT"
              ? "A plan already exists for this tier — edit that one instead."
              : describeAdminError(err, "Please try again."),
        }),
    })
  }

  const field = (id: keyof PlanForm, label: string, extra: Partial<React.ComponentProps<typeof Input>> = {}) => (
    <div>
      <Label htmlFor={`plan-${id}`}>{label}</Label>
      <Input
        id={`plan-${id}`}
        value={form[id] as string}
        onChange={(e) => set(id, e.target.value as never)}
        aria-invalid={touched && !!errors[id]}
        className="mt-1"
        {...extra}
      />
      {touched && errors[id] && <p className="mt-1 text-xs text-red-600">{errors[id]}</p>}
    </div>
  )

  return (
    <>
      <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{plan ? `Edit ${plan.name}` : "New membership plan"}</DialogTitle>
            <DialogDescription>
              {plan ? `v${plan.version} · ${plan.tier}. ` : "One plan per tier. "}
              {versions ? "Price, duration or quota changed — the API may save this as a new plan version." : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {!plan && (
              <div>
                <Label htmlFor="plan-tier">Tier</Label>
                <Select value={tier} onValueChange={(v) => setTier(v as Tier)}>
                  <SelectTrigger id="plan-tier" className="mt-1 capitalize">
                    <SelectValue placeholder="Pick a tier" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableTiers.map((t) => (
                      <SelectItem key={t} value={t} className="capitalize">
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {field("name", "Name", { maxLength: 60 })}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {field("price", "Price (₹)", { inputMode: "decimal", placeholder: "4999" })}
              {field("durationDays", "Duration (days)", { inputMode: "numeric" })}
              {field("listingQuota", "Listing quota", { inputMode: "numeric" })}
            </div>
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Features</legend>
              {Object.keys(form.features).map((key) => (
                <div key={key} className="flex items-center justify-between gap-3">
                  <Label htmlFor={`plan-f-${key}`} className="font-normal">
                    {featureLabel(key)}
                  </Label>
                  <Switch
                    id={`plan-f-${key}`}
                    checked={!!form.features[key]}
                    onCheckedChange={(v) => set("features", { ...form.features, [key]: v })}
                  />
                </div>
              ))}
            </fieldset>
            {nothingChanged && touched && <p className="text-xs text-brand-secondary/60">Nothing has changed yet.</p>}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={review} disabled={busy || nothingChanged} className="btn-gold">
              {busy ? "Saving…" : "Review & save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Publish to vexora-web?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>This is live immediately for every new purchase and renewal.</p>
                <ul className="list-disc pl-5 text-xs">
                  {plan ? (
                    <>
                      {"name" in changes && <li>Name: {plan.name} → <b>{values.name}</b></li>}
                      {"pricePaise" in changes && <li>Price: {formatPaise(plan.pricePaise)} → <b>{formatPaise(values.pricePaise)}</b></li>}
                      {"durationDays" in changes && <li>Duration: {plan.durationDays}d → <b>{values.durationDays}d</b></li>}
                      {"listingQuota" in changes && <li>Listings: {plan.listingQuota} → <b>{values.listingQuota}</b></li>}
                      {changedFeatures.map((k) => (
                        <li key={k}>
                          {featureLabel(k)}: {(plan.features ?? {})[k] ? "on" : "off"} → <b>{values.features[k] ? "on" : "off"}</b>
                        </li>
                      ))}
                    </>
                  ) : (
                    <li className="capitalize">
                      {tier}: {values.name} · {formatPaise(values.pricePaise)} / {values.durationDays}d · {values.listingQuota} listings
                    </li>
                  )}
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Back</AlertDialogCancel>
            <AlertDialogAction onClick={submit}>Publish</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <TotpStepUpDialog {...stepUp} />
    </>
  )
}
