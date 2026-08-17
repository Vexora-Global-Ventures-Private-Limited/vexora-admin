"use client"

// Shared, in-memory (non-persisted) store for all G1–G10 mock data. Every
// mutating admin action goes through here instead of a page-local useState
// copy, so list/detail/dashboard/sidebar views agree with each other within
// a session, and every mutation appends a real row to the audit log.
//
// Deliberately NOT persisted to localStorage: the bug being fixed is desync
// *within* a session (list vs. detail vs. dashboard disagreeing), not "state
// should survive a hard reload" — real backend data doesn't come from
// localStorage either, so resetting on a full reload is the honest mock
// behavior. `admin-session.ts`'s persisted store (session identity) remains
// the one deliberate exception.

import { create } from "zustand"
import { useShallow } from "zustand/react/shallow"
import {
  managedUsers, listingQueue, kycQueue, badgeQueues, adQueue, stuckOrders,
  platformConfig, membershipPlanVersions, abuseReports, paymentLog,
  notificationTemplates, auditLog,
  type AdminManagedUser, type ListingQueueItem, type KycSubmission, type BadgeQueueItem,
  type AdQueueItem, type StuckOrder, type PlatformConfigEntry, type MembershipPlanVersion,
  type AbuseReport, type PaymentLogEntry, type NotificationTemplate, type AuditLogEntry,
} from "@/lib/admin-data"
import { useAdminSession } from "@/lib/admin-session"

function nowStamp() {
  return new Date().toISOString().slice(0, 16).replace("T", " ")
}

function addDays(dateStr: string | undefined, days: number) {
  const base = dateStr ? new Date(dateStr) : new Date()
  base.setDate(base.getDate() + days)
  return base.toISOString().slice(0, 10)
}

type AdminDataState = {
  users: AdminManagedUser[]
  listings: ListingQueueItem[]
  kyc: KycSubmission[]
  badges: BadgeQueueItem[]
  ads: AdQueueItem[]
  stuckOrders: StuckOrder[]
  platformConfig: PlatformConfigEntry[]
  membershipPlanVersions: MembershipPlanVersion[]
  abuseReports: AbuseReport[]
  paymentLog: PaymentLogEntry[]
  templates: NotificationTemplate[]
  auditLog: AuditLogEntry[]
  nextAuditId: number

  toggleUserStatus: (id: string) => void
  approveListing: (id: string) => void
  rejectListing: (id: string, reason: string) => void
  extendListing: (id: string, days?: number) => string | undefined
  removeListing: (id: string) => void
  decideKyc: (id: string, approved: boolean, reason?: string) => void
  decideBadge: (id: string, granted: boolean) => void
  publishAd: (id: string) => void
  rejectAd: (id: string, reason: string) => void
  manualActivateOrder: (id: string) => void
  updateConfig: (key: string, value: string | number | boolean) => void
  resolveAbuseReport: (id: string, resolution: NonNullable<AbuseReport["resolution"]>) => void
  addRefundNote: (id: string, note: string) => void
  saveTemplateVersion: (eventKey: string, channel: NotificationTemplate["channel"], body: string) => void
}

export const useAdminDataStore = create<AdminDataState>()((set, get) => {
  function pushAudit(action: string, entityType: string, entityId: string) {
    const adminName = useAdminSession.getState().adminUser?.name ?? "Unknown admin"
    const entry: AuditLogEntry = {
      id: get().nextAuditId,
      adminName,
      action,
      entityType,
      entityId,
      ip: "103.21.244.10",
      createdAt: nowStamp(),
    }
    set((s) => ({ auditLog: [entry, ...s.auditLog], nextAuditId: s.nextAuditId + 1 }))
  }

  return {
    users: [...managedUsers],
    listings: [...listingQueue],
    kyc: [...kycQueue],
    badges: [...badgeQueues],
    ads: [...adQueue],
    stuckOrders: [...stuckOrders],
    platformConfig: [...platformConfig],
    membershipPlanVersions: [...membershipPlanVersions],
    abuseReports: [...abuseReports],
    paymentLog: [...paymentLog],
    templates: [...notificationTemplates],
    auditLog: [...auditLog],
    nextAuditId: Math.max(0, ...auditLog.map((a) => a.id)) + 1,

    toggleUserStatus: (id) => {
      const user = get().users.find((u) => u.id === id)
      if (!user) return
      const next = user.status === "Suspended" ? "Active" : "Suspended"
      set((s) => ({ users: s.users.map((u) => (u.id === id ? { ...u, status: next } : u)) }))
      pushAudit(next === "Suspended" ? "user.suspend" : "user.reinstate", "user", id)
    },

    approveListing: (id) => {
      set((s) => ({ listings: s.listings.map((l) => (l.id === id ? { ...l, status: "live" } : l)) }))
      pushAudit("listing.approve", "listing", id)
    },
    rejectListing: (id, reason) => {
      set((s) => ({
        listings: s.listings.map((l) =>
          l.id === id ? { ...l, status: "rejected", rejectionReason: reason || "Rejected by admin." } : l,
        ),
      }))
      pushAudit("listing.reject", "listing", id)
    },
    extendListing: (id, days = 30) => {
      let newExpiresAt: string | undefined
      set((s) => ({
        listings: s.listings.map((l) => {
          if (l.id !== id) return l
          newExpiresAt = addDays(l.expiresAt, days)
          return { ...l, expiresAt: newExpiresAt, validityDays: (l.validityDays ?? 30) + days }
        }),
      }))
      pushAudit("listing.extend", "listing", id)
      return newExpiresAt
    },
    removeListing: (id) => {
      set((s) => ({ listings: s.listings.map((l) => (l.id === id ? { ...l, status: "removed" } : l)) }))
      pushAudit("listing.remove", "listing", id)
    },

    decideKyc: (id, approved, reason) => {
      set((s) => ({
        kyc: s.kyc.map((k) =>
          k.id === id
            ? { ...k, status: approved ? "approved" : "rejected", rejectionReason: approved ? undefined : reason || "Rejected by admin." }
            : k,
        ),
      }))
      pushAudit(approved ? "kyc.approve" : "kyc.reject", "kyc_submission", id)
    },
    decideBadge: (id, granted) => {
      set((s) => ({ badges: s.badges.map((b) => (b.id === id ? { ...b, status: granted ? "granted" : "revoked" } : b)) }))
      pushAudit(granted ? "badge.grant" : "badge.revoke", "badge", id)
    },

    publishAd: (id) => {
      set((s) => ({ ads: s.ads.map((a) => (a.id === id ? { ...a, approvalStatus: "Approved" } : a)) }))
      pushAudit("ad.publish", "ad", id)
    },
    rejectAd: (id, reason) => {
      set((s) => ({
        ads: s.ads.map((a) => (a.id === id ? { ...a, approvalStatus: "Rejected", rejectionReason: reason || "Rejected by admin." } : a)),
      }))
      pushAudit("ad.reject", "ad", id)
    },

    manualActivateOrder: (id) => {
      set((s) => ({ stuckOrders: s.stuckOrders.filter((o) => o.id !== id) }))
      pushAudit("payment.manual_activate", "membership_order", id)
    },

    updateConfig: (key, value) => {
      const adminName = useAdminSession.getState().adminUser?.name ?? "Unknown admin"
      set((s) => ({
        platformConfig: s.platformConfig.map((c) =>
          c.key === key ? { ...c, value, updatedBy: adminName, updatedAt: nowStamp().slice(0, 10) } : c,
        ),
      }))
      pushAudit("config.update", "platform_config", key)
    },

    resolveAbuseReport: (id, resolution) => {
      set((s) => ({
        abuseReports: s.abuseReports.map((r) =>
          r.id === id ? { ...r, status: "resolved", resolution, resolvedAt: nowStamp() } : r,
        ),
      }))
      pushAudit("abuse.resolve", "abuse_report", id)
    },

    addRefundNote: (id, note) => {
      set((s) => ({ paymentLog: s.paymentLog.map((p) => (p.id === id ? { ...p, refundNote: note } : p)) }))
      pushAudit("payment.refund_note", "payment", id)
    },

    saveTemplateVersion: (eventKey, channel, body) => {
      set((s) => ({
        templates: s.templates.map((t) =>
          t.eventKey === eventKey && t.channel === channel
            ? { ...t, version: t.version + 1, bodyPreview: body, updatedAt: nowStamp().slice(0, 10) }
            : t,
        ),
      }))
      pushAudit("template.save_version", "notification_template", `${eventKey}:${channel}`)
    },
  }
})

export function selectQueueCounts(s: AdminDataState) {
  return {
    listings: s.listings.filter((l) => l.status === "pending_review").length,
    kyc: s.kyc.filter((k) => k.status === "pending").length,
    ads: s.ads.filter((a) => a.approvalStatus === "Under Review").length,
    abuse: s.abuseReports.filter((a) => a.status === "open").length,
  }
}
export function useQueueCounts() {
  return useAdminDataStore(useShallow(selectQueueCounts))
}

export function selectSlaBreachCount(s: AdminDataState) {
  const now = Date.now()
  return s.abuseReports.filter((r) => r.status === "open" && new Date(r.slaDueAt).getTime() < now).length
}
export function useSlaBreachCount() {
  return useAdminDataStore(selectSlaBreachCount)
}
