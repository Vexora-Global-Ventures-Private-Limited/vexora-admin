"use client"

import Link from "next/link"
import { ScrollText, Wallet } from "lucide-react"
import { NotAvailableYet } from "@/components/admin/moderation/shared"
import { useAdminSession } from "@/lib/admin-session"
import { ROUTES } from "@/lib/routes"

/**
 * G10 — payment log + manual refund notes. GET /admin/payments was a 501
 * placeholder and has been dropped from the API spec (2026-10-31), and the
 * refund-note route was never built — so nothing is requested here. Stuck
 * orders (activate / reject) live in Payment ops; the audit log is real.
 */
export default function PaymentsPage() {
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
      <NotAvailableYet
        title="Payment log isn't available"
        message="The backend has no payment-log or refund-note API — the old placeholder was removed from the API. Payments still happen; they just can't be listed here."
      >
        <Link href={ROUTES.paymentOps} className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-brand-primary-dark hover:underline">
          <Wallet className="h-3.5 w-3.5" aria-hidden /> Stuck orders are in Payment ops →
        </Link>
      </NotAvailableYet>
    </div>
  )
}
