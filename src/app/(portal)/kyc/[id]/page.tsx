"use client"

import { use } from "react"
import { DetailBackLink } from "@/components/admin/detail-page-shell"
import { NotAvailableYet } from "@/components/admin/moderation/shared"
import { ROUTES } from "@/lib/routes"

/** KYC submission detail — the backend has no KYC review endpoints yet (501), so there's nothing to load. */
export default function KycDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return (
    <div className="max-w-2xl space-y-6">
      <DetailBackLink href={ROUTES.kyc} label="KYC & badges" />
      <NotAvailableYet
        title="KYC review isn't available yet"
        message={`Submission ${id} can't be loaded: the admin KYC endpoints still return “not implemented” on the API.`}
      />
    </div>
  )
}
