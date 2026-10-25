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

const AUTH_ERROR_COPY: Record<string, string> = {
  ADMIN_AUTH_FAILED: "Invalid email or password.",
  ADMIN_INACTIVE: "This admin account has been deactivated. Contact a super admin.",
  TOTP_INVALID: "That code isn't valid — codes change every 30 seconds, so enter the current one.",
  TEMP_TOKEN_INVALID: "That sign-in attempt expired — please sign in again.",
  RATE_LIMITED: "Too many attempts — wait a few minutes before trying again.",
  VALIDATION_ERROR: "Please check what you entered and try again.",
}

/**
 * One user-facing sentence for any error from the auth screens / step-up
 * dialog: known codes get fixed copy, a network failure (RTK's FETCH_ERROR /
 * TIMEOUT_ERROR) gets its own message instead of "invalid code", and an
 * Error thrown by our own hooks keeps its message.
 */
export function describeAuthError(error: unknown, invalidCodeOverride?: string): string {
  if (error && typeof error === "object" && "status" in error) {
    const status = (error as { status: unknown }).status
    if (status === "FETCH_ERROR" || status === "TIMEOUT_ERROR") {
      return "Couldn't reach the server — check your connection and try again."
    }
    if (status === 429) return AUTH_ERROR_COPY.RATE_LIMITED
  }
  const code = getApiErrorCode(error)
  if (code === "TOTP_INVALID" && invalidCodeOverride) return invalidCodeOverride
  if (code && AUTH_ERROR_COPY[code]) return AUTH_ERROR_COPY[code]
  if (error instanceof Error && error.message) return error.message
  return getApiErrorMessage(error) ?? "Something went wrong — please try again."
}
