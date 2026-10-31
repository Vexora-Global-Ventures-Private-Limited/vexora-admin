"use client"

import { use, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Check, Loader2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
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
import { DetailBackLink, DetailCard } from "@/components/admin/detail-page-shell"
import { RejectionDialog } from "@/components/admin/rejection-dialog"
import { StatusPill } from "@/components/admin/status-pill"
import { Fact, NotAvailableYet, QueryState, UserLink, errorText, formatDateTime } from "@/components/admin/moderation/shared"
import { BADGE_LABEL, useApproveKycMutation, useGetKycQueueQuery, useRejectKycMutation } from "@/components/admin/kyc/kyc-api"
import { KycDocumentTile, useCanReviewKyc } from "@/components/admin/kyc/kyc-shared"
import { getApiErrorCode } from "@/lib/api-error"
import { ROUTES } from "@/lib/routes"

/**
 * One KYC submission. There's no GET-by-id endpoint, so it's read from the
 * pending queue — a submission that's already been approved/rejected (here
 * or by another admin) is no longer in it.
 */
export default function KycDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { data, isLoading, isFetching, error, refetch } = useGetKycQueueQuery(undefined, { refetchOnMountOrArgChange: true })
  const [approve, approveState] = useApproveKycMutation()
  const [reject, rejectState] = useRejectKycMutation()
  const canReview = useCanReviewKyc()
  const [confirmApprove, setConfirmApprove] = useState(false)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [reason, setReason] = useState("")
  const busy = approveState.isLoading || rejectState.isLoading
  const submission = data?.find((s) => s.id === id)

  const done = (message: string) => {
    toast.success(message)
    router.push(ROUTES.kyc)
  }
  const failed = (err: unknown, fallback: string) =>
    toast.error(getApiErrorCode(err) === "CONFLICT" || (err as { status?: number })?.status === 409 ? "Already reviewed by someone else." : errorText(err, fallback))

  const doApprove = async () => {
    try {
      await approve(id).unwrap()
      done(`Approved — ${BADGE_LABEL[submission?.targetBadge ?? ""] ?? "badge"} granted.`)
    } catch (err) {
      failed(err, "Couldn't approve this submission.")
    }
  }

  const doReject = async () => {
    if (!reason.trim()) return
    try {
      await reject({ id, reason: reason.trim() }).unwrap()
      setRejectOpen(false)
      done("Rejected — the member can fix it and resubmit.")
    } catch (err) {
      failed(err, "Couldn't reject this submission.")
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <DetailBackLink href={ROUTES.kyc} label="KYC & badges" />
      <QueryState isLoading={isLoading} error={error} onRetry={refetch} isFetching={isFetching} rows={3}>
        {!submission ? (
          <NotAvailableYet title="Not in the review queue" message="This submission was already approved or rejected, or the link is wrong." />
        ) : (
          <>
            <DetailCard>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h1 className="font-serif text-xl font-bold text-brand-secondary">{submission.userName ?? "KYC submission"}</h1>
                  <div className="mt-1 text-xs text-brand-secondary/60">
                    {[submission.userMobile, submission.userEmail].filter(Boolean).join(" · ")}
                  </div>
                  {submission.userId && <UserLink id={submission.userId} className="text-xs text-brand-secondary/50" />}
                </div>
                <StatusPill tone="warning">{submission.status.replace(/_/g, " ")}</StatusPill>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                <Fact label="Applying for" value={BADGE_LABEL[submission.targetBadge ?? ""] ?? submission.targetBadge ?? "—"} />
                <Fact label="Submitted" value={formatDateTime(submission.submittedAt)} />
                {submission.tier && <Fact label="Tier" value={<span className="capitalize">{submission.tier}</span>} />}
              </div>
            </DetailCard>

            <DetailCard>
              <h2 className="font-serif text-base font-bold text-brand-secondary">Documents</h2>
              <p className="mt-1 text-xs text-brand-secondary/60">Check each document matches the member's name and is legible. Click to open full size.</p>
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {submission.documents.map((d, i) => (
                  <KycDocumentTile key={`${d.type}-${i}`} doc={d} />
                ))}
              </div>
            </DetailCard>

            {canReview ? (
              <div className="flex flex-wrap gap-2">
                <Button className="btn-gold gap-1.5" disabled={busy} onClick={() => setConfirmApprove(true)}>
                  {approveState.isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Approve
                </Button>
                <Button
                  variant="outline"
                  className="gap-1.5 border-red-200 text-red-600 hover:bg-red-50"
                  disabled={busy}
                  onClick={() => {
                    setReason("")
                    setRejectOpen(true)
                  }}
                >
                  <X className="h-4 w-4" /> Reject
                </Button>
              </div>
            ) : (
              <p className="text-xs text-brand-secondary/60">Only super admins and moderators can approve or reject KYC.</p>
            )}

            <AlertDialog open={confirmApprove} onOpenChange={setConfirmApprove}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Approve and grant the {BADGE_LABEL[submission.targetBadge ?? ""] ?? "badge"}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    {submission.userName ?? "This member"} gets the badge on their profile and listings straight away. It can be revoked
                    later from their user page.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => void doApprove()}>Approve</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <RejectionDialog
              open={rejectOpen}
              onOpenChange={setRejectOpen}
              title="Reject this KYC submission"
              description="The member sees your reason and can upload corrected documents."
              reason={reason}
              onReasonChange={setReason}
              onConfirm={() => void doReject()}
              placeholder="e.g. PAN card photo is blurry — please upload a clearer one"
              isSubmitting={rejectState.isLoading}
              confirmLabel="Reject submission"
            />
          </>
        )}
      </QueryState>
    </div>
  )
}
