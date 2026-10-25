"use client"

import { KycQueuesStatus } from "@/components/admin/kyc/kyc-status"

/**
 * G5 KYC + badges. The admin queue endpoints still return 501 on the API, so
 * this page reports that live instead of showing mock submissions.
 */
export default function KycPage() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-brand-secondary/60">
        Review KYC documents and manage Verified / Verified Developer badges. Badges are only ever granted through KYC approval.
      </p>
      <KycQueuesStatus />
    </div>
  )
}
