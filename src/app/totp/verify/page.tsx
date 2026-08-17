"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { ShieldCheck, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { OtpInputGroup } from "@/components/admin/otp-input-group"
import { useAdminSession } from "@/lib/admin-session"
import { ROUTES } from "@/lib/routes"

export default function OtpVerifyPage() {
  const router = useRouter()
  const adminUser = useAdminSession((s) => s.adminUser)
  const totpVerifiedAt = useAdminSession((s) => s.totpVerifiedAt)
  const hasHydrated = useAdminSession((s) => s.hasHydrated)
  const markTotpVerified = useAdminSession((s) => s.markTotpVerified)
  const [code, setCode] = useState("")

  useEffect(() => {
    if (!hasHydrated) return
    if (!adminUser) router.replace(ROUTES.login)
    else if (totpVerifiedAt) router.replace(ROUTES.dashboard)
  }, [hasHydrated, adminUser, totpVerifiedAt, router])

  const verify = () => {
    if (code.length !== 6) return
    markTotpVerified()
    router.push(ROUTES.dashboard)
  }

  if (!adminUser) return null

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
          Enter the 6-digit one-time password to unlock the console for {adminUser.name}.
        </p>

        <div className="mt-6 flex justify-center">
          <OtpInputGroup value={code} onChange={setCode} onComplete={verify} />
        </div>

        <Button className="btn-gold mt-6 flex w-full items-center justify-center gap-2" disabled={code.length !== 6} onClick={verify}>
          Verify &amp; continue <ArrowRight className="h-4 w-4" />
        </Button>
      </motion.div>
    </div>
  )
}
