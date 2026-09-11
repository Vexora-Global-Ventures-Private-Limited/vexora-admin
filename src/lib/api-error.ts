/**
 * The Vexora backend's error envelope, e.g.
 * {"error":{"code":"ADMIN_AUTH_FAILED","message":"..."}}. admin_auth.json
 * only documents the status codes/error codes, not this envelope shape, but
 * it matches the one already confirmed live on the consumer-facing API
 * (same backend) — see vexora-web/src/lib/api-error.ts.
 */
export type ApiErrorBody = { error: { code: string; message: string } }

/** Extracts the backend's own error `code` from a caught RTK Query mutation error, if present. */
export function getApiErrorCode(error: unknown): string | undefined {
  const inner = getErrorEnvelope(error)
  const code = inner?.code
  return typeof code === "string" ? code : undefined
}

/** Extracts the backend's own human-readable `message` from a caught RTK Query mutation error, if present. */
export function getApiErrorMessage(error: unknown): string | undefined {
  const inner = getErrorEnvelope(error)
  const message = inner?.message
  return typeof message === "string" ? message : undefined
}

function getErrorEnvelope(error: unknown): { code?: unknown; message?: unknown } | undefined {
  if (!error || typeof error !== "object" || !("data" in error)) return undefined
  const data = (error as { data?: unknown }).data
  if (!data || typeof data !== "object" || !("error" in data)) return undefined
  const inner = (data as { error?: unknown }).error
  if (!inner || typeof inner !== "object") return undefined
  return inner as { code?: unknown; message?: unknown }
}
