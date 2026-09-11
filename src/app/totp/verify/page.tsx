"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { ShieldCheck, ArrowRight, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { OtpInputGroup } from "@/components/admin/otp-input-group"
import { useAdminAuth } from "@/hooks/use-admin-auth"
import { clearTempToken, getTempToken } from "@/lib/admin-tokens"
import { getApiErrorCode, getApiErrorMessage } from "@/lib/api-error"
import { ROUTES } from "@/lib/routes"

export default function OtpVerifyPage() {
  const router = useRouter()
  const { verifyLogin, isVerifying } = useAdminAuth()
  const [code, setCode] = useState("")
  const [error, setError] = useState("")
  const [ready, setReady] = useState(false)

  // A tempToken only exists here right after step 1 (/login) succeeded with
  // needsTotp — landing on this page any other way (direct nav, expired tab)
  // means there's nothing to verify against, so bounce back to login.
  useEffect(() => {
    if (!getTempToken()) {
      router.replace(ROUTES.login)
      return
    }
    setReady(true)
  }, [router])

  const verify = async () => {
    if (code.length !== 6) return
    setError("")
    try {
      await verifyLogin(code)
      router.push(ROUTES.dashboard)
    } catch (err) {
      // The 10-minute tempToken from step 1 is dead — no code will ever
      // succeed against it. Retrying here would just fail forever, so send
      // the admin back to /login to get a fresh one instead of leaving them
      // stuck re-entering codes into a session that can't be recovered.
      if (getApiErrorCode(err) === "TEMP_TOKEN_INVALID") {
        clearTempToken()
        router.replace(`${ROUTES.login}?expired=1`)
        return
      }
      setError(getApiErrorMessage(err) ?? "Invalid code — please try again.")
      setCode("")
    }
  }

  if (!ready) return null

  return (
    // Theme-aware background — matches the rest of the portal's light/dark toggle (previously hardcoded dark).
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-6">
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
        <h1 className="mt-3 font-serif text-2xl font-bold text-brand-secondary">Enter your OTP</h1>
        <p className="mt-1 text-sm text-brand-secondary/60">
          Enter the 6-digit code from your authenticator app to unlock the console.
        </p>

        <div className="mt-6 flex justify-center">
          <OtpInputGroup value={code} onChange={setCode} onComplete={verify} disabled={isVerifying} />
        </div>

        {error && (
          <div className="mt-4 flex items-center justify-center gap-2 border border-red-600/30 bg-red-600/10 px-3 py-2 text-xs font-semibold text-red-600">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <Button
          className="btn-gold mt-6 flex w-full items-center justify-center gap-2"
          disabled={code.length !== 6 || isVerifying}
          onClick={verify}
        >
          {isVerifying ? "Verifying…" : "Verify & continue"} <ArrowRight className="h-4 w-4" />
        </Button>

        <p className="mt-4 text-[11px] text-brand-secondary/50">
          Lost your device? Use one of your one-time recovery codes instead.
        </p>
      </motion.div>
    </div>
  )
}
