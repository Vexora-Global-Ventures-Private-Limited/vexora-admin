"use client"

import { Construction } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getApiErrorCode, getApiErrorMessage } from "@/lib/api-error"

/**
 * Honest placeholder for a screen whose backend endpoint isn't built yet.
 * Renders the backend's own 501 message — no fake rows, no fake actions.
 */
export function BackendPendingCard({
  title,
  description,
  isLoading,
  error,
  data,
  onRetry,
}: {
  title: string
  description: string
  isLoading: boolean
  error: unknown
  data: unknown
  onRetry: () => void
}) {
  const code = getApiErrorCode(error)
  const notImplemented = code === "NOT_IMPLEMENTED"

  return (
    <div className="border border-brand-border bg-card p-8 text-center" role="status">
      <span className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-brand-primary/10 text-brand-primary-dark" aria-hidden>
        <Construction className="h-5 w-5" />
      </span>
      <h2 className="mt-3 font-serif text-lg font-bold text-brand-secondary">{title}</h2>
      {isLoading ? (
        <p className="mt-2 text-sm text-brand-muted-foreground">Checking the backend…</p>
      ) : notImplemented || (!error && !data) ? (
        <>
          <p className="mx-auto mt-2 max-w-md text-sm text-brand-muted-foreground">{description}</p>
          {notImplemented && (
            <p className="mx-auto mt-3 max-w-md bg-brand-tertiary/50 px-3 py-2 font-mono text-[11px] text-brand-secondary/70">
              501 NOT_IMPLEMENTED — {getApiErrorMessage(error)}
            </p>
          )}
        </>
      ) : error ? (
        <>
          <p className="mt-2 text-sm text-red-700">{getApiErrorMessage(error) ?? "Couldn't reach the backend."}</p>
          <Button className="mt-3" size="sm" variant="outline" onClick={onRetry}>
            Retry
          </Button>
        </>
      ) : (
        // The endpoint answered 200 — the backend shipped it and this screen needs wiring.
        <p className="mx-auto mt-2 max-w-md text-sm text-brand-secondary">
          The backend now returns data for this screen — it needs to be wired up in the admin app.
        </p>
      )}
    </div>
  )
}
