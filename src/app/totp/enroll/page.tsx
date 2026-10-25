"use client"

import { useEffect, useRef, useState, useSyncExternalStore } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import QRCode from "qrcode"
import { ShieldCheck, ArrowRight, AlertCircle, Copy, Check, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { OtpInputGroup } from "@/components/admin/otp-input-group"
import { useAdminAuth } from "@/hooks/use-admin-auth"
import { clearOtpauthUrl, clearTempToken, getOtpauthUrl, getTempToken } from "@/lib/admin-tokens"
import { describeAuthError, getApiErrorCode } from "@/lib/api-error"
import { ROUTES } from "@/lib/routes"

/** Pulls the `secret=` param out of an otpauth:// URI for the "enter key
 *  manually" fallback — parsed by hand rather than `new URL()` since the
 *  otpauth scheme isn't a standard authority URL. */
function extractSecret(otpauthUrl: string): string | null {
  const match = /[?&]secret=([^&]+)/.exec(otpauthUrl)
  return match ? decodeURIComponent(match[1]) : null
}

/** Groups a base32 secret in 4s so it can be typed without losing your place. */
function groupSecret(secret: string) {
  return secret.replace(/(.{4})/g, "$1 ").trim()
}

const noopSubscribe = () => () => {}
const readEnrollState = () => (getTempToken() ? getOtpauthUrl() : null)

export default function TotpEnrollPage() {
  const router = useRouter()
  const { enroll, isEnrolling } = useAdminAuth()
  // The otpauth URL + tempToken from /login (sessionStorage). Read through
  // useSyncExternalStore — no SSR access, no setState-in-effect. Snapshotted
  // into state once seen, because enroll() clears both from storage on
  // success and the QR/secret must not vanish mid-render.
  const stored = useSyncExternalStore(noopSubscribe, readEnrollState, () => undefined)
  const [otpauthUrl, setOtpauthUrl] = useState<string | null>(null)
  if (stored && otpauthUrl !== stored && !otpauthUrl) setOtpauthUrl(stored)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [qrFailed, setQrFailed] = useState(false)
  const [code, setCode] = useState("")
  const [error, setError] = useState("")
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null)
  const [acknowledged, setAcknowledged] = useState(false)
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)
  const inFlight = useRef(false)
  const copyTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // No enrollment in progress (direct nav, closed tab, expired) → /login.
  useEffect(() => {
    if (stored === null && !otpauthUrl && !recoveryCodes && !busy) router.replace(ROUTES.login)
  }, [stored, otpauthUrl, recoveryCodes, busy, router])

  useEffect(() => {
    if (!otpauthUrl) return
    let cancelled = false
    QRCode.toDataURL(otpauthUrl, { margin: 1, width: 200 })
      .then((dataUrl) => {
        if (!cancelled) setQrDataUrl(dataUrl)
      })
      .catch(() => {
        // Not fatal — the manual-entry secret below still works.
        if (!cancelled) setQrFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [otpauthUrl])

  // The recovery codes exist only in this component's memory and are never
  // shown again (bcrypt-hashed server-side). Warn before a refresh/close
  // until the admin confirms they've saved them.
  useEffect(() => {
    if (!recoveryCodes || acknowledged) return
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ""
    }
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [recoveryCodes, acknowledged])

  useEffect(() => () => clearTimeout(copyTimer.current), [])

  // `value` comes from the OTP input's onComplete — `code` state is still
  // one digit behind at that moment.
  const verify = async (value?: string) => {
    const submitted = value ?? code
    if (submitted.length !== 6 || inFlight.current) return
    inFlight.current = true
    setBusy(true)
    setError("")
    try {
      const codes = await enroll(submitted)
      setRecoveryCodes(codes)
    } catch (err) {
      const errCode = getApiErrorCode(err)
      // Dead tempToken, or TOTP_ALREADY_ENROLLED (another tab/device finished
      // enrolling this account first) — retrying here can't succeed.
      if (errCode === "TEMP_TOKEN_INVALID" || errCode === "TOTP_ALREADY_ENROLLED") {
        clearTempToken()
        clearOtpauthUrl()
        router.replace(`${ROUTES.login}?expired=1`)
        return
      }
      setError(describeAuthError(err))
      setCode("")
    } finally {
      inFlight.current = false
      setBusy(false)
    }
  }

  const copyRecoveryCodes = async () => {
    if (!recoveryCodes) return
    try {
      await navigator.clipboard.writeText(recoveryCodes.join("\n"))
      setCopied(true)
      clearTimeout(copyTimer.current)
      copyTimer.current = setTimeout(() => setCopied(false), 2000)
    } catch {
      setError("Couldn't copy automatically — select the codes and copy them, or use Download.")
    }
  }

  const downloadRecoveryCodes = () => {
    if (!recoveryCodes) return
    const text = `Vexora Admin — recovery codes\nGenerated ${new Date().toISOString()}\nEach code works once. Keep this file somewhere safe and offline.\n\n${recoveryCodes.join("\n")}\n`
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }))
    const a = document.createElement("a")
    a.href = url
    a.download = "vexora-admin-recovery-codes.txt"
    document.body.appendChild(a)
    a.click()
    a.remove()
    // Revoke on the next tick — revoking synchronously can cancel the download.
    setTimeout(() => URL.revokeObjectURL(url), 0)
  }

  if (!otpauthUrl && !recoveryCodes) return null

  const secret = otpauthUrl ? extractSecret(otpauthUrl) : null

  return (
    // Theme-aware background — matches the rest of the portal's light/dark toggle.
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-6 py-10">
      <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-brand-primary-dark/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-brand-primary-dark/10 blur-3xl" />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative w-full max-w-sm bg-card p-8 text-center shadow-2xl shadow-brand-primary-dark/10"
      >
        <div className="mx-auto grid h-12 w-12 place-items-center bg-gradient-to-br from-brand-primary-dark via-brand-primary-dark to-gold-700 shadow-lg shadow-brand-primary-dark/30">
          <ShieldCheck className="h-6 w-6 text-brand-secondary" />
        </div>

        {!recoveryCodes ? (
          <>
            <h1 className="mt-3 font-serif text-2xl font-bold text-brand-secondary">Set up your authenticator</h1>
            <p className="mt-1 text-sm text-brand-secondary/60">
              First-time login — scan this QR in Google Authenticator or Authy, then enter the 6-digit code it shows.
            </p>

            <div className="mt-5 flex justify-center">
              {qrDataUrl ? (
                <img src={qrDataUrl} alt="QR code to add Vexora Admin to your authenticator app" className="h-[200px] w-[200px] border border-brand-border-light bg-white" />
              ) : (
                <div className="grid h-[200px] w-[200px] place-items-center border border-brand-border-light px-4 text-xs text-brand-secondary/50">
                  {qrFailed ? "Couldn't draw the QR code — use the key below instead." : "Generating QR…"}
                </div>
              )}
            </div>

            {secret && (
              <p className="mt-3 text-[11px] leading-relaxed text-brand-secondary/50">
                Can&apos;t scan? Enter this key manually:
                <br />
                <span className="select-all break-all font-mono text-[11px] tracking-wide text-brand-secondary">{groupSecret(secret)}</span>
              </p>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault()
                void verify()
              }}
            >
              <div className="mt-6 flex justify-center">
                <OtpInputGroup
                  value={code}
                  onChange={(v) => {
                    setCode(v)
                    if (error) setError("")
                  }}
                  onComplete={(v) => void verify(v)}
                  disabled={isEnrolling}
                  invalid={!!error}
                />
              </div>

              {error && (
                <div role="alert" className="mt-4 flex items-center justify-center gap-2 border border-red-600/30 bg-red-600/10 px-3 py-2 text-xs font-semibold text-red-600">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}

              <Button type="submit" className="btn-gold mt-6 flex w-full items-center justify-center gap-2" disabled={code.length !== 6 || isEnrolling}>
                {isEnrolling ? "Verifying…" : "Verify & continue"} <ArrowRight className="h-4 w-4" />
              </Button>
            </form>
          </>
        ) : (
          <>
            <h1 className="mt-3 font-serif text-2xl font-bold text-brand-secondary">Save your recovery codes</h1>
            <p className="mt-1 text-sm text-brand-secondary/60">
              These 10 codes are shown once, ever — leaving or refreshing this page loses them. Each works one time if you lose access to your authenticator app.
            </p>

            <ul aria-label="Recovery codes" className="mt-5 grid select-all grid-cols-2 gap-2 border border-brand-border-light bg-brand-tertiary/40 p-4 font-mono text-xs text-brand-secondary">
              {recoveryCodes.map((rc, i) => (
                <li key={`${i}-${rc}`}>{rc}</li>
              ))}
            </ul>

            <div className="mt-3 flex items-center justify-center gap-4">
              <button
                type="button"
                onClick={copyRecoveryCodes}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-primary-dark hover:underline"
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                <span aria-live="polite">{copied ? "Copied" : "Copy all"}</span>
              </button>
              <button
                type="button"
                onClick={downloadRecoveryCodes}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-primary-dark hover:underline"
              >
                <Download className="h-3.5 w-3.5" /> Download .txt
              </button>
            </div>

            {error && (
              <p role="alert" className="mt-3 text-xs font-semibold text-red-600">
                {error}
              </p>
            )}

            <label className="mt-5 flex cursor-pointer items-start gap-2 text-left text-xs text-brand-secondary/70">
              <Checkbox checked={acknowledged} onCheckedChange={(v) => setAcknowledged(v === true)} className="mt-0.5" />
              I&apos;ve saved these recovery codes somewhere safe. I understand they won&apos;t be shown again.
            </label>

            <Button
              className="btn-gold mt-6 flex w-full items-center justify-center gap-2"
              disabled={!acknowledged}
              onClick={() => router.replace(ROUTES.dashboard)}
            >
              Continue to dashboard <ArrowRight className="h-4 w-4" />
            </Button>
          </>
        )}
      </motion.div>
    </div>
  )
}
