"use client"

import { ShieldAlert } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { OtpInputGroup, RecoveryCodeInput } from "@/components/admin/otp-input-group"
import type { useStepUp } from "@/lib/use-step-up"

type TotpStepUpDialogProps = ReturnType<typeof useStepUp>

/** Re-verification modal for step-up-gated actions — see useStepUp for the trigger logic. */
export function TotpStepUpDialog({
  open,
  code,
  setCode,
  recoveryCode,
  setRecoveryCode,
  mode,
  setMode,
  confirm,
  cancel,
  isVerifying,
  error,
  reason,
}: TotpStepUpDialogProps) {
  const canSubmit = mode === "totp" ? code.length === 6 : recoveryCode.length > 0

  return (
    <Dialog open={open} onOpenChange={(o) => !o && cancel()}>
      <DialogContent
        className="max-w-sm"
        // Don't let Escape / an outside click abandon a verify that's already in flight.
        onEscapeKeyDown={(e) => isVerifying && e.preventDefault()}
        onInteractOutside={(e) => isVerifying && e.preventDefault()}
      >
        <DialogHeader>
          <div className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-brand-primary/10 text-brand-primary-dark">
            <ShieldAlert aria-hidden className="h-5 w-5" />
          </div>
          <DialogTitle className="text-center font-serif text-xl">Re-verify to continue</DialogTitle>
          <DialogDescription className="text-center">
            {mode === "recovery"
              ? "Enter one of your one-time recovery codes. It will be used up."
              : reason === "server"
                ? "The server asked for a fresh code before this action — enter the current one from your authenticator."
                : "This action needs a fresh code — your last check was over 15 minutes ago."}
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void confirm()
          }}
        >
          <div className="flex justify-center py-2">
            {mode === "totp" ? (
              <OtpInputGroup
                value={code}
                onChange={setCode}
                onComplete={(v) => void confirm(v)}
                disabled={isVerifying}
                invalid={!!error}
              />
            ) : (
              <RecoveryCodeInput value={recoveryCode} onChange={setRecoveryCode} onSubmit={() => void confirm()} disabled={isVerifying} />
            )}
          </div>
          {error && (
            <p role="alert" className="text-center text-xs font-semibold text-red-600">
              {error}
            </p>
          )}
          <Button type="submit" className="btn-gold mt-3 w-full" disabled={!canSubmit || isVerifying}>
            {isVerifying ? "Verifying…" : "Verify & continue"}
          </Button>
        </form>
        <button
          type="button"
          disabled={isVerifying}
          onClick={() => setMode(mode === "totp" ? "recovery" : "totp")}
          className="mx-auto text-[11px] font-semibold text-brand-primary-dark hover:underline disabled:opacity-50"
        >
          {mode === "totp" ? "Lost your device? Use a recovery code" : "Use my authenticator code instead"}
        </button>
      </DialogContent>
    </Dialog>
  )
}
