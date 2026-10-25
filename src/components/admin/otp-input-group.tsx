"use client"

import { REGEXP_ONLY_DIGITS } from "input-otp"
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp"

type OtpInputGroupProps = {
  value: string
  onChange: (value: string) => void
  /** Called with the full 6-digit value — use the argument, not your own state (it hasn't re-rendered yet). */
  onComplete?: (value: string) => void
  disabled?: boolean
  autoFocus?: boolean
  label?: string
  invalid?: boolean
}

/** Shared 6-digit TOTP entry — used by /totp/verify, /totp/enroll and the step-up dialog. */
export function OtpInputGroup({
  value,
  onChange,
  onComplete,
  disabled,
  autoFocus = true,
  label = "6-digit authenticator code",
  invalid,
}: OtpInputGroupProps) {
  return (
    <InputOTP
      maxLength={6}
      value={value}
      onChange={onChange}
      onComplete={onComplete}
      disabled={disabled}
      autoFocus={autoFocus}
      pattern={REGEXP_ONLY_DIGITS}
      inputMode="numeric"
      autoComplete="one-time-code"
      aria-label={label}
      aria-invalid={invalid || undefined}
    >
      <InputOTPGroup>
        {Array.from({ length: 6 }).map((_, i) => (
          <InputOTPSlot key={i} index={i} aria-invalid={invalid || undefined} className="h-12 w-11 text-base" />
        ))}
      </InputOTPGroup>
    </InputOTP>
  )
}

/** Max length accepted for a one-time recovery code (format isn't documented — kept generous). */
export const RECOVERY_CODE_MAX = 64

/** Normalises a typed/pasted recovery code: trims and drops inner whitespace. */
export function normalizeRecoveryCode(raw: string) {
  return raw.replace(/\s+/g, "").slice(0, RECOVERY_CODE_MAX)
}

/**
 * Free-text entry for one of the 10 one-time recovery codes. These aren't
 * 6 digits, so the TOTP boxes can't take them — every "use a recovery code"
 * path needs this instead. The backend accepts a recovery code anywhere a
 * TOTP code is accepted (login verify and step-up) and consumes it.
 */
export function RecoveryCodeInput({
  value,
  onChange,
  onSubmit,
  disabled,
  id,
}: {
  value: string
  onChange: (value: string) => void
  onSubmit?: () => void
  disabled?: boolean
  id?: string
}) {
  return (
    <input
      id={id}
      value={value}
      onChange={(e) => onChange(normalizeRecoveryCode(e.target.value))}
      onKeyDown={(e) => {
        if (e.key === "Enter" && value) {
          e.preventDefault()
          onSubmit?.()
        }
      }}
      disabled={disabled}
      autoFocus
      autoComplete="off"
      autoCapitalize="off"
      spellCheck={false}
      maxLength={RECOVERY_CODE_MAX}
      placeholder="Recovery code"
      aria-label="One-time recovery code"
      className="w-full border border-brand-border-light bg-card px-4 py-3 text-center font-mono text-sm tracking-wider text-brand-secondary outline-none focus:border-brand-primary-dark disabled:opacity-60"
    />
  )
}
