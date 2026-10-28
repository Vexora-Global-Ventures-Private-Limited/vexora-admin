"use client"

import { useState } from "react"

const MAX_LEN = 60
const MAX_KEYS = 6

function full(value: unknown): string {
  if (value === undefined) return "—"
  if (value === null) return "null"
  return typeof value === "string" ? value : JSON.stringify(value)
}

function show(value: unknown): string {
  const text = full(value)
  return text.length > MAX_LEN ? `${text.slice(0, MAX_LEN)}…` : text
}

/**
 * Truncated value with the full text on hover. Screen readers get the full
 * text as real content — aria-label isn't announced on a plain <span>.
 */
function Value({ value, className }: { value: unknown; className?: string }) {
  const text = full(value)
  const short = show(value)
  if (short === text) return <span className={className}>{text}</span>
  return (
    <span className={className} title={text}>
      <span aria-hidden>{short}</span>
      <span className="sr-only">{text}</span>
    </span>
  )
}

/** Key-order-insensitive comparison, so a re-serialised object isn't reported as "changed". */
function stable(value: unknown): string {
  if (value === undefined) return "undefined"
  return JSON.stringify(value, (_k, v) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(Object.keys(v as Record<string, unknown>).sort().map((k) => [k, (v as Record<string, unknown>)[k]]))
      : v,
  )
}

/**
 * Compact before → after view for one audit entry: only the keys whose value
 * actually changed. Entries with just an `after` (creates, resolves) list
 * the new values; entries with neither say so.
 */
export function AuditDiff({ before, after }: { before?: unknown; after?: unknown }) {
  const [showAll, setShowAll] = useState(false)
  const b = before && typeof before === "object" ? (before as Record<string, unknown>) : undefined
  const a = after && typeof after === "object" ? (after as Record<string, unknown>) : undefined

  if (!b && !a) {
    if (before === undefined && after === undefined) return <span className="text-brand-secondary/40">—</span>
    return (
      <span className="text-[11px] text-brand-secondary/70">
        <Value value={before} /> → <Value value={after} />
      </span>
    )
  }

  const keys = Array.from(new Set([...Object.keys(b ?? {}), ...Object.keys(a ?? {})])).filter(
    (k) => stable(b?.[k]) !== stable(a?.[k]),
  )
  if (keys.length === 0) return <span className="text-[11px] text-brand-secondary/40">No field changes</span>

  return (
    <ul className="space-y-0.5 text-[11px] leading-snug">
      {(showAll ? keys : keys.slice(0, MAX_KEYS)).map((k) => (
        <li key={k} className="break-words">
          <span className="font-semibold text-brand-secondary">{k}</span>:{" "}
          {b && <Value value={b[k]} className="text-red-700/80 line-through decoration-red-300" />}
          {b && " → "}
          <Value value={a?.[k]} className="text-emerald-700" />
        </li>
      ))}
      {keys.length > MAX_KEYS && (
        <li>
          <button
            type="button"
            className="text-brand-primary-dark underline-offset-2 hover:underline"
            onClick={() => setShowAll((v) => !v)}
            aria-expanded={showAll}
          >
            {showAll ? "Show fewer" : `+${keys.length - MAX_KEYS} more`}
          </button>
        </li>
      )}
    </ul>
  )
}
