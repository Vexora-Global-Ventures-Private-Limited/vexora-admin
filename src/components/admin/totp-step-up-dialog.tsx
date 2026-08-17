"use client"

import { ShieldAlert } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { OtpInputGroup } from "@/components/admin/otp-input-group"
import type { useStepUp } from "@/lib/use-step-up"

type TotpStepUpDialogProps = ReturnType<typeof useStepUp>

/** Re-verification modal for step-up-gated actions — see useStepUp for the trigger logic. */
export function TotpStepUpDialog({ open, code, setCode, confirm, cancel }: TotpStepUpDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && cancel()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <div className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-brand-primary/10 text-brand-primary-dark">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <DialogTitle className="text-center font-serif text-xl">Re-verify to continue</DialogTitle>
          <DialogDescription className="text-center">
            This action needs a fresh OTP — your last check was over 15 minutes ago.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-center py-2">
          <OtpInputGroup value={code} onChange={setCode} onComplete={confirm} />
        </div>
        <Button className="btn-gold w-full" disabled={code.length !== 6} onClick={confirm}>
          Verify &amp; continue
        </Button>
      </DialogContent>
    </Dialog>
  )
}
