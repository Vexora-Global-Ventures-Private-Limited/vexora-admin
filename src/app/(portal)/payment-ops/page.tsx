"use client"

import { BackendPendingCard } from "@/components/admin/dashboard/backend-pending-card"
import { useProbeStuckOrdersQuery } from "@/components/admin/dashboard/pending-endpoints"

/**
 * G3 — stuck orders + manual activation. GET /admin/payment-ops/stuck is
 * still a 501 placeholder and the manual-activation route was never built
 * (KNOWN-ISSUES.md #25), so there is nothing real to list or act on yet.
 */
export default function PaymentOpsPage() {
  const { data, error, isLoading, refetch } = useProbeStuckOrdersQuery()
  return (
    <div className="space-y-4">
      <p className="text-sm text-brand-secondary/60">
        Orders stuck in <code>processing</code>/<code>failed</code> for more than 10 minutes, and the manual-activation override.
      </p>
      <BackendPendingCard
        title="Payment ops isn't available yet"
        description="The backend hasn't built the stuck-orders queue or the manual-activation action (Stage 9). Until it does, stuck orders can only be fixed by the backend team."
        isLoading={isLoading}
        error={error}
        data={data}
        onRetry={refetch}
      />
    </div>
  )
}
