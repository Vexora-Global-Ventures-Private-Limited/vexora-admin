"use client"

import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp"

type OtpInputGroupProps = {
  value: string
  onChange: (value: string) => void
  onComplete?: (value: string) => void
  disabled?: boolean
}

/** Shared 6-digit TOTP entry — used by /totp/verify, /totp/enroll and the step-up dialog. */
export function OtpInputGroup({ value, onChange, onComplete, disabled }: OtpInputGroupProps) {
  return (
    <InputOTP maxLength={6} value={value} onChange={onChange} onComplete={onComplete} disabled={disabled}>
      <InputOTPGroup>
        {Array.from({ length: 6 }).map((_, i) => (
          <InputOTPSlot key={i} index={i} className="h-12 w-11 text-base" />
        ))}
      </InputOTPGroup>
    </InputOTP>
  )
}
