"use client"

import { useId, useRef, useState } from "react"
import { toast } from "sonner"
import { ChevronLeft, ChevronRight, Loader2, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DataTable, type DataTableColumn } from "@/components/admin/data-table"
import { StatusPill } from "@/components/admin/status-pill"
import { TotpStepUpDialog } from "@/components/admin/totp-step-up-dialog"
import { QueryState, ShortId, UserLink, errorText, formatDateTime, formatPaise } from "@/components/admin/moderation/shared"
import { useStepUp } from "@/lib/use-step-up"
import { useActivateStuckOrderMutation, useGetStuckOrdersQuery, type StuckOrder } from "@/store/api/adminApi"

const PAGE_SIZE = 20
const NOTE_MAX = 1000
// The documented rule is "stuck > 10 min"; 0 shows every processing order.
const AGE_OPTIONS = [
  { value: "10", label: "Stuck over 10 minutes" },
  { value: "60", label: "Stuck over 1 hour" },
  { value: "0", label: "All processing orders" },
]

// Razorpay payment ids are "pay_" + 14 alphanumerics; demo mode uses "pay_demo_…".
const PAYMENT_ID_RE = /^pay_[A-Za-z0-9_]{6,}$/

const isFree = (o: StuckOrder) => o.amountPaise === 0
const amountLabel = (o: StuckOrder) => (isFree(o) ? "₹0 (free)" : formatPaise(o.amountPaise))

function stuckFor(minutes: number | null) {
  if (minutes == null) return "—"
  if (minutes < 60) return `${minutes} min`
  if (minutes < 60 * 48) return `${Math.floor(minutes / 60)} h ${minutes % 60} min`
  return `${Math.floor(minutes / 1440)} days`
}

/**
 * G3 — the "paid but inactive" queue: orders whose checkout was verified but
 * whose Razorpay webhook never arrived. Manual activation (⚠ step-up) runs the
 * same activation service as the webhook — membership, receipt, referral days,
 * lead release — and marks the order `manually_activated`. The backend is
 * idempotent, so a double activation just returns the order unchanged.
 */
export default function PaymentOpsPage() {
  const [age, setAge] = useState("10")
  const [page, setPage] = useState(1)
  const { data, isLoading, isFetching, error, refetch } = useGetStuckOrdersQuery(
    { olderThanMinutes: Number(age), page, limit: PAGE_SIZE },
    { refetchOnMountOrArgChange: true },
  )
  const [activateOrder] = useActivateStuckOrderMutation()
  const stepUp = useStepUp()
  const lock = useRef(false)
  const [submittingId, setSubmittingId] = useState<string | null>(null)
  const [activating, setActivating] = useState<StuckOrder | null>(null)

  const orders = data?.orders ?? []
  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1
  const hasMore = data ? page < totalPages : false

  const submit = (order: StuckOrder, paymentId: string, note: string) => {
    if (lock.current) return
    // The dialog stays open until activation succeeds, so a cancelled code
    // prompt keeps the payment id and note.
    stepUp.run(
      async () => {
        lock.current = true
        setSubmittingId(order.id)
        try {
          const result = await activateOrder({ id: order.id, note: note.trim(), razorpayPaymentId: paymentId.trim() || undefined }).unwrap()
          setActivating(null)
          if (orders.length === 1 && page > 1) setPage((p) => p - 1)
          const status = typeof result?.status === "string" ? result.status : "manually_activated"
          if (status === "paid") {
            toast.info("This order was already paid", { description: "The webhook had already activated it — nothing changed." })
          } else {
            toast.success("Membership activated", { description: "Receipt, referral days and lead release ran exactly as for a webhook payment." })
          }
        } finally {
          lock.current = false
          setSubmittingId(null)
        }
      },
      { onError: (err) => toast.error(errorText(err, "Couldn't activate this order.")) },
    )
  }

  const columns: DataTableColumn<StuckOrder>[] = [
    {
      key: "user",
      header: "User",
      render: (o) => (
        <div className="space-y-0.5 text-xs">
          <div className="font-semibold text-brand-secondary">{o.userName ?? "No name"}</div>
          {o.userMobile && <div className="text-brand-secondary/60">{o.userMobile}</div>}
          {o.userEmail && <div className="break-all text-brand-secondary/60">{o.userEmail}</div>}
          {o.userId && <UserLink id={o.userId} className="text-brand-secondary/50" />}
        </div>
      ),
    },
    {
      key: "plan",
      header: "Plan",
      sortable: true,
      sortValue: (o) => o.planName ?? o.planTier ?? "",
      render: (o) => (
        <div className="text-xs">
          <div className="font-semibold capitalize text-brand-secondary">{o.planName ?? o.planTier ?? "—"}</div>
          {o.purpose && <div className="text-brand-secondary/55">{o.purpose.replace(/_/g, " ")}</div>}
        </div>
      ),
    },
    {
      key: "amount",
      header: "Amount",
      sortable: true,
      sortValue: (o) => o.amountPaise ?? -1,
      render: (o) => <span className="whitespace-nowrap text-xs font-semibold">{amountLabel(o)}</span>,
    },
    {
      key: "razorpay",
      header: "Razorpay",
      render: (o) => (
        <div className="space-y-0.5 font-mono text-[11px] text-brand-secondary/70">
          <div title="Razorpay order id">{o.razorpayOrderId ?? "—"}</div>
          <div title="Razorpay payment id">{o.razorpayPaymentId ?? "no payment id"}</div>
        </div>
      ),
    },
    {
      key: "stuck",
      header: "Stuck for",
      sortable: true,
      sortValue: (o) => o.minutesStuck ?? 0,
      render: (o) => (
        <div className="text-xs">
          <div className="font-semibold text-red-600">{stuckFor(o.minutesStuck)}</div>
          <div className="whitespace-nowrap text-brand-secondary/50">{formatDateTime(o.createdAt)}</div>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (o) => (
        <div>
          <StatusPill tone={o.status === "failed" ? "danger" : "warning"}>{o.status.replace(/_/g, " ")}</StatusPill>
          <div className="mt-0.5"><ShortId id={o.id} className="text-brand-secondary/45" /></div>
        </div>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      render: (o) => (
        <Button size="sm" disabled={!o.id || submittingId === o.id || stepUp.open} onClick={() => setActivating(o)} className="gap-1">
          {submittingId === o.id && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Activate
        </Button>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="max-w-3xl text-sm text-brand-secondary/60">
          Orders where the user finished checkout but the Razorpay webhook never arrived. Check the payment in the Razorpay
          dashboard first, then activate — it runs the same activation as a real webhook. Needs a fresh authenticator code.
        </p>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => refetch()} disabled={isFetching}>
          <RotateCcw className={isFetching ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} /> Refresh
        </Button>
      </div>

      <Select
        value={age}
        onValueChange={(v) => {
          setAge(v)
          setPage(1)
        }}
      >
        <SelectTrigger size="sm" className="w-[230px] bg-card" aria-label="How long stuck">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {AGE_OPTIONS.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <QueryState isLoading={isLoading} error={error} onRetry={refetch} isFetching={isFetching}>
        <DataTable
          columns={columns}
          rows={orders}
          rowKey={(o) => o.id}
          defaultSortKey="stuck"
          defaultSortDirection="desc"
          pageSize={PAGE_SIZE}
          emptyLabel="No stuck orders — every verified payment has been activated."
        />
        {data && orders.length === 0 && page > 1 && (
          <p className="text-xs text-brand-secondary/60">
            Nothing on page {page} any more — orders were activated in the meantime.{" "}
            <button type="button" className="font-semibold underline" onClick={() => setPage(1)}>
              Go to page 1
            </button>
          </p>
        )}
        {data && (data.total > PAGE_SIZE || page > 1) && (
          <div className="flex items-center justify-between text-xs text-brand-muted-foreground">
            <span>
              Page {page} of {totalPages} · {data.total} orders
            </span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={page <= 1 || isFetching} onClick={() => setPage((p) => Math.max(1, p - 1))} className="gap-1">
                <ChevronLeft className="h-3.5 w-3.5" /> Prev
              </Button>
              <Button size="sm" variant="outline" disabled={!hasMore || isFetching} onClick={() => setPage((p) => p + 1)} className="gap-1">
                Next <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </QueryState>

      {activating && (
        <ActivateDialog
          key={activating.id}
          order={activating}
          submitting={submittingId === activating.id || stepUp.open}
          onClose={() => setActivating(null)}
          onSubmit={submit}
        />
      )}

      <TotpStepUpDialog {...stepUp} />
    </div>
  )
}

function ActivateDialog({
  order,
  submitting,
  onClose,
  onSubmit,
}: {
  order: StuckOrder
  submitting: boolean
  onClose: () => void
  onSubmit: (order: StuckOrder, paymentId: string, note: string) => void
}) {
  const id = useId()
  const free = isFree(order)
  const [paymentId, setPaymentId] = useState(order.razorpayPaymentId ?? "")
  const [note, setNote] = useState("")
  const trimmedId = paymentId.trim()
  // A paid order needs the Razorpay payment id the admin checked; a ₹0 order has none.
  const idError = !free && !trimmedId ? "Required for a paid order" : trimmedId && !PAYMENT_ID_RE.test(trimmedId) ? "Should look like pay_XXXXXXXXXXXXXX" : null
  const noteError = !note.trim() ? "Required — it goes in the audit log" : null
  const canSubmit = !idError && !noteError && !submitting

  return (
    <Dialog open onOpenChange={(o) => !o && !submitting && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl">Activate order manually</DialogTitle>
          <DialogDescription className="break-words">
            {order.userName ?? order.userMobile ?? order.userEmail ?? "This user"} · {order.planName ?? order.planTier ?? "plan"} · {amountLabel(order)}
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            if (canSubmit) onSubmit(order, paymentId, note)
          }}
        >
          {free ? (
            <p className="border border-amber-200 bg-amber-50 p-2 text-[11px] text-amber-800">
              This is a ₹0 order — there is no Razorpay payment to check. Only activate it if this user should get the plan for free.
            </p>
          ) : (
            <p className="text-[11px] text-brand-secondary/65">
              Find order <span className="font-mono">{order.razorpayOrderId ?? "—"}</span> in the Razorpay dashboard and confirm the
              payment is <b>captured</b> before activating.
            </p>
          )}
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-pay`} className="text-xs font-semibold">
              Razorpay payment id {free && "(optional)"}
            </Label>
            <Input id={`${id}-pay`} value={paymentId} disabled={submitting} onChange={(e) => setPaymentId(e.target.value)} placeholder="pay_…" className="font-mono" autoComplete="off" />
            {idError && trimmedId !== "" && <p className="text-[11px] text-red-600">{idError}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-note`} className="text-xs font-semibold">Note</Label>
            <Textarea id={`${id}-note`} rows={3} value={note} maxLength={NOTE_MAX} disabled={submitting} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Captured in Razorpay on 27 Oct, webhook missed" />
            <p className="text-right text-[11px] text-brand-muted-foreground">{note.length}/{NOTE_MAX}</p>
          </div>
          <Button type="submit" className="btn-gold w-full gap-1.5" disabled={!canSubmit}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {submitting ? "Activating…" : "Activate membership"}
          </Button>
          {!canSubmit && !submitting && (
            <p className="text-center text-[11px] text-brand-secondary/55">{noteError ?? idError}</p>
          )}
        </form>
      </DialogContent>
    </Dialog>
  )
}
