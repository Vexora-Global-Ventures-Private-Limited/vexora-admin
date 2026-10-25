"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import { AlertTriangle, Loader2, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { getApiErrorCode, getApiErrorMessage } from "@/lib/api-error"
import { ROUTES } from "@/lib/routes"

/** ₹ from paise, Indian grouping. Missing/0 → "—" (never a misleading ₹0 for an unset price). */
export function formatPaise(paise: number | null | undefined): string {
  if (paise == null || !Number.isFinite(paise) || paise <= 0) return "—"
  const rupees = paise / 100
  if (rupees >= 1e7) return `₹${Number((rupees / 1e7).toFixed(2))} Cr`
  if (rupees >= 1e5) return `₹${Number((rupees / 1e5).toFixed(2))} L`
  return `₹${rupees.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`
}

/** "24 Oct 2026, 16:26" — invalid/missing dates render "—" instead of "Invalid Date". */
export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—"
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false })
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—"
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
}

/** "…c4a7" — last 6 chars of an ObjectId, full id in the title tooltip. */
export function ShortId({ id, className }: { id: string | null | undefined; className?: string }) {
  if (!id) return <span className={className}>—</span>
  return (
    <span title={id} className={`font-mono text-[11px] ${className ?? ""}`}>
      …{id.slice(-6)}
    </span>
  )
}

export const isObjectId = (value: string) => /^[a-f0-9]{24}$/i.test(value.trim())

/**
 * Only https URLs are ever rendered as images/links. The backend stores any
 * string for creatives (verified: `javascript:` and `http:` accepted), so
 * everything else is shown as inert text, flagged unsafe.
 */
export function isSafeHttpsUrl(value: string | null | undefined): value is string {
  if (!value) return false
  try {
    return new URL(value).protocol === "https:"
  } catch {
    return false
  }
}

/**
 * What a creative's `cloudinaryPublicId` actually holds:
 *  - "https"  — a full https URL (what the web app sends in demo mode) → safe to render
 *  - "asset"  — a bare Cloudinary public id (no scheme, e.g. "vexora/ads/abc") —
 *               legitimate once Cloudinary is live, but there's no cloud name
 *               on the admin side to build a URL from, so it's shown as text
 *  - "unsafe" — any other scheme (javascript:, http:, data:, //host…) → never rendered
 */
export function classifyCreativeSrc(value: string | null | undefined): "https" | "asset" | "unsafe" | "empty" {
  const v = (value ?? "").trim()
  if (!v) return "empty"
  if (isSafeHttpsUrl(v as string | undefined)) return "https"
  if (/^[a-z][a-z0-9+.-]*:/i.test(v) || v.startsWith("//")) return "unsafe"
  return /^[\w\-./]+$/.test(v) ? "asset" : "unsafe"
}

/** True once an ISO end date is in the past (e.g. an ad whose paid run window already ended). */
export function hasEnded(endsAt: string | null | undefined): boolean {
  if (!endsAt) return false
  const t = new Date(endsAt).getTime()
  return Number.isFinite(t) && t < Date.now()
}

/** A user id rendered as a link to that user's 360 view (falls back to plain text for non-ids). */
export function UserLink({ id, className }: { id: string | null | undefined; className?: string }) {
  if (!id || !isObjectId(id)) return <ShortId id={id} className={className} />
  return (
    <Link href={ROUTES.userDetail(id)} className={`hover:underline ${className ?? ""}`} title={`Open user ${id}`}>
      <ShortId id={id} />
    </Link>
  )
}

/** Human message for a caught RTK error, preferring the backend's own text. */
export function errorText(error: unknown, fallback: string): string {
  if (error && typeof error === "object" && "status" in error && (error as { status: unknown }).status === "FETCH_ERROR") {
    return "Couldn't reach the server — check your connection and try again."
  }
  return getApiErrorMessage(error) ?? fallback
}

export function isNotImplemented(error: unknown): boolean {
  return getApiErrorCode(error) === "NOT_IMPLEMENTED" || (!!error && typeof error === "object" && (error as { status?: unknown }).status === 501)
}

/** Loading / error states for a list query. Renders `children` once data is ready. */
export function QueryState({
  isLoading,
  error,
  onRetry,
  isFetching,
  children,
  rows = 4,
}: {
  isLoading: boolean
  error: unknown
  onRetry: () => void
  isFetching?: boolean
  children: ReactNode
  rows?: number
}) {
  if (isLoading) {
    return (
      <div className="space-y-2 border border-brand-border bg-card p-4" aria-busy="true" aria-label="Loading">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    )
  }
  if (error) {
    return (
      <div role="alert" className="flex flex-col items-center gap-3 border border-red-200 bg-card p-8 text-center">
        <AlertTriangle className="h-5 w-5 text-red-500" />
        <p className="text-sm text-brand-secondary/75">{errorText(error, "Couldn't load this list.")}</p>
        <Button size="sm" variant="outline" onClick={onRetry} disabled={isFetching} className="gap-1.5">
          {isFetching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />} Try again
        </Button>
      </div>
    )
  }
  return <>{children}</>
}

/** Honest placeholder for a G-module whose backend route still returns 501. */
export function NotAvailableYet({ title, message, children }: { title: string; message: string; children?: ReactNode }) {
  return (
    <div className="border border-dashed border-brand-border bg-card p-8 text-center">
      <div className="font-serif text-lg font-bold text-brand-secondary">{title}</div>
      <p className="mx-auto mt-2 max-w-md text-sm text-brand-secondary/65">{message}</p>
      {children}
    </div>
  )
}

/** Small label/value tile used on detail cards. */
export function Fact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0 bg-brand-tertiary/40 p-3">
      <div className="text-[10px] uppercase tracking-wide text-brand-secondary/50">{label}</div>
      <div className="truncate font-bold text-brand-secondary">{value}</div>
    </div>
  )
}
