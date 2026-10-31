"use client"

import { useState } from "react"
import { toast } from "sonner"
import { BadgeCheck, Loader2 } from "lucide-react"
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
import { DetailCard } from "@/components/admin/detail-page-shell"
import { TotpStepUpDialog } from "@/components/admin/totp-step-up-dialog"
import { errorText, formatDate } from "@/components/admin/moderation/shared"
import { BADGE_LABEL, useGetUserBadgesQuery, useRevokeBadgeMutation } from "@/components/admin/kyc/kyc-api"
import { useIsSuperAdmin } from "@/components/admin/config/config-helpers"
import { useStepUp } from "@/lib/use-step-up"

/**
 * The user's current trust badge (GET /users/{id}/badges — at most one) and
 * the manual fraud-case revoke (super_admin + ⚠ step-up). Granting only
 * ever happens through KYC approval.
 */
export function UserBadgeCard({ userId, label }: { userId: string; label: string }) {
  const { data: badges, isLoading, isError, refetch } = useGetUserBadgesQuery(userId)
  const [revoke, revokeState] = useRevokeBadgeMutation()
  const canRevoke = useIsSuperAdmin()
  const stepUp = useStepUp()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const badge = badges?.[0]
  const badgeName = badge ? (BADGE_LABEL[badge.type] ?? badge.type) : null

  const doRevoke = () => {
    setConfirmOpen(false)
    stepUp.run(() => revoke(userId).unwrap(), {
      onSuccess: () => toast.success(`${badgeName} badge revoked`, { description: "Their listings are being re-indexed without it." }),
      onError: (err) => toast.error(errorText(err, "Couldn't revoke the badge.")),
    })
  }

  return (
    <DetailCard>
      <h3 className="font-serif text-base font-bold text-brand-secondary">Trust badge</h3>
      {isLoading ? (
        <p className="mt-2 text-sm text-brand-muted-foreground">Loading…</p>
      ) : isError ? (
        <p className="mt-2 text-sm text-brand-muted-foreground">
          Couldn&apos;t load the badge.{" "}
          <button className="font-semibold underline" onClick={() => refetch()}>
            Retry
          </button>
        </p>
      ) : badge ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm">
            <BadgeCheck className="h-5 w-5 text-brand-primary-dark" />
            <span className="font-semibold text-brand-secondary">{badgeName}</span>
            {badge.grantedAt && <span className="text-xs text-brand-secondary/55">since {formatDate(badge.grantedAt)}</span>}
          </div>
          {canRevoke && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 border-red-200 text-red-600 hover:bg-red-50"
              disabled={revokeState.isLoading || stepUp.open}
              onClick={() => setConfirmOpen(true)}
            >
              {revokeState.isLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Revoke badge
            </Button>
          )}
        </div>
      ) : (
        <p className="mt-2 text-sm text-brand-muted-foreground">No badge. Badges are granted by approving a KYC submission.</p>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke {label}&apos;s {badgeName} badge?</AlertDialogTitle>
            <AlertDialogDescription>
              Use this when fraud is discovered. The badge disappears from their profile and listings. They&apos;d need to pass KYC
              again to get it back. Needs a fresh authenticator code.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={doRevoke} className="bg-red-600 hover:bg-red-700">
              Revoke
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <TotpStepUpDialog {...stepUp} />
    </DetailCard>
  )
}
