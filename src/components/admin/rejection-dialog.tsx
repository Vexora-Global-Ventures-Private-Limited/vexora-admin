"use client"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"

type RejectionDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  reason: string
  onReasonChange: (value: string) => void
  onConfirm: () => void
  placeholder?: string
}

/** Shared reason-capture dialog for reject flows (listings, ads, KYC) — the
 *  dialog's own confirm button is the action's confirmation, so callers
 *  should not additionally wrap the trigger in an AlertDialog. */
export function RejectionDialog({
  open,
  onOpenChange,
  title,
  description,
  reason,
  onReasonChange,
  onConfirm,
  placeholder,
}: RejectionDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl">{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <Textarea
          rows={3}
          value={reason}
          onChange={(e) => onReasonChange(e.target.value)}
          placeholder={placeholder}
          aria-label="Rejection reason"
        />
        <Button variant="destructive" className="w-full" onClick={onConfirm}>
          Confirm rejection
        </Button>
      </DialogContent>
    </Dialog>
  )
}
