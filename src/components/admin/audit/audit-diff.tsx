"use client"

const MAX_LEN = 60

function full(value: unknown): string {
  if (value === undefined) return "—"
  if (value === null) return "null"
  return typeof value === "string" ? value : JSON.stringify(value)
}

function show(value: unknown): string {
  const text = full(value)
  return text.length > MAX_LEN ? `${text.slice(0, MAX_LEN)}…` : text
}

/** Truncated value with the full text on hover (and for screen readers). */
function Value({ value, className }: { value: unknown; className?: string }) {
  const text = full(value)
  const short = show(value)
  return (
    <span className={className} title={short !== text ? text : undefined} aria-label={short !== text ? text : undefined}>
      {short}
    </span>
  )
}

/**
 * Compact before → after view for one audit entry: only the keys whose value
 * actually changed. Entries with just an `after` (creates, resolves) list
 * the new values; entries with neither say so.
 */
export function AuditDiff({ before, after }: { before?: unknown; after?: unknown }) {
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
    (k) => JSON.stringify(b?.[k]) !== JSON.stringify(a?.[k]),
  )
  if (keys.length === 0) return <span className="text-[11px] text-brand-secondary/40">No field changes</span>

  return (
    <ul className="space-y-0.5 text-[11px] leading-snug">
      {keys.slice(0, 6).map((k) => (
        <li key={k} className="break-words">
          <span className="font-semibold text-brand-secondary">{k}</span>:{" "}
          {b && <Value value={b[k]} className="text-red-700/80 line-through decoration-red-300" />}
          {b && " → "}
          <Value value={a?.[k]} className="text-emerald-700" />
        </li>
      ))}
      {keys.length > 6 && <li className="text-brand-secondary/45">+{keys.length - 6} more</li>}
    </ul>
  )
}
