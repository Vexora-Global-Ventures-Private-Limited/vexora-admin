"use client"

import { useEffect, useId, useRef, useState } from "react"
import { toast } from "sonner"
import { ChevronLeft, ChevronRight, ExternalLink, Loader2, RotateCcw, Search } from "lucide-react"
import { isMockRazorpayOrder, razorpayOrderUrl, razorpayPaymentUrl } from "@/lib/razorpay-dashboard"
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
import { RejectionDialog } from "@/components/admin/rejection-dialog"
import { getApiErrorCode } from "@/lib/api-error"
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
import {
  useActivateStuckOrderMutation,
  useDeleteRejectedOrderMutation,
  useGetStuckOrdersQuery,
  useRejectStuckOrderMutation,
  primaryPayment,
  type RazorpayLive,
  type StuckOrder,
} from "@/store/api/adminApi"

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

// ── Rejected orders, kept on this device ────────────────────────────────────
// A rejected order leaves the stuck list (it only returns `processing`), and
// there's no API to list rejected ones — but Delete is only allowed once an
// order IS rejected. So orders rejected here are remembered in this browser
// and stay in the table with a Delete button until deleted.
type RejectedOrder = StuckOrder & { rejectionReason: string }
const REJECTED_KEY = "vxa-rejected-orders"

function readRejected(): Record<string, RejectedOrder> {
  try {
    return JSON.parse(window.localStorage.getItem(REJECTED_KEY) ?? "{}") as Record<string, RejectedOrder>
  } catch {
    return {}
  }
}

function writeRejected(next: Record<string, RejectedOrder>) {
  try {
    window.localStorage.setItem(REJECTED_KEY, JSON.stringify(next))
  } catch {
    // Storage blocked — the row still shows until the page is reloaded.
  }
}

const STUCK_STATUSES = new Set(["processing", "created"])
const DONE_STATUSES = new Set(["paid", "manually_activated"])

/** Razorpay's live data shows real money captured for this order. */
const capturedOnRazorpay = (o: StuckOrder) =>
  !!o.live && (o.live.payments.some((p) => p.status === "captured") || o.live.orderStatus === "paid")

/**
 * Which actions an order's status allows — the backend enforces the same
 * rules. Since 2026-10-31 the backend also refuses to reject an order whose
 * payment Razorpay shows as captured (our webhook just hadn't landed): that
 * customer paid, so it must be activated instead.
 */
function allowedActions(o: StuckOrder) {
  const stuck = STUCK_STATUSES.has(o.status)
  return { activate: stuck, reject: stuck && !capturedOnRazorpay(o), delete: o.status === "rejected" }
}

function disabledReason(o: StuckOrder, action: "activate" | "reject" | "delete"): string | undefined {
  if (allowedActions(o)[action]) return undefined
  if (DONE_STATUSES.has(o.status)) return "Already paid / activated"
  if (o.status === "rejected") return action === "delete" ? undefined : "Order is rejected"
  if (action === "delete") return "Reject it first — only rejected orders can be deleted"
  if (action === "reject" && capturedOnRazorpay(o)) return "Razorpay shows this payment as captured — the customer paid. Activate it instead."
  return `Not allowed for a ${o.status.replace(/_/g, " ")} order`
}

const isFree = (o: StuckOrder) => o.amountPaise === 0
const amountLabel = (o: StuckOrder) => (o.amountPaise == null ? "amount not shown" : isFree(o) ? "₹0 (free)" : formatPaise(o.amountPaise))

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
  // Every processing order by default; the age filter narrows it.
  const [age, setAge] = useState("0")
  const [view, setView] = useState<"stuck" | "rejected" | "all">("stuck")
  const [byIdOpen, setByIdOpen] = useState(false)
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
  const [rejectOrder] = useRejectStuckOrderMutation()
  const [rejecting, setRejecting] = useState<StuckOrder | null>(null)
  const [rejectReason, setRejectReason] = useState("")
  const [deleteOrder] = useDeleteRejectedOrderMutation()
  const [deleting, setDeleting] = useState<StuckOrder | null>(null)
  // Read once on mount (client-only page) — see readRejected.
  const [rejected, setRejected] = useState<Record<string, RejectedOrder>>(() => (typeof window === "undefined" ? {} : readRejected()))
  const updateRejected = (update: (all: Record<string, RejectedOrder>) => Record<string, RejectedOrder>) =>
    setRejected((all) => {
      const next = update(all)
      writeRejected(next)
      return next
    })

  const serverOrders = data?.orders ?? []
  // Server rows (already-rejected ones keep their reason), plus rejected
  // orders remembered here that the stuck list no longer returns.
  // The stuck list only returns `processing` orders, so one that's there
  // isn't rejected (any more — e.g. the backend corrected a wrong reject):
  // the server wins over this browser's remembered copy.
  const localRejected = Object.values(rejected).filter((r) => !serverOrders.some((o) => o.id === r.id))
  const orders: StuckOrder[] = [...serverOrders, ...localRejected]
  useEffect(() => {
    // Forget revived orders in storage too (external write only; the
    // in-memory map is already filtered above).
    if (!data) return
    const stored = readRejected()
    const kept = Object.fromEntries(Object.entries(stored).filter(([id]) => !data.orders.some((o) => o.id === id)))
    if (Object.keys(kept).length !== Object.keys(stored).length) writeRejected(kept)
  }, [data])
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

  // Reject = "this payment never happened / is bad". The order is kept with
  // the reason (audit-logged) and leaves the stuck list. Step-up gated like
  // activation in case the backend requires it.
  const confirmReject = () => {
    const order = rejecting
    if (!order || lock.current || !rejectReason.trim()) return
    stepUp.run(
      async () => {
        lock.current = true
        setSubmittingId(order.id)
        try {
          const reason = rejectReason.trim()
          await rejectOrder({ id: order.id, reason }).unwrap()
          updateRejected((all) => ({ ...all, [order.id]: { ...order, status: "rejected", rejectionReason: reason } }))
          setRejecting(null)
          setRejectReason("")
          toast.success("Order rejected", { description: "Kept with your reason in the audit log. You can now delete it permanently if needed." })
        } finally {
          lock.current = false
          setSubmittingId(null)
        }
      },
      {
        onError: (err) => {
          // The backend refuses (409) when the order is already paid/activated,
          // or — since 2026-10-31 — when Razorpay shows the payment captured.
          // Its own message says which; refresh so the row shows the truth.
          if ((err as { status?: unknown })?.status === 409 || getApiErrorCode(err) === "INVALID_STATE_TRANSITION") {
            setRejecting(null)
            void refetch()
            toast.error("Can't reject this order", {
              description: errorText(err, "It's already paid on Razorpay or activated — activate it (or refund) instead."),
            })
            return
          }
          toast.error(errorText(err, "Couldn't reject this order."))
        },
      },
    )
  }

  // Permanent — only for rejected orders (409 otherwise). Step-up gated.
  const confirmDelete = () => {
    const order = deleting
    setDeleting(null)
    if (!order || lock.current) return
    stepUp.run(
      async () => {
        lock.current = true
        setSubmittingId(order.id)
        try {
          await deleteOrder(order.id).unwrap()
          updateRejected(({ [order.id]: _gone, ...rest }) => rest)
          toast.success("Order deleted permanently")
        } finally {
          lock.current = false
          setSubmittingId(null)
        }
      },
      {
        onError: (err) => {
          const code = getApiErrorCode(err)
          if (code === "ORDER_NOT_FOUND" || code === "NOT_FOUND") {
            // Already gone (another admin / tab) — just drop the row.
            updateRejected(({ [order.id]: _gone, ...rest }) => rest)
            toast.info("This order was already deleted")
          } else if (code === "INVALID_STATE_TRANSITION") {
            updateRejected(({ [order.id]: _gone, ...rest }) => rest)
            toast.error("This order isn't rejected on the server, so it can't be deleted. Refresh and reject it first.")
            void refetch()
          } else {
            toast.error(errorText(err, "Couldn't delete this order."))
          }
        },
      },
    )
  }

  const visible = orders.filter((o) =>
    view === "stuck" ? STUCK_STATUSES.has(o.status) : view === "rejected" ? o.status === "rejected" : true,
  )
  const stuckRows = orders.filter((o) => STUCK_STATUSES.has(o.status))
  const rejectedCount = orders.filter((o) => o.status === "rejected").length
  const pendingPaise = stuckRows.reduce((sum, o) => sum + (o.amountPaise ?? 0), 0)
  const demoCount = stuckRows.filter((o) => isMockRazorpayOrder(o.razorpayOrderId)).length
  const paidCount = stuckRows.filter((o) => liveVerdict(o)?.tone === "success").length
  const hasLive = stuckRows.some((o) => o.live !== undefined)

  const columns: DataTableColumn<StuckOrder>[] = [
    {
      key: "user",
      header: "Member",
      render: (o) => (
        <div className="min-w-[170px] max-w-[230px] space-y-0.5 text-xs">
          <div className={o.userName ? "font-semibold text-brand-secondary" : "italic text-brand-secondary/50"}>{o.userName ?? "No name"}</div>
          {o.userMobile && <div className="text-brand-secondary/70">{o.userMobile}</div>}
          {o.userEmail && (
            <div className="truncate text-brand-secondary/55" title={o.userEmail}>
              {o.userEmail}
            </div>
          )}
          {o.userId && <UserLink id={o.userId} className="text-[10px] text-brand-secondary/40" />}
        </div>
      ),
    },
    {
      key: "plan",
      header: "Plan",
      sortable: true,
      sortValue: (o) => o.amountPaise ?? -1,
      render: (o) => (
        <div className="whitespace-nowrap text-xs">
          <div className="font-semibold capitalize text-brand-secondary">
            {o.planName ?? o.planTier ?? "—"} <span className="font-normal text-brand-secondary/40">·</span> {amountLabel(o)}
          </div>
          {o.purpose && <div className="capitalize text-brand-secondary/55">{o.purpose.replace(/^membership_/, "").replace(/_/g, " ")}</div>}
        </div>
      ),
    },
    {
      key: "razorpay",
      header: "Razorpay",
      render: (o) => <RazorpayRefs order={o} />,
    },
    {
      key: "stuck",
      header: "Waiting",
      sortable: true,
      // From createdAt, so rows kept locally after a reject sort correctly too.
      sortValue: (o) => (o.createdAt ? -new Date(o.createdAt).getTime() : -(Date.now() - (o.minutesStuck ?? 0) * 60_000)),
      render: (o) => (
        <div className="whitespace-nowrap text-xs">
          <div className={STUCK_STATUSES.has(o.status) ? "font-semibold text-red-600" : "font-semibold text-brand-secondary/60"}>{stuckFor(o.minutesStuck)}</div>
          <div className="text-brand-secondary/50">{formatDateTime(o.createdAt)}</div>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (o) => (
        <div className="max-w-[170px] space-y-1">
          <StatusPill tone={o.status === "failed" || o.status === "rejected" ? "danger" : DONE_STATUSES.has(o.status) ? "success" : "warning"}>
            {o.status.replace(/_/g, " ")}
          </StatusPill>
          {o.status === "rejected" && rejected[o.id]?.rejectionReason && (
            <div className="line-clamp-2 break-words text-[11px] text-brand-secondary/60" title={rejected[o.id].rejectionReason}>
              “{rejected[o.id].rejectionReason}”
            </div>
          )}
          <ShortId id={o.id} className="block text-[10px] text-brand-secondary/40" />
        </div>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      render: (o) => (
        <RowActions
          order={o}
          busy={!o.id || submittingId === o.id || stepUp.open}
          onActivate={() => setActivating(o)}
          onReject={() => {
            setRejectReason("")
            setRejecting(o)
          }}
          onDelete={() => setDeleting(o)}
        />
      ),
    },
  ]

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-3xl space-y-1">
          <p className="text-sm text-brand-secondary/75">
            Orders where checkout finished but Razorpay&apos;s confirmation (webhook) never arrived.
          </p>
          <p className="text-xs text-brand-secondary/55">
            The Razorpay column shows the live payment status → <b>Activate</b> if it&apos;s paid (same as a real webhook) · <b>Reject</b> with a reason if it
            never happened · <b>Delete</b> a rejected order permanently. Each needs a fresh authenticator code.
          </p>
        </div>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => refetch()} disabled={isFetching}>
          <RotateCcw className={isFetching ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} /> Refresh
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SummaryTile label="Stuck orders" value={data ? String(data.total) : "—"} hint={data && data.total > PAGE_SIZE ? `showing ${serverOrders.length}` : undefined} tone="warning" />
        {hasLive ? (
          <SummaryTile label="Paid on Razorpay" value={String(paidCount)} hint="captured — ready to activate" tone={paidCount ? "success" : undefined} />
        ) : (
          <SummaryTile label="Waiting to confirm" value={data ? formatPaise(pendingPaise) : "—"} hint="on this page" />
        )}
        <SummaryTile label="Demo orders" value={data ? String(demoCount) : "—"} hint="never sent to Razorpay — reject" />
        <SummaryTile label="Rejected" value={String(rejectedCount)} hint="can be deleted" tone={rejectedCount ? "danger" : undefined} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-brand-border pb-3">
        <div role="tablist" aria-label="Order view" className="inline-flex border border-brand-border bg-card p-0.5">
          {(
            [
              ["stuck", `Stuck (${stuckRows.length})`],
              ["rejected", `Rejected (${rejectedCount})`],
              ["all", `All (${orders.length})`],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              role="tab"
              aria-selected={view === value}
              onClick={() => setView(value)}
              className={
                view === value
                  ? "bg-brand-primary px-3 py-1.5 text-xs font-bold text-brand-secondary"
                  : "px-3 py-1.5 text-xs font-semibold text-brand-secondary/60 hover:text-brand-secondary"
              }
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setByIdOpen((o) => !o)} aria-expanded={byIdOpen}>
          <Search className="h-3.5 w-3.5" /> Order not listed? Find by id
        </Button>
        <Select
          value={age}
          onValueChange={(v) => {
            setAge(v)
            setPage(1)
          }}
        >
          <SelectTrigger size="sm" className="w-[220px] bg-card" aria-label="How long stuck">
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
        </div>
      </div>

      <OrderByIdPanel
        open={byIdOpen}
        onClose={() => setByIdOpen(false)}
        disabled={stepUp.open || !!submittingId}
        onActivate={(o) => setActivating(o)}
        onReject={(o) => {
          setRejectReason("")
          setRejecting(o)
        }}
      />

      <QueryState isLoading={isLoading} error={error} onRetry={refetch} isFetching={isFetching}>
        <DataTable
          columns={columns}
          rows={visible}
          rowKey={(o) => o.id}
          rowClassName={(o) => (o.status === "rejected" ? "bg-red-500/[0.04]" : undefined)}
          // Latest order on top (shortest wait first).
          defaultSortKey="stuck"
          defaultSortDirection="asc"
          pageSize={PAGE_SIZE}
          emptyLabel={
            view === "rejected"
              ? "No rejected orders on this device."
              : view === "stuck"
                ? "No stuck orders — every verified payment has been activated."
                : "Nothing to show."
          }
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

      <RejectionDialog
        open={!!rejecting}
        onOpenChange={(open) => !open && setRejecting(null)}
        title="Reject this order"
        description={
          rejecting
            ? `${rejecting.userName ?? rejecting.userMobile ?? rejecting.userEmail ?? "This user"} · ${rejecting.planName ?? rejecting.planTier ?? "plan"} · ${amountLabel(rejecting)}. Only reject if Razorpay shows no captured payment — the user won't get the plan.`
            : ""
        }
        reason={rejectReason}
        onReasonChange={setRejectReason}
        onConfirm={confirmReject}
        placeholder="e.g. No captured payment in Razorpay for this order"
        isSubmitting={!!rejecting && (submittingId === rejecting.id || stepUp.open)}
        confirmLabel="Reject order"
        maxLength={NOTE_MAX}
      />

      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this order permanently?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting
                ? `${deleting.userName ?? deleting.userMobile ?? deleting.userEmail ?? "This user"} · ${deleting.planName ?? deleting.planTier ?? "plan"} · ${amountLabel(deleting)}. `
                : ""}
              The rejected order is removed for good — this can&apos;t be undone. Needs your authenticator code.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">
              Delete permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <TotpStepUpDialog {...stepUp} />
    </div>
  )
}

/**
 * Orders the stuck list never shows — unpaid (`created`) ones, including
 * free ₹0 Mercury orders that can't complete on their own — still block
 * the member (409 ORDER_ALREADY_IN_PROGRESS). The website shows the member
 * their order id; paste it here to activate or reject it. There's no admin
 * "get order" API, so nothing about the order is shown beforehand — the
 * server validates the action.
 */
function OrderByIdPanel({
  open,
  onClose,
  disabled,
  onActivate,
  onReject,
}: {
  open: boolean
  onClose: () => void
  disabled: boolean
  onActivate: (order: StuckOrder) => void
  onReject: (order: StuckOrder) => void
}) {
  const [value, setValue] = useState("")
  const id = value.trim()
  const valid = /^[a-f0-9]{24}$/i.test(id)
  const asOrder = (): StuckOrder => ({
    id,
    status: "processing",
    purpose: null,
    amountPaise: null,
    planName: null,
    planTier: null,
    userId: null,
    userName: `Order ${id}`,
    userMobile: null,
    userEmail: null,
    razorpayOrderId: null,
    razorpayPaymentId: null,
    createdAt: null,
    minutesStuck: null,
    live: undefined,
  })

  if (!open) return null

  return (
    <div className="space-y-2 bg-card p-4 ring-1 ring-brand-border">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-semibold text-brand-secondary">Act on an order by id</div>
        <button type="button" onClick={onClose} className="text-xs text-brand-secondary/55 hover:text-brand-secondary">
          Close
        </button>
      </div>
      <p className="text-xs text-brand-secondary/60">
        For orders this list doesn&apos;t show — unpaid ones and free (₹0) Mercury requests — which still block the member from buying
        again. The member sees the order id on the plans page.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="24-character order id, e.g. 6ae57c014e71b00e807420e9"
          className="h-8 w-[340px] max-w-full font-mono text-xs"
          aria-label="Order id"
          autoComplete="off"
        />
        <Button size="sm" className="h-8 w-[76px] px-0 text-xs" disabled={disabled || !valid} onClick={() => onActivate(asOrder())}>
          Activate
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-8 w-[76px] border-red-300/60 px-0 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
          disabled={disabled || !valid}
          onClick={() => onReject(asOrder())}
        >
          Reject
        </Button>
      </div>
      {id && !valid && <p className="text-[11px] text-red-600">An order id is 24 characters, 0–9 and a–f.</p>}
    </div>
  )
}

type LiveVerdict = { label: string; tone: "success" | "warning" | "danger" | "neutral"; hint: string }

/**
 * One-word answer to "did the customer actually pay?", from Razorpay's live
 * data — what the admin used to check by hand in Razorpay's dashboard.
 */
function liveVerdict(order: StuckOrder): LiveVerdict | null {
  const live = order.live
  if (live === undefined) return null
  if (live === null) return { label: "Free — not on Razorpay", tone: "neutral", hint: "₹0 order, nothing to check on Razorpay" }
  if (live.fetchError) return { label: "Razorpay unreachable", tone: "neutral", hint: live.fetchError }
  const payments = live.payments
  if (payments.some((p) => p.status === "refunded" || (p.refundStatus && p.refundStatus !== "null")))
    return { label: "Refunded", tone: "danger", hint: "A payment was refunded — don't activate" }
  if (payments.some((p) => p.status === "captured") || live.orderStatus === "paid")
    return { label: "Paid on Razorpay", tone: "success", hint: "Payment captured — safe to activate" }
  if (payments.some((p) => p.status === "authorized"))
    return { label: "Authorized", tone: "warning", hint: "Bank approved but not captured yet — wait or capture in Razorpay" }
  if (payments.length > 0 && payments.every((p) => p.status === "failed"))
    return { label: "Payment failed", tone: "danger", hint: "Every attempt failed — the customer wasn't charged" }
  return { label: "Not paid", tone: "danger", hint: "No payment attempt on Razorpay — the customer wasn't charged" }
}

const VERDICT_CLASS: Record<LiveVerdict["tone"], string> = {
  success: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  warning: "bg-amber-500/15 text-amber-600",
  danger: "bg-red-500/15 text-red-600",
  neutral: "bg-brand-tertiary/60 text-brand-secondary/70",
}

const rupeesOrDash = (paise: number | null) => (paise == null ? "—" : formatPaise(paise))

/** Every payment attempt Razorpay has for the order — method, bank/UPI, error, fee, refund. */
function PaymentAttempts({ live }: { live: RazorpayLive }) {
  return (
    <ul className="mt-1 space-y-1.5 border-l border-brand-border pl-2 font-sans">
      {live.payments.map((p) => {
        const url = razorpayPaymentUrl(p.id)
        return (
          <li key={p.id} className="text-[10px] leading-snug text-brand-secondary/70">
            <div className="flex flex-wrap items-center gap-1">
              <span className={p.status === "captured" ? "font-bold text-emerald-600" : p.status === "failed" ? "font-bold text-red-600" : "font-bold text-amber-600"}>
                {p.status}
              </span>
              <span>· {[p.method, p.detail].filter(Boolean).join(" · ") || "method unknown"}</span>
              <span>· {rupeesOrDash(p.amountPaise)}</span>
              {p.feePaise != null && <span>· fee {formatPaise(p.feePaise)}</span>}
              {p.taxPaise != null && <span>(tax {formatPaise(p.taxPaise)})</span>}
            </div>
            <div className="font-mono">
              {url ? (
                <a href={url} target="_blank" rel="noopener noreferrer" className="text-brand-primary-dark hover:underline">
                  {p.id}
                </a>
              ) : (
                p.id
              )}
              {p.createdAt && <span className="font-sans text-brand-secondary/45"> · {formatDateTime(p.createdAt)}</span>}
            </div>
            {p.error && <div className="text-red-600/80">{p.error}</div>}
            {p.errorDetail && <div className="font-mono text-red-600/60">{p.errorDetail}</div>}
            {p.references.length > 0 && (
              <div className="font-mono text-brand-secondary/55">
                {p.references.map((r) => `${r.label}: ${r.value}`).join(" · ")}
              </div>
            )}
            {p.refundStatus && <div className="text-red-600/80">Refund: {p.refundStatus}</div>}
          </li>
        )
      })}
    </ul>
  )
}

function SummaryTile({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "warning" | "danger" | "success" }) {
  return (
    <div className="bg-card p-4 ring-1 ring-brand-border">
      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-muted-foreground">{label}</div>
      <div className={tone === "success" ? "mt-1 font-serif text-2xl font-bold text-emerald-600" : tone === "danger" ? "mt-1 font-serif text-2xl font-bold text-red-600" : tone === "warning" ? "mt-1 font-serif text-2xl font-bold text-amber-600" : "mt-1 font-serif text-2xl font-bold text-brand-secondary"}>
        {value}
      </div>
      {hint && <div className="mt-0.5 text-[11px] text-brand-secondary/50">{hint}</div>}
    </div>
  )
}

/**
 * Activate / Reject / Delete, enabled by the order's status (allowedActions)
 * and disabled for every button while an action on this row is running.
 * A disabled button's tooltip says why.
 */
function RowActions({
  order,
  busy,
  onActivate,
  onReject,
  onDelete,
}: {
  order: StuckOrder
  busy: boolean
  onActivate: () => void
  onReject: () => void
  onDelete: () => void
}) {
  const allowed = allowedActions(order)
  // A disabled <button> gets no hover events, so the tooltip sits on a wrapper.
  const wrap = (action: "activate" | "reject" | "delete", button: React.ReactNode) => (
    <span title={busy ? "Working…" : disabledReason(order, action)} className="inline-flex">
      {button}
    </span>
  )
  const base = "h-8 w-[76px] px-0 text-xs"
  return (
    <div className="flex justify-end gap-1.5">
      {wrap(
        "activate",
        <Button size="sm" disabled={busy || !allowed.activate} onClick={onActivate} className={`${base} disabled:opacity-30`}>
          Activate
        </Button>,
      )}
      {wrap(
        "reject",
        <Button
          size="sm"
          variant="outline"
          disabled={busy || !allowed.reject}
          onClick={onReject}
          className={`${base} border-red-300/60 text-red-600 hover:bg-red-50 disabled:opacity-30 dark:hover:bg-red-950/30`}
        >
          Reject
        </Button>,
      )}
      {wrap(
        "delete",
        <Button size="sm" variant="destructive" disabled={busy || !allowed.delete} onClick={onDelete} className={`${base} gap-1 disabled:opacity-30`}>
          {busy && allowed.delete && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Delete
        </Button>,
      )}
    </div>
  )
}

/**
 * Razorpay order / payment ids with links to their dashboard pages. The
 * order page lists every payment attempt with its id, status (captured,
 * failed…) and method — what the admin checks before activating. The live
 * payment status can't be shown here: reading it needs the Razorpay secret
 * key, which only the backend has.
 */
function RazorpayRefs({ order }: { order: StuckOrder }) {
  const [showAttempts, setShowAttempts] = useState(false)
  const orderUrl = razorpayOrderUrl(order.razorpayOrderId)
  const payment = primaryPayment(order.live)
  const paymentId = payment?.id ?? order.razorpayPaymentId
  const paymentUrl = razorpayPaymentUrl(paymentId)
  const demo = isMockRazorpayOrder(order.razorpayOrderId)
  const verdict = demo ? null : liveVerdict(order)
  const attempts = order.live?.payments.length ?? 0
  const link = "inline-flex items-center gap-1 text-brand-primary-dark underline-offset-2 hover:underline"
  return (
    <div className="min-w-[200px] max-w-[280px] space-y-1 font-mono text-[11px] text-brand-secondary/70">
      {verdict && (
        <span title={verdict.hint} className={`inline-block rounded-sm px-1.5 py-0.5 font-sans text-[10px] font-bold ${VERDICT_CLASS[verdict.tone]}`}>
          {verdict.label}
        </span>
      )}
      <div className="flex items-center gap-1.5" title="Razorpay order id">
        {orderUrl ? (
          <a href={orderUrl} target="_blank" rel="noopener noreferrer" className={link} title="Open this order in the Razorpay dashboard">
            {order.razorpayOrderId} <ExternalLink className="h-3 w-3 shrink-0" />
          </a>
        ) : (
          <span className={demo ? "text-brand-secondary/45" : undefined}>{order.razorpayOrderId ?? "—"}</span>
        )}
        {demo && (
          <span title="Created while the backend mocked Razorpay — never sent to Razorpay" className="shrink-0 rounded-sm bg-amber-500/15 px-1 font-sans text-[9px] font-bold uppercase tracking-wide text-amber-600">
            Demo
          </span>
        )}
      </div>
      {paymentId &&
        (paymentUrl ? (
          <a href={paymentUrl} target="_blank" rel="noopener noreferrer" className={link} title="Open this payment in the Razorpay dashboard">
            {paymentId} <ExternalLink className="h-3 w-3 shrink-0" />
          </a>
        ) : (
          <div title="Razorpay payment id">{paymentId}</div>
        ))}
      {payment && (
        <div className="font-sans text-[10px] text-brand-secondary/55">
          {[payment.method, payment.detail].filter(Boolean).join(" · ")}
          {payment.error && <span className="text-red-600/80"> — {payment.error}</span>}
        </div>
      )}
      {order.live && attempts > 0 && (
        <button type="button" onClick={() => setShowAttempts((v) => !v)} className="font-sans text-[10px] font-semibold text-brand-primary-dark hover:underline" aria-expanded={showAttempts}>
          {showAttempts ? "Hide" : "Show"} {attempts} payment attempt{attempts === 1 ? "" : "s"}
        </button>
      )}
      {showAttempts && order.live && <PaymentAttempts live={order.live} />}
      {!paymentId && orderUrl && order.live === undefined && (
        <div className="font-sans text-[10px] text-brand-secondary/45">Payment id: open the order in Razorpay</div>
      )}
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
  // Opened by order id (not from the list): the amount isn't known here.
  const unknownAmount = order.amountPaise == null
  const [paymentId, setPaymentId] = useState(order.razorpayPaymentId ?? "")
  const [note, setNote] = useState("")
  const trimmedId = paymentId.trim()
  // A paid order needs the Razorpay payment id the admin checked; a ₹0 order has none.
  const idError = !free && !unknownAmount && !trimmedId ? "Required for a paid order" : trimmedId && !PAYMENT_ID_RE.test(trimmedId) ? "Should look like pay_XXXXXXXXXXXXXX" : null
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
          {(() => {
            const v = liveVerdict(order)
            if (!v || v.tone === "success" || v.tone === "neutral") return null
            return (
              <p className="border border-red-200 bg-red-50 p-2 text-[11px] text-red-700">
                Razorpay says: <b>{v.label}</b> — {v.hint}. Only activate if you&apos;re sure the customer paid another way.
              </p>
            )
          })()}
          {unknownAmount ? (
            <p className="border border-amber-200 bg-amber-50 p-2 text-[11px] text-amber-800">
              Opened by order id, so the amount isn&apos;t shown. For a <b>paid</b> order enter the captured Razorpay payment id. Leave it
              empty only for a <b>free (₹0)</b> order — the server refuses an empty id for a paid one.
            </p>
          ) : free ? (
            <p className="border border-amber-200 bg-amber-50 p-2 text-[11px] text-amber-800">
              This is a ₹0 order — there is no Razorpay payment to check. Only activate it if this user should get the plan for free.
            </p>
          ) : (
            <p className="text-[11px] text-brand-secondary/65">
              {razorpayOrderUrl(order.razorpayOrderId) ? (
                <>
                  <a href={razorpayOrderUrl(order.razorpayOrderId)!} target="_blank" rel="noopener noreferrer" className="font-semibold text-brand-primary-dark underline">
                    Open order {order.razorpayOrderId} in Razorpay
                  </a>{" "}
                  (Test Mode for test payments), confirm a payment is <b>captured</b>, and copy its payment id below.
                </>
              ) : (
                <>
                  Find order <span className="font-mono">{order.razorpayOrderId ?? "—"}</span> in the Razorpay dashboard and confirm the
                  payment is <b>captured</b> before activating.
                </>
              )}
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
