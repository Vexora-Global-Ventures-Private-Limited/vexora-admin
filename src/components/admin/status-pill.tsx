import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

type Tone = "success" | "warning" | "danger" | "info" | "neutral"

const TONE_VARS: Record<Tone, string> = {
  success: "var(--semantic-success)",
  warning: "var(--semantic-warning)",
  danger: "var(--semantic-danger)",
  info: "var(--semantic-info)",
  neutral: "var(--brand-muted-foreground)",
}

type StatusPillProps = {
  tone?: Tone
  children: ReactNode
  className?: string
}

/** Generic enum-status chip — pairs color with a text label, never color-only. */
export function StatusPill({ tone = "neutral", children, className }: StatusPillProps) {
  const color = TONE_VARS[tone]
  return (
    <span
      className={cn("status-pill inline-flex items-center gap-1.5 text-[11px] font-semibold", className)}
      style={{ color }}
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: color }} />
      {children}
    </span>
  )
}
