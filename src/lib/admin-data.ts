// Seed data powering the admin console (G1–G10). No real backend — mirrors
// VXP's src/lib/dashboard-data.ts pattern: plain typed arrays. Live reads and
// writes go through src/lib/admin-data-store.ts, which seeds its state from
// these arrays; this file itself is never mutated at runtime.

export type Tier = "Free" | "Mercury" | "Jupiter" | "Venus"

// ── G1 — Dashboard ──────────────────────────────────────────────────────────

export const dashboardKpis = {
  totalSignups: 12480,
  activeListingsByTier: { Free: 640, Mercury: 820, Jupiter: 310, Venus: 70 } as Record<Tier, number>,
  mrr: 1842000,
  leadVolume30d: 9260,
  queueDepths: { listings: 6, kyc: 4, ads: 3, abuse: 5 },
  slaBreaches: 2,
}

// ── G11 — Reports (platform analytics) ──────────────────────────────────────

export type MonthlyMetric = { month: string; value: number }

export const signupsTrend: MonthlyMetric[] = [
  { month: "2026-01", value: 8210 },
  { month: "2026-02", value: 8960 },
  { month: "2026-03", value: 9640 },
  { month: "2026-04", value: 10380 },
  { month: "2026-05", value: 11020 },
  { month: "2026-06", value: 11760 },
  { month: "2026-07", value: 12480 },
]

export const revenueTrend: MonthlyMetric[] = [
  { month: "2026-01", value: 1120000 },
  { month: "2026-02", value: 1245000 },
  { month: "2026-03", value: 1360000 },
  { month: "2026-04", value: 1498000 },
  { month: "2026-05", value: 1612000 },
  { month: "2026-06", value: 1735000 },
  { month: "2026-07", value: 1842000 },
]

// ── G2 — User management ────────────────────────────────────────────────────

export type UserStatus = "Active" | "Suspended" | "Pending"

export type AdminManagedUser = {
  id: string
  name: string
  email: string
  tier: Tier
  role: "user" | "advertiser"
  listings: number
  leads: number
  payments: number
  reports: number
  status: UserStatus
  joinedAt: string
}

export const managedUsers: AdminManagedUser[] = [
  { id: "U-1001", name: "Aarav Mehta", email: "aarav.mehta@gmail.com", tier: "Mercury", role: "user", listings: 3, leads: 22, payments: 2, reports: 0, status: "Active", joinedAt: "2025-11-02" },
  { id: "U-1002", name: "Anjali Iyer", email: "anjali.iyer@gmail.com", tier: "Jupiter", role: "user", listings: 8, leads: 64, payments: 4, reports: 0, status: "Active", joinedAt: "2025-09-18" },
  { id: "U-1003", name: "Vikram Shah", email: "vikram.shah@gmail.com", tier: "Venus", role: "advertiser", listings: 14, leads: 118, payments: 9, reports: 1, status: "Active", joinedAt: "2025-06-30" },
  { id: "U-1004", name: "Priya Desai", email: "priya.desai@gmail.com", tier: "Free", role: "user", listings: 0, leads: 3, payments: 0, reports: 0, status: "Pending", joinedAt: "2026-07-08" },
  { id: "U-1005", name: "Karan Malhotra", email: "karan.malhotra@gmail.com", tier: "Mercury", role: "user", listings: 2, leads: 11, payments: 2, reports: 2, status: "Suspended", joinedAt: "2025-12-14" },
  { id: "U-1006", name: "Sneha Reddy", email: "sneha.reddy@gmail.com", tier: "Jupiter", role: "user", listings: 6, leads: 41, payments: 3, reports: 0, status: "Active", joinedAt: "2025-10-05" },
  { id: "U-1007", name: "Aditya Nair", email: "aditya.nair@gmail.com", tier: "Free", role: "user", listings: 0, leads: 0, payments: 0, reports: 0, status: "Pending", joinedAt: "2026-07-09" },
  { id: "U-1008", name: "Ishaan Kapoor", email: "ishaan.kapoor@gmail.com", tier: "Venus", role: "advertiser", listings: 20, leads: 203, payments: 12, reports: 0, status: "Active", joinedAt: "2025-04-11" },
]

// ── G3 — Membership & payment ops ───────────────────────────────────────────

export type StuckOrder = {
  id: string
  userName: string
  userEmail: string
  plan: string
  amount: string
  razorpayRef: string
  status: "processing" | "failed"
  stuckSince: string
  minutesStuck: number
}

export const stuckOrders: StuckOrder[] = [
  { id: "ORD-8841", userName: "Rahul Bhatia", userEmail: "rahul.bhatia@gmail.com", plan: "Jupiter · 6mo", amount: "₹2,999", razorpayRef: "pay_QK8x91mLp2Rt", status: "processing", stuckSince: "2026-07-10 09:14", minutesStuck: 46 },
  { id: "ORD-8842", userName: "Neha Kulkarni", userEmail: "neha.kulkarni@gmail.com", plan: "Mercury · 3mo", amount: "₹299", razorpayRef: "pay_QK8xA2nQr7Ss", status: "failed", stuckSince: "2026-07-10 08:02", minutesStuck: 118 },
  { id: "ORD-8843", userName: "Farhan Sheikh", userEmail: "farhan.sheikh@gmail.com", plan: "Venus · 6mo", amount: "₹4,999", razorpayRef: "pay_QK8xB3oRs8Tt", status: "processing", stuckSince: "2026-07-10 09:41", minutesStuck: 19 },
]

// ── G4 — Listing moderation ─────────────────────────────────────────────────

export type ListingQueueItem = {
  id: string
  title: string
  location: string
  submittedBy: string
  submittedAt: string
  status: "pending_review" | "live" | "rejected" | "removed"
  rejectionReason?: string
  validityDays?: number
  expiresAt?: string
}

export const listingQueue: ListingQueueItem[] = [
  { id: "LST-3301", title: "Lodha Park — 5 BHK Sky Villa", location: "Lower Parel, Mumbai", submittedBy: "Lodha Group", submittedAt: "2026-07-09 18:22", status: "pending_review" },
  { id: "LST-3302", title: "Hiranandani Estate — Signature Villa", location: "Thane West", submittedBy: "Hiranandani Developers", submittedAt: "2026-07-09 15:10", status: "pending_review" },
  { id: "LST-3303", title: "Runwal Forests — 3 BHK", location: "Kanjurmarg, Mumbai", submittedBy: "Runwal Group", submittedAt: "2026-07-08 11:47", status: "pending_review" },
  { id: "LST-3304", title: "Godrej Emerald — 4 BHK Duplex", location: "Vikhroli, Mumbai", submittedBy: "Godrej Properties", submittedAt: "2026-07-08 09:30", status: "live", validityDays: 30, expiresAt: "2026-08-07" },
  { id: "LST-3305", title: "Sobha Windsor — Studio", location: "Thane", submittedBy: "Sobha Ltd", submittedAt: "2026-07-07 14:00", status: "rejected", rejectionReason: "Missing RERA registration number." },
]

// ── G5 — KYC + badges ────────────────────────────────────────────────────────

export type KycSubmission = {
  id: string
  userName: string
  userEmail: string
  docType: "PAN" | "Aadhaar" | "RERA Certificate" | "GST Certificate"
  submittedAt: string
  status: "pending" | "approved" | "rejected"
  rejectionReason?: string
}

export const kycQueue: KycSubmission[] = [
  { id: "KYC-501", userName: "Vikram Shah", userEmail: "vikram.shah@gmail.com", docType: "RERA Certificate", submittedAt: "2026-07-09 12:05", status: "pending" },
  { id: "KYC-502", userName: "Sneha Reddy", userEmail: "sneha.reddy@gmail.com", docType: "PAN", submittedAt: "2026-07-09 10:40", status: "pending" },
  { id: "KYC-503", userName: "Ishaan Kapoor", userEmail: "ishaan.kapoor@gmail.com", docType: "GST Certificate", submittedAt: "2026-07-08 16:22", status: "pending" },
  { id: "KYC-504", userName: "Rahul Bhatia", userEmail: "rahul.bhatia@gmail.com", docType: "Aadhaar", submittedAt: "2026-07-07 09:15", status: "approved" },
]

export type BadgeQueueItem = {
  id: string
  entityName: string
  badgeType: "Jupiter Verified" | "Featured Developer"
  submittedAt: string
  status: "pending" | "granted" | "revoked"
}

export const badgeQueues: BadgeQueueItem[] = [
  { id: "BDG-201", entityName: "Anjali Iyer", badgeType: "Jupiter Verified", submittedAt: "2026-07-09 11:00", status: "pending" },
  { id: "BDG-202", entityName: "Lodha Group", badgeType: "Featured Developer", submittedAt: "2026-07-08 17:45", status: "pending" },
  { id: "BDG-203", entityName: "Godrej Properties", badgeType: "Featured Developer", submittedAt: "2026-07-05 10:00", status: "granted" },
]

// ── G6 — Ad approval ─────────────────────────────────────────────────────────

export type AdQueueItem = {
  id: string
  headline: string
  advertiser: string
  slot: "Homepage Hero" | "Search Spotlight" | "Featured Developer"
  amount: string
  paymentStatus: "Paid" | "Pending"
  approvalStatus: "Under Review" | "Approved" | "Rejected"
  submittedAt: string
  rejectionReason?: string
}

export const adQueue: AdQueueItem[] = [
  { id: "AD-103", headline: "Lodha Park — Sky Villas Now Open", advertiser: "Lodha Group", slot: "Homepage Hero", amount: "₹49,999", paymentStatus: "Paid", approvalStatus: "Under Review", submittedAt: "2026-07-09 13:20" },
  { id: "AD-104", headline: "Runwal Forests — Launch Offer", advertiser: "Runwal Group", slot: "Search Spotlight", amount: "₹18,500", paymentStatus: "Paid", approvalStatus: "Under Review", submittedAt: "2026-07-09 09:55" },
  { id: "AD-105", headline: "Sobha Windsor — Studios from ₹45L", advertiser: "Sobha Ltd", slot: "Featured Developer", amount: "₹22,000", paymentStatus: "Pending", approvalStatus: "Under Review", submittedAt: "2026-07-08 20:10" },
]

// ── G7 — Notification templates ─────────────────────────────────────────────

export type NotificationChannel = "email" | "sms" | "whatsapp" | "push"

export type NotificationTemplate = {
  eventKey: string
  eventLabel: string
  channel: NotificationChannel
  version: number
  updatedAt: string
  bodyPreview: string
}

export const notificationTemplates: NotificationTemplate[] = [
  { eventKey: "listing.approved", eventLabel: "Listing approved", channel: "email", version: 3, updatedAt: "2026-06-18", bodyPreview: "Your listing \"{{title}}\" is now live on Vexora." },
  { eventKey: "listing.approved", eventLabel: "Listing approved", channel: "whatsapp", version: 2, updatedAt: "2026-05-02", bodyPreview: "listing_approved_v2 (BSP-approved template)" },
  { eventKey: "listing.rejected", eventLabel: "Listing rejected", channel: "email", version: 2, updatedAt: "2026-06-18", bodyPreview: "Your listing \"{{title}}\" needs changes: {{reason}}" },
  { eventKey: "kyc.approved", eventLabel: "KYC approved", channel: "sms", version: 1, updatedAt: "2026-04-11", bodyPreview: "Your KYC is verified. Verified badge is now active." },
  { eventKey: "payment.failed", eventLabel: "Payment failed", channel: "push", version: 4, updatedAt: "2026-07-01", bodyPreview: "Payment for {{plan}} didn't go through — tap to retry." },
  { eventKey: "abuse.resolved", eventLabel: "Abuse report resolved", channel: "email", version: 1, updatedAt: "2026-03-22", bodyPreview: "We've reviewed your report on {{entity}} and taken action." },
]

// ── G8 — Platform configuration ─────────────────────────────────────────────

export type ConfigType = "int" | "decimal" | "string" | "boolean" | "json"

export type PlatformConfigEntry = {
  key: string
  label: string
  value: string | number | boolean
  type: ConfigType
  description: string
  updatedBy: string
  updatedAt: string
}

export const platformConfig: PlatformConfigEntry[] = [
  { key: "listing_validity_days", label: "Listing validity (days)", value: 30, type: "int", description: "Days a live listing stays active before it must be renewed.", updatedBy: "Priya Nair", updatedAt: "2026-05-10" },
  { key: "mercury_price_inr", label: "Mercury plan price (₹ / 3mo)", value: 299, type: "int", description: "Mercury tier subscription price.", updatedBy: "Meera Shah", updatedAt: "2026-06-01" },
  { key: "jupiter_price_inr", label: "Jupiter plan price (₹ / 6mo)", value: 2999, type: "int", description: "Jupiter tier subscription price.", updatedBy: "Meera Shah", updatedAt: "2026-06-01" },
  { key: "venus_price_inr", label: "Venus plan price (₹ / 6mo)", value: 4999, type: "int", description: "Venus tier subscription price.", updatedBy: "Meera Shah", updatedAt: "2026-06-01" },
  { key: "free_listing_quota", label: "Free tier listing quota", value: 1, type: "int", description: "Max concurrent live listings for Free tier users.", updatedBy: "Priya Nair", updatedAt: "2026-02-14" },
  { key: "abuse_sla_hours", label: "Abuse report SLA (hours)", value: 48, type: "int", description: "Target resolution time for abuse reports (BR-83).", updatedBy: "Priya Nair", updatedAt: "2026-01-30" },
  { key: "kyc_auto_reindex", label: "Re-index on KYC approval", value: true, type: "boolean", description: "Trigger search re-index immediately when KYC/Verified badge is granted.", updatedBy: "Rohan Kulkarni", updatedAt: "2026-04-02" },
  { key: "referral_reward_days", label: "Referral reward (days)", value: 30, type: "int", description: "Membership extension days credited to the referrer on a referred signup's payment capture (BR-34). Extension days only — no cashback.", updatedBy: "Priya Nair", updatedAt: "2026-05-10" },
]

export type MembershipPlanVersion = {
  tier: Tier
  version: number
  priceInr: number
  billingCycleMonths: number
  effectiveFrom: string
  isCurrent: boolean
}

export const membershipPlanVersions: MembershipPlanVersion[] = [
  { tier: "Mercury", version: 3, priceInr: 299, billingCycleMonths: 3, effectiveFrom: "2026-06-01", isCurrent: true },
  { tier: "Mercury", version: 2, priceInr: 249, billingCycleMonths: 3, effectiveFrom: "2025-11-01", isCurrent: false },
  { tier: "Jupiter", version: 2, priceInr: 2999, billingCycleMonths: 6, effectiveFrom: "2026-06-01", isCurrent: true },
  { tier: "Venus", version: 2, priceInr: 4999, billingCycleMonths: 6, effectiveFrom: "2026-06-01", isCurrent: true },
]

// ── G9 — Abuse report queue ──────────────────────────────────────────────────

export type AbuseReport = {
  id: string
  entityType: "listing" | "user" | "ad"
  entityLabel: string
  reason: string
  reportedBy: string
  reportedAt: string
  slaDueAt: string
  status: "open" | "resolved"
  resolution?: "none" | "warning" | "hide" | "remove" | "suspend"
  resolvedAt?: string
}

export const abuseReports: AbuseReport[] = [
  { id: "ABR-701", entityType: "listing", entityLabel: "LST-3301 — Lodha Park Sky Villa", reason: "Suspected duplicate listing", reportedBy: "user report", reportedAt: "2026-07-09 20:00", slaDueAt: "2026-07-11 20:00", status: "open" },
  { id: "ABR-702", entityType: "user", entityLabel: "U-1005 — Karan Malhotra", reason: "Spam messages to leads", reportedBy: "user report", reportedAt: "2026-07-08 08:30", slaDueAt: "2026-07-10 08:30", status: "open" },
  { id: "ABR-703", entityType: "ad", entityLabel: "AD-098 — misleading price claim", reason: "Price shown doesn't match listing", reportedBy: "automated scan", reportedAt: "2026-07-06 14:00", slaDueAt: "2026-07-08 14:00", status: "resolved", resolution: "remove", resolvedAt: "2026-07-07 09:15" },
]

// ── G10 — Payment log, refund notes, audit log ──────────────────────────────

export type PaymentLogEntry = {
  id: string
  userName: string
  purpose: string
  amount: string
  status: "captured" | "refunded" | "failed"
  razorpayRef: string
  createdAt: string
  refundNote?: string
}

export const paymentLog: PaymentLogEntry[] = [
  { id: "PAY-9001", userName: "Aarav Mehta", purpose: "Mercury renewal", amount: "₹299", status: "captured", razorpayRef: "pay_QJ2xC1abcd", createdAt: "2026-07-09 10:12" },
  { id: "PAY-9002", userName: "Vikram Shah", purpose: "Venus renewal", amount: "₹4,999", status: "captured", razorpayRef: "pay_QJ2xC2efgh", createdAt: "2026-07-08 16:45" },
  { id: "PAY-9003", userName: "Ishaan Kapoor", purpose: "Ad — Homepage Hero", amount: "₹49,999", status: "refunded", razorpayRef: "pay_QJ2xC3ijkl", createdAt: "2026-07-05 12:00", refundNote: "Creative rejected twice — goodwill refund approved by finance." },
  { id: "PAY-9004", userName: "Karan Malhotra", purpose: "Mercury renewal", amount: "₹299", status: "failed", razorpayRef: "pay_QJ2xC4mnop", createdAt: "2026-07-10 08:02" },
]

export type AuditLogEntry = {
  id: number
  adminName: string
  action: string
  entityType: string
  entityId: string
  ip: string
  createdAt: string
}

export const auditLog: AuditLogEntry[] = [
  { id: 5031, adminName: "Priya Nair", action: "listing.approve", entityType: "listing", entityId: "LST-3298", ip: "103.21.244.10", createdAt: "2026-07-10 07:40" },
  { id: 5030, adminName: "Rohan Kulkarni", action: "kyc.approve", entityType: "kyc_submission", entityId: "KYC-497", ip: "103.21.244.11", createdAt: "2026-07-10 07:12" },
  { id: 5029, adminName: "Meera Shah", action: "payment.manual_activate", entityType: "membership_order", entityId: "ORD-8830", ip: "49.207.10.5", createdAt: "2026-07-09 22:03" },
  { id: 5028, adminName: "Priya Nair", action: "config.update", entityType: "platform_config", entityId: "listing_validity_days", ip: "103.21.244.10", createdAt: "2026-05-10 11:20" },
  { id: 5027, adminName: "Arjun Verma", action: "abuse.resolve", entityType: "abuse_report", entityId: "ABR-698", ip: "103.21.244.12", createdAt: "2026-07-08 14:02" },
]
