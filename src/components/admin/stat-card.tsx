"use client"

import type { LucideIcon } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { AnimatedCounter } from "@/components/motion/animated-counter"
import { cn } from "@/lib/utils"

type StatCardProps = {
  label: string
  value: number
  icon?: LucideIcon
  prefix?: string
  suffix?: string
  decimals?: number
  hint?: string
  className?: string
}

export function StatCard({ label, value, icon: Icon, prefix, suffix, decimals, hint, className }: StatCardProps) {
  return (
    <Card className={cn("card-sheen gap-3 border-brand-border/80 py-5", className)}>
      <CardContent className="px-5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-muted-foreground">
            {label}
          </span>
          {Icon && (
            <span className="grid h-8 w-8 place-items-center bg-brand-primary/10 text-brand-primary-dark">
              <Icon className="h-4 w-4" />
            </span>
          )}
        </div>
        <div className="mt-2 font-serif text-2xl font-bold text-brand-secondary">
          <AnimatedCounter to={value} prefix={prefix} suffix={suffix} decimals={decimals} />
        </div>
        {hint && <p className="mt-1 text-xs text-brand-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  )
}
