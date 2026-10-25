"use client"

import { Loader2, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getApiErrorMessage } from "@/lib/api-error"
import { NotAvailableYet, QueryState, isNotImplemented } from "@/components/admin/moderation/shared"
import { useGetBadgeQueuesQuery, useGetKycQueueQuery } from "./kyc-api"

/**
 * Live status of the G5 queues. While the backend answers 501, this shows
 * that honestly (with the server's own message) instead of mock submissions
 * and fake approve/reject/revoke buttons. If the backend starts returning
 * real data, it says so — the review UI still needs building against the
 * real shape at that point.
 */
export function KycQueuesStatus() {
  const kyc = useGetKycQueueQuery(undefined, { refetchOnMountOrArgChange: true })
  const badges = useGetBadgeQueuesQuery(undefined, { refetchOnMountOrArgChange: true })

  return (
    <div className="space-y-4">
      <QueueStatus title="KYC review queue" query={kyc} />
      <QueueStatus title="Badge queues" query={badges} />
    </div>
  )
}

function QueueStatus({
  title,
  query,
}: {
  title: string
  query: { isLoading: boolean; isFetching: boolean; error?: unknown; data?: unknown; refetch: () => void }
}) {
  const { isLoading, isFetching, error, data, refetch } = query

  if (error && isNotImplemented(error)) {
    return (
      <NotAvailableYet
        title={`${title} — not available yet`}
        message={`The server says: “${getApiErrorMessage(error) ?? "Not implemented"}”. Approving KYC, granting and revoking badges can't be done until the backend ships this.`}
      >
        <Button size="sm" variant="outline" className="mt-4 gap-1.5" onClick={refetch} disabled={isFetching}>
          {isFetching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />} Check again
        </Button>
      </NotAvailableYet>
    )
  }

  return (
    <QueryState isLoading={isLoading} error={error} onRetry={refetch} isFetching={isFetching} rows={2}>
      <NotAvailableYet
        title={`${title} — the backend now responds`}
        message="This queue returned data instead of “not implemented”. The review screen hasn't been built against the real response yet — nothing can be approved from here until it is."
      >
        <pre className="mx-auto mt-4 max-h-48 max-w-full overflow-auto bg-brand-tertiary/40 p-3 text-left text-[10px]">
          {JSON.stringify(data, null, 2).slice(0, 2000)}
        </pre>
      </NotAvailableYet>
    </QueryState>
  )
}
