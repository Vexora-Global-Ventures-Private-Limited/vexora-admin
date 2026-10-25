"use client"

import type { LucideIcon } from "lucide-react"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { AnimatedCounter } from "@/components/motion/animated-counter"
import { cn } from "@/lib/utils"

type StatCardProps = {
  label: string
  /** null = the backend doesn't compute this yet — rendered as "Not available yet", never a fake 0. */
  value: number | null
  icon?: LucideIcon
  prefix?: string
  suffix?: string
  decimals?: number
  hint?: string
  /** Optional drill-down — the whole card becomes a link. */
  href?: string
  loading?: boolean
  className?: string
}

export function StatCard({ label, value, icon: Icon, prefix, suffix, decimals, hint, href, loading, className }: StatCardProps) {
  const body = (
    <Card className={cn("card-sheen h-full gap-3 border-brand-border/80 py-5", href && "transition-colors hover:border-brand-primary/50", className)}>
      <CardContent className="px-5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-muted-foreground">
            {label}
          </span>
          {Icon && (
            <span className="grid h-8 w-8 shrink-0 place-items-center bg-brand-primary/10 text-brand-primary-dark" aria-hidden>
              <Icon className="h-4 w-4" />
            </span>
          )}
        </div>
        <div className="mt-2 font-serif text-2xl font-bold text-brand-secondary">
          {loading ? (
            <span className="inline-block h-7 w-20 animate-pulse bg-brand-tertiary" aria-label="Loading" />
          ) : value == null ? (
            <span className="font-sans text-sm font-semibold text-brand-muted-foreground">Not available yet</span>
          ) : (
            <AnimatedCounter to={value} prefix={prefix} suffix={suffix} decimals={decimals} />
          )}
        </div>
        {hint && <p className="mt-1 text-xs text-brand-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  )

  return href ? (
    <Link href={href} className="block rounded-[inherit] focus-visible:outline-2 focus-visible:outline-brand-primary">
      {body}
    </Link>
  ) : (
    body
  )
}
