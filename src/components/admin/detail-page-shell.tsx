import type { ReactNode } from "react"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export function DetailBackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="flex w-fit items-center gap-1.5 text-xs font-semibold text-brand-secondary/55 hover:text-brand-secondary focus-visible:text-brand-secondary focus-visible:underline focus-visible:outline-none">
      <ArrowLeft className="h-3.5 w-3.5" /> {label}
    </Link>
  )
}

export function DetailCard({ children }: { children: ReactNode }) {
  return <div className="bg-card p-6 ring-1 ring-brand-border">{children}</div>
}
