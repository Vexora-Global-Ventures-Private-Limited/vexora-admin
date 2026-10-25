"use client"

import Link from "next/link"
import { ScrollText } from "lucide-react"
import { BackendPendingCard } from "@/components/admin/dashboard/backend-pending-card"
import { useProbePaymentsQuery } from "@/components/admin/dashboard/pending-endpoints"
import { useAdminSession } from "@/lib/admin-session"
import { ROUTES } from "@/lib/routes"

/**
 * G10 — payment log + manual refund notes. GET /admin/payments (and the
 * refund-note route) are still 501 placeholders on the backend, so no
 * payment rows or note actions are shown. The audit log is real.
 */
export default function PaymentsPage() {
  const { data, error, isLoading, refetch } = useProbePaymentsQuery()
  const isSuperAdmin = useAdminSession((s) => s.adminUser?.role === "super_admin")

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-brand-secondary/60">All payments, with manual-only refund notes (no automated refund engine).</p>
        {isSuperAdmin && (
          <Link href={ROUTES.audit} className="flex items-center gap-1.5 text-xs font-semibold text-brand-primary-dark hover:underline">
            <ScrollText className="h-3.5 w-3.5" aria-hidden /> View audit log →
          </Link>
        )}
      </div>
      <BackendPendingCard
        title="Payment log isn't available yet"
        description="The backend hasn't built the payment log or refund notes (Stage 9). Payments still happen — they just can't be listed here yet."
        isLoading={isLoading}
        error={error}
        data={data}
        onRetry={refetch}
      />
    </div>
  )
}
