"use client"

import { useId, useRef, useState } from "react"
import { toast } from "sonner"
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Loader2, RotateCcw, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DataTable, type DataTableColumn } from "@/components/admin/data-table"
import { StatusPill } from "@/components/admin/status-pill"
import { TotpStepUpDialog } from "@/components/admin/totp-step-up-dialog"
import { QueryState, ShortId, UserLink, errorText, formatDateTime } from "@/components/admin/moderation/shared"
import { useStepUp } from "@/lib/use-step-up"
import { getApiErrorCode } from "@/lib/api-error"
import {
  useGetAbuseReportsQuery,
  useResolveAbuseReportMutation,
  type AbuseAction,
  type AbuseReport,
  type AbuseResolveResult,
  type AbuseStatus,
} from "@/store/api/adminApi"

const PAGE_SIZE = 20
const NOTE_MAX = 1000
const STATUSES: AbuseStatus[] = ["open", "in_review", "resolved", "dismissed"]
// Verified live: with no filter[status] the API returns only reports that
// still need action (open + in_review) — closed ones only come back when
// asked for explicitly. So the default option is labelled for what it is.
const NEEDS_ACTION = "needs_action"

const ACTIONS: { value: AbuseAction; label: string; needs?: "listing" | "user" }[] = [
  { value: "none", label: "No action — close the report" },
  { value: "warning", label: "Warning" },
  { value: "listing_hidden", label: "Hide listing", needs: "listing" },
  { value: "listing_removed", label: "Remove listing", needs: "listing" },
  { value: "user_suspended", label: "Suspend user", needs: "user" },
]

const STATUS_TONE: Record<string, "danger" | "warning" | "success" | "neutral"> = {
  open: "danger",
  in_review: "warning",
  resolved: "success",
  dismissed: "neutral",
}


const isClosed = (r: AbuseReport) => r.status === "resolved" || r.status === "dismissed"
const isBreached = (r: AbuseReport) => !isClosed(r) && new Date(r.slaDueAt).getTime() < Date.now()

/**
 * G9 abuse queue. Resolving is ⚠ step-up gated, and the report and the
 * enforcement are two separate facts: the report is ALWAYS closed, the
 * consequence (suspend/remove) is best-effort — so every resolve shows
 * `enforcement.done` explicitly, and a failure is surfaced as "handle
 * manually", never hidden behind a success toast.
 */
export default function AbusePage() {
  const [statusFilter, setStatusFilter] = useState<string>(NEEDS_ACTION)
  const [page, setPage] = useState(1)
  const { data, isLoading, isFetching, error, refetch } = useGetAbuseReportsQuery(
    { status: statusFilter === NEEDS_ACTION ? undefined : (statusFilter as AbuseStatus), page, limit: PAGE_SIZE },
    { refetchOnMountOrArgChange: true },
  )
  const [resolveReport] = useResolveAbuseReportMutation()
  const stepUp = useStepUp()
  const lock = useRef(false)
  const [submittingId, setSubmittingId] = useState<string | null>(null)
  const [resolving, setResolving] = useState<AbuseReport | null>(null)
  const [lastResult, setLastResult] = useState<AbuseResolveResult | null>(null)

  const reports = data?.reports ?? []
  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1

  const submit = (report: AbuseReport, action: AbuseAction, note: string) => {
    if (lock.current) return
    // The dialog stays open until the resolve succeeds — if the step-up code
    // prompt is cancelled, the chosen action and note are still there.
    stepUp.run(
      async () => {
        lock.current = true
        setSubmittingId(report._id)
        try {
          const result = await resolveReport({ id: report._id, action, note: note.trim() || undefined }).unwrap()
          setLastResult(result)
          setResolving(null)
          // Resolving the last row of a later page would leave an empty page behind.
          if (reports.length === 1 && page > 1) setPage((p) => p - 1)
          if (result.enforcement && !result.enforcement.done) {
            toast.warning("Report resolved — but enforcement failed", { description: "Handle the action manually. Details are shown above the queue." })
          } else {
            toast.success("Report resolved", { description: action === "none" ? "Closed with no action." : `Action applied: ${action.replace(/_/g, " ")}.` })
          }
        } finally {
          lock.current = false
          setSubmittingId(null)
        }
      },
      {
        onError: (err) => {
          if (getApiErrorCode(err) === "ALREADY_RESOLVED") {
            toast.info("This report was already closed", { description: "The queue has been refreshed." })
            setResolving(null)
            refetch()
            return
          }
          toast.error(errorText(err, "Couldn't resolve this report."))
        },
      },
    )
  }

  const columns: DataTableColumn<AbuseReport>[] = [
    {
      key: "target",
      header: "Reported",
      render: (r) => (
        <div className="space-y-0.5 text-xs">
          {r.listingId && (
            <div>
              Listing <ShortId id={r.listingId} />
            </div>
          )}
          {r.reportedUserId && (
            <div>
              User <UserLink id={r.reportedUserId} />
            </div>
          )}
          {!r.listingId && !r.reportedUserId && <span className="text-brand-secondary/50">—</span>}
        </div>
      ),
    },
    {
      key: "reason",
      header: "Reason",
      sortable: true,
      sortValue: (r) => r.reason,
      render: (r) => (
        <div className="max-w-[280px]">
          <div className="break-words text-xs font-semibold text-brand-secondary">{r.reason}</div>
          {r.details && <div className="mt-0.5 line-clamp-2 break-words text-[11px] text-brand-secondary/60" title={r.details}>{r.details}</div>}
        </div>
      ),
    },
    { key: "reporter", header: "Reporter", render: (r) => <UserLink id={r.reporterId} className="text-brand-secondary/60" /> },
    {
      key: "sla",
      header: "SLA due",
      sortable: true,
      sortValue: (r) => r.slaDueAt,
      render: (r) => (
        <span className={isBreached(r) ? "whitespace-nowrap text-xs font-bold text-red-600" : "whitespace-nowrap text-xs text-brand-secondary/55"}>
          {formatDateTime(r.slaDueAt)}
          {isBreached(r) && " · breached"}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      sortValue: (r) => r.status,
      render: (r) => (
        <div>
          <StatusPill tone={STATUS_TONE[r.status] ?? "neutral"}>{(r.status || "unknown").replace(/_/g, " ")}</StatusPill>
          {r.actionTaken && <div className="mt-0.5 text-[10px] text-brand-secondary/55">action: {r.actionTaken.replace(/_/g, " ")}</div>}
          {r.resolvedAt && <div className="mt-0.5 whitespace-nowrap text-[10px] text-brand-secondary/45">{formatDateTime(r.resolvedAt)}</div>}
          {r.resolutionNote && <div className="mt-0.5 line-clamp-2 max-w-[200px] text-[10px] text-brand-secondary/50" title={r.resolutionNote}>“{r.resolutionNote}”</div>}
        </div>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      render: (r) =>
        isClosed(r) ? null : (
          <Button size="sm" disabled={submittingId === r._id} onClick={() => setResolving(r)} className="gap-1">
            {submittingId === r._id && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Resolve
          </Button>
        ),
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-brand-secondary/60">Reports from buyers, oldest SLA first. Resolving needs a fresh authenticator code.</p>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => refetch()} disabled={isFetching}>
          <RotateCcw className={isFetching ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} /> Refresh
        </Button>
      </div>

      {lastResult && <EnforcementBanner result={lastResult} onDismiss={() => setLastResult(null)} />}

      <Select
        value={statusFilter}
        onValueChange={(v) => {
          setStatusFilter(v)
          setPage(1)
        }}
      >
        <SelectTrigger size="sm" className="w-[230px] bg-card" aria-label="Status">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NEEDS_ACTION}>Needs action (open + in review)</SelectItem>
          {STATUSES.map((st) => (
            <SelectItem key={st} value={st}>
              {st.replace(/_/g, " ")}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <QueryState isLoading={isLoading} error={error} onRetry={refetch} isFetching={isFetching}>
        <DataTable
          columns={columns}
          rows={reports}
          rowKey={(r) => r._id}
          defaultSortKey="sla"
          defaultSortDirection="asc"
          pageSize={PAGE_SIZE}
          emptyLabel={statusFilter === NEEDS_ACTION ? "Nothing needs action — no open or in-review reports." : `No ${statusFilter.replace(/_/g, " ")} reports.`}
        />
        {data && data.total > PAGE_SIZE && (
          <div className="flex items-center justify-between text-xs text-brand-muted-foreground">
            <span>
              Page {page} of {totalPages} · {data.total} reports
            </span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={page <= 1 || isFetching} onClick={() => setPage((p) => Math.max(1, p - 1))} className="gap-1">
                <ChevronLeft className="h-3.5 w-3.5" /> Prev
              </Button>
              <Button size="sm" variant="outline" disabled={!data.hasMore || isFetching} onClick={() => setPage((p) => p + 1)} className="gap-1">
                Next <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </QueryState>

      {resolving && (
        <ResolveDialog
          key={resolving._id}
          report={resolving}
          submitting={submittingId === resolving._id}
          onClose={() => setResolving(null)}
          onSubmit={submit}
        />
      )}

      <TotpStepUpDialog {...stepUp} />
    </div>
  )
}

function EnforcementBanner({ result, onDismiss }: { result: AbuseResolveResult; onDismiss: () => void }) {
  const failed = result.enforcement && !result.enforcement.done
  const action = result.enforcement?.action ?? result.report.actionTaken ?? "none"
  // No enforcement block at all for a real action: don't claim it was applied.
  const unreported = !result.enforcement && action !== "none"
  return (
    <div role="status" className={`flex items-start gap-3 border p-3 text-sm ${failed ? "border-red-300 bg-red-50 text-red-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>
      {failed ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />}
      <div className="min-w-0 flex-1">
        {failed ? (
          <>
            <b>Report resolved, but enforcement failed — handle manually.</b> The “{action.replace(/_/g, " ")}” action didn&apos;t
            complete{result.enforcement?.error ? `: ${result.enforcement.error}` : "."}
          </>
        ) : (
          <>
            Report <span className="font-mono text-xs">…{result.report._id.slice(-6)}</span> resolved —{" "}
            {action === "none"
              ? "closed with no action."
              : unreported
                ? `“${action.replace(/_/g, " ")}” requested — the server didn't report whether it was applied; verify it manually.`
                : `“${action.replace(/_/g, " ")}” applied.`}
          </>
        )}
      </div>
      <button type="button" onClick={onDismiss} aria-label="Dismiss" className="shrink-0 opacity-60 hover:opacity-100">
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}

function ResolveDialog({
  report,
  submitting,
  onClose,
  onSubmit,
}: {
  report: AbuseReport
  submitting: boolean
  onClose: () => void
  onSubmit: (report: AbuseReport, action: AbuseAction, note: string) => void
}) {
  const id = useId()
  const [action, setAction] = useState<AbuseAction>("none")
  const [note, setNote] = useState("")
  const available = (a: (typeof ACTIONS)[number]) =>
    !a.needs || (a.needs === "listing" ? !!report.listingId : !!report.reportedUserId)

  return (
    <Dialog open onOpenChange={(o) => !o && !submitting && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl">Resolve report</DialogTitle>
          <DialogDescription className="break-words">
            “{report.reason}” — the report is always closed; the consequence below is applied on a best-effort basis.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            if (!submitting) onSubmit(report, action, note)
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-action`} className="text-xs font-semibold">Action</Label>
            <Select value={action} onValueChange={(v) => setAction(v as AbuseAction)} disabled={submitting}>
              <SelectTrigger id={`${id}-action`} className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ACTIONS.map((a) => (
                  <SelectItem key={a.value} value={a.value} disabled={!available(a)}>
                    {a.label}
                    {!available(a) && (a.needs === "user" ? " (no user named)" : " (no listing named)")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {(action === "listing_hidden" || action === "listing_removed") && (
              <p className="text-[11px] text-brand-secondary/60">
                Today “hide” and “remove” do the same thing — both take the listing off the platform (no separate hidden state yet).
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-note`} className="text-xs font-semibold">Note (optional)</Label>
            <Textarea id={`${id}-note`} rows={3} value={note} maxLength={NOTE_MAX} disabled={submitting} onChange={(e) => setNote(e.target.value)} placeholder="What you found / why this action" />
            <p className="text-right text-[11px] text-brand-muted-foreground">{note.length}/{NOTE_MAX}</p>
          </div>
          {action === "user_suspended" && (
            <p className="text-[11px] text-red-700">This suspends the reported user&apos;s account — they can&apos;t sign in or refresh their session (an already-issued token keeps working for up to 15 minutes).</p>
          )}
          <Button type="submit" className="btn-gold w-full gap-1.5" disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {submitting ? "Resolving…" : "Resolve report"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
