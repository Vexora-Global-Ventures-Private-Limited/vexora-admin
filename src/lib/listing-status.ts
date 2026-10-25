/** Tone per real backend listing status. Unknown statuses fall back to neutral. */
export const LISTING_STATUS_TONE: Record<string, "success" | "warning" | "danger" | "neutral" | "info"> = {
  draft: "neutral",
  pending_review: "warning",
  live: "success",
  rejected: "danger",
  removed: "neutral",
  expired: "neutral",
}

export function listingStatusLabel(status: string | null | undefined) {
  return (status || "unknown").replace(/_/g, " ")
}

/** Same lookup with a safe fallback for statuses this map doesn't know. */
export function listingStatusTone(status: string | null | undefined) {
  return (status && LISTING_STATUS_TONE[status]) || "neutral"
}
