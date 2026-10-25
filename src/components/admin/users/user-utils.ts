import type { AdminUserStatus } from "@/store/api/adminApi"

export const USER_STATUSES: AdminUserStatus[] = ["active", "suspended", "deleted"]
export const USER_STATUS_LABEL: Record<AdminUserStatus, string> = { active: "Active", suspended: "Suspended", deleted: "Deleted" }

export function userStatusTone(status: AdminUserStatus) {
  return status === "active" ? "success" : status === "suspended" ? "danger" : "neutral"
}

/** User rows carry only an email and/or a mobile — no name — so that's the row's identity. */
export function userLabel(u: { email?: string | null; mobile?: string | null }) {
  return u.email || u.mobile || "No contact on file"
}

export const isObjectId = (id: string) => /^[a-f0-9]{24}$/i.test(id)
