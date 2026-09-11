"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import QRCode from "qrcode"
import { ShieldCheck, ArrowRight, AlertCircle, Copy, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { OtpInputGroup } from "@/components/admin/otp-input-group"
import { useAdminAuth } from "@/hooks/use-admin-auth"
import { clearOtpauthUrl, clearTempToken, getOtpauthUrl, getTempToken } from "@/lib/admin-tokens"
import { getApiErrorCode, getApiErrorMessage } from "@/lib/api-error"
import { ROUTES } from "@/lib/routes"

/** Pulls the `secret=` param out of an otpauth:// URI for the "enter key
 *  manually" fallback — parsed by hand rather than `new URL()` since the
 *  otpauth scheme isn't a standard authority URL. */
function extractSecret(otpauthUrl: string): string | null {
  const match = /[?&]secret=([^&]+)/.exec(otpauthUrl)
  return match ? decodeURIComponent(match[1]) : null
}

export default function TotpEnrollPage() {
  const router = useRouter()
  const { enroll, isEnrolling } = useAdminAuth()
  const [ready, setReady] = useState(false)
  const [otpauthUrl, setOtpauthUrl] = useState<string | null>(null)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [code, setCode] = useState("")
  const [error, setError] = useState("")
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null)
  const [acknowledged, setAcknowledged] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const url = getOtpauthUrl()
    if (!getTempToken() || !url) {
      router.replace(ROUTES.login)
      return
    }
    setOtpauthUrl(url)
    setReady(true)
  }, [router])

  useEffect(() => {
    if (!otpauthUrl) return
    let cancelled = false
    QRCode.toDataURL(otpauthUrl, { margin: 1, width: 200 })
      .then((dataUrl) => {
        if (!cancelled) setQrDataUrl(dataUrl)
      })
      .catch(() => {
        // QR render failure isn't fatal — the manual-entry secret below still works.
      })
    return () => {
      cancelled = true
    }
  }, [otpauthUrl])

  const verify = async () => {
    if (code.length !== 6) return
    setError("")
    try {
      const codes = await enroll(code)
      setRecoveryCodes(codes)
    } catch (err) {
      const errCode = getApiErrorCode(err)
      // Same dead-tempToken case as /totp/verify — and TOTP_ALREADY_ENROLLED
      // means another tab/device finished enrolling this account first
      // while this one sat open; either way, retrying here can't succeed,
      // so send the admin back to /login for a clean restart.
      if (errCode === "TEMP_TOKEN_INVALID" || errCode === "TOTP_ALREADY_ENROLLED") {
        clearTempToken()
        clearOtpauthUrl()
        router.replace(`${ROUTES.login}?expired=1`)
        return
      }
      setError(getApiErrorMessage(err) ?? "Invalid code — please try again.")
      setCode("")
    }
  }

  const copyRecoveryCodes = async () => {
    if (!recoveryCodes) return
    try {
      await navigator.clipboard.writeText(recoveryCodes.join("\n"))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard access can be denied — the codes are still visible to copy by hand.
    }
  }

  if (!ready) return null

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
                <img src={qrDataUrl} alt="Authenticator QR code" className="h-[200px] w-[200px] border border-brand-border-light" />
              ) : (
                <div className="grid h-[200px] w-[200px] place-items-center border border-brand-border-light text-xs text-brand-secondary/50">
                  Generating QR…
                </div>
              )}
            </div>

            {secret && (
              <p className="mt-3 text-[11px] leading-relaxed text-brand-secondary/50">
                Can&apos;t scan? Enter this key manually:
                <br />
                <span className="font-mono text-[11px] tracking-wide text-brand-secondary">{secret}</span>
              </p>
            )}

            <div className="mt-6 flex justify-center">
              <OtpInputGroup value={code} onChange={setCode} onComplete={verify} disabled={isEnrolling} />
            </div>

            {error && (
              <div className="mt-4 flex items-center justify-center gap-2 border border-red-600/30 bg-red-600/10 px-3 py-2 text-xs font-semibold text-red-600">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            <Button
              className="btn-gold mt-6 flex w-full items-center justify-center gap-2"
              disabled={code.length !== 6 || isEnrolling}
              onClick={verify}
            >
              {isEnrolling ? "Verifying…" : "Verify & continue"} <ArrowRight className="h-4 w-4" />
            </Button>
          </>
        ) : (
          <>
            <h1 className="mt-3 font-serif text-2xl font-bold text-brand-secondary">Save your recovery codes</h1>
            <p className="mt-1 text-sm text-brand-secondary/60">
              These 10 codes are shown once, ever. Each works one time if you lose access to your authenticator app.
            </p>

            <div className="mt-5 grid grid-cols-2 gap-2 border border-brand-border-light bg-brand-tertiary/40 p-4 font-mono text-xs text-brand-secondary">
              {recoveryCodes.map((rc) => (
                <div key={rc}>{rc}</div>
              ))}
            </div>

            <button
              type="button"
              onClick={copyRecoveryCodes}
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-brand-primary-dark hover:underline"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy all codes"}
            </button>

            <label className="mt-5 flex cursor-pointer items-start gap-2 text-left text-xs text-brand-secondary/70">
              <Checkbox checked={acknowledged} onCheckedChange={(v) => setAcknowledged(v === true)} className="mt-0.5" />
              I&apos;ve saved these recovery codes somewhere safe. I understand they won&apos;t be shown again.
            </label>

            <Button
              className="btn-gold mt-6 flex w-full items-center justify-center gap-2"
              disabled={!acknowledged}
              onClick={() => router.push(ROUTES.dashboard)}
            >
              Continue to dashboard <ArrowRight className="h-4 w-4" />
            </Button>
          </>
        )}
      </motion.div>
    </div>
  )
}
