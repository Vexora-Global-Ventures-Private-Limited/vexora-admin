"use client"

import { useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { Lock, Mail, ArrowRight, ShieldCheck, AlertCircle } from "lucide-react"
import { useAdminSession, superAdminUser, SUPERADMIN_CREDENTIALS } from "@/lib/admin-session"
import { ROUTES } from "@/lib/routes"

export default function LoginPage() {
  const login = useAdminSession((s) => s.login)
  const router = useRouter()
  // Prefilled for easy local sign-in — remove once real auth lands.
  const [email, setEmail] = useState(SUPERADMIN_CREDENTIALS.email)
  const [password, setPassword] = useState(SUPERADMIN_CREDENTIALS.password)
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)

  // Mock only — there's no real backend/JWT here. Two-factor is password +
  // OTP: no separate authenticator-app enrollment/recovery-codes ceremony —
  // every successful login goes straight to OTP verification.
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()

    const validEmail = email.trim().toLowerCase() === SUPERADMIN_CREDENTIALS.email.toLowerCase()
    const validPassword = password === SUPERADMIN_CREDENTIALS.password

    if (!validEmail || !validPassword) {
      setError("Invalid email or password.")
      return
    }

    setError("")
    setSubmitting(true)
    login(superAdminUser)
    router.push(ROUTES.totpVerify)
  }

  return (
    // Theme-aware background — matches the rest of the portal's light/dark toggle (previously hardcoded dark).
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-6">
      <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-brand-primary-dark/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-brand-primary-dark/10 blur-3xl" />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative w-full max-w-md bg-card p-8 shadow-2xl shadow-brand-primary-dark/10"
      >
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="grid h-12 w-12 place-items-center bg-gradient-to-br from-brand-primary-dark via-brand-primary-dark to-gold-700 shadow-lg shadow-brand-primary-dark/30">
            <ShieldCheck className="h-6 w-6 text-brand-secondary" />
          </div>
          <h1 className="mt-3 font-serif text-2xl font-bold text-brand-secondary">Vexora Admin</h1>
          <p className="mt-1 text-xs uppercase tracking-[0.2em] text-brand-primary-dark">Approve · Verify · Publish</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wide text-brand-secondary/50">Email</label>
            <div className="mt-1.5 flex items-center gap-2 border border-brand-border-light bg-card px-4 py-3 focus-within:border-brand-primary-dark">
              <Mail className="h-4 w-4 text-brand-primary-dark" />
              <input
                type="email"
                required
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@vexora.in"
                className="w-full bg-transparent text-sm font-medium text-brand-secondary outline-none"
              />
            </div>
          </div>
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wide text-brand-secondary/50">Password</label>
            <div className="mt-1.5 flex items-center gap-2 border border-brand-border-light bg-card px-4 py-3 focus-within:border-brand-primary-dark">
              <Lock className="h-4 w-4 text-brand-primary-dark" />
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-transparent text-sm font-medium text-brand-secondary outline-none"
              />
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 border border-red-600/30 bg-red-600/10 px-3 py-2 text-xs font-semibold text-red-600">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="btn-gold flex w-full items-center justify-center gap-2 overflow-hidden py-3.5 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span className="relative z-10 flex items-center gap-2">
              {submitting ? "Signing in…" : "Sign in"} <ArrowRight className="h-4 w-4" />
            </span>
          </button>
        </form>

        <p className="mt-4 text-center text-[11px] leading-relaxed text-brand-secondary/50">
          Admin access requires an OTP on every session (BR-80). No anonymous surface — this console is not indexed.
        </p>
      </motion.div>
    </div>
  )
}
