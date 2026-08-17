import type { ListingQueueItem } from "@/lib/admin-data"

export const LISTING_STATUS_TONE = {
  pending_review: "warning",
  live: "success",
  rejected: "danger",
  removed: "neutral",
} as const

export const LISTING_STATUSES: ListingQueueItem["status"][] = ["pending_review", "live", "rejected", "removed"]
