"use client"

import { useId } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

const DEFAULT_MAX_LENGTH = 500

type RejectionDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  reason: string
  onReasonChange: (value: string) => void
  onConfirm: () => void
  placeholder?: string
  /** Disables the form and shows a spinner while the request is in flight. */
  isSubmitting?: boolean
  confirmLabel?: string
  label?: string
  maxLength?: number
}

/**
 * Shared reason-capture dialog for reject/remove flows (listings, ads) — the
 * dialog's own confirm button is the action's confirmation, so callers
 * should not additionally wrap the trigger in an AlertDialog.
 *
 * The reason is genuinely required: the backend rejects empty and
 * whitespace-only reasons, so confirm stays disabled until there's real text.
 */
export function RejectionDialog({
  open,
  onOpenChange,
  title,
  description,
  reason,
  onReasonChange,
  onConfirm,
  placeholder,
  isSubmitting = false,
  confirmLabel = "Confirm rejection",
  label = "Reason",
  maxLength = DEFAULT_MAX_LENGTH,
}: RejectionDialogProps) {
  const id = useId()
  const trimmed = reason.trim()
  const canConfirm = trimmed.length > 0 && !isSubmitting

  return (
    <Dialog open={open} onOpenChange={(o) => !isSubmitting && onOpenChange(o)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl">{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            if (canConfirm) onConfirm()
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-reason`} className="text-xs font-semibold">
              {label} <span className="text-red-600">*</span>
            </Label>
            <Textarea
              id={`${id}-reason`}
              rows={3}
              value={reason}
              maxLength={maxLength}
              disabled={isSubmitting}
              onChange={(e) => onReasonChange(e.target.value)}
              placeholder={placeholder}
              aria-describedby={`${id}-count`}
              required
            />
            <p id={`${id}-count`} className="text-right text-[11px] text-brand-muted-foreground">
              {reason.length}/{maxLength}
            </p>
          </div>
          <Button type="submit" variant="destructive" className="w-full gap-1.5" disabled={!canConfirm}>
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {isSubmitting ? "Working…" : confirmLabel}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
