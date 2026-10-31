import { baseApi } from "./baseApi"

// Shapes below were captured live from vex-dev (2026-10-25), not copied from
// the spec. Envelope is { data } everywhere except DELETE /admin/config/:key,
// which returns { message } — see deleteConfig.

type Paged = { page: number; limit: number; total: number; hasMore: boolean }

function params(obj: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined && v !== null && v !== ""))
}

// ── G1 Dashboard ────────────────────────────────────────────────────────────
export type AdminDashboard = {
  users: { signups: { today: number; last7d: number; last30d: number }; active: number; suspended: number }
  listings: { byStatus: Record<string, number>; moderationQueue: number }
  abuse: { open: number; slaBreached: number }
  memberships: { byTier: Partial<Record<"mercury" | "jupiter" | "venus", number>> }
  leads: { last30d: number }
  mrr: number | null
  queues: { kyc: number; ads: number }
  /** Dotted paths of fields that are still stubs — render those as "not available yet", never as a real 0/null. */
  pending: string[]
}

// ── G2 Users ────────────────────────────────────────────────────────────────
export type AdminUserStatus = "active" | "suspended" | "deleted"
export type AdminUserRow = {
  _id: string
  email?: string | null
  mobile?: string | null
  status: AdminUserStatus
  createdAt: string
  lastLoginAt?: string | null
}
export type AdminUserDetail = {
  user: {
    id: string
    email: string | null
    mobile: string | null
    status: AdminUserStatus
    mobileVerifiedAt: string | null
    lastLoginAt: string | null
    createdAt: string
  }
  profile: { fullName?: string | null; city?: string | null; state?: string | null; intent?: string | null; completedAt?: string | null } | null
  memberships: { tier: string; status: string; startsAt?: string; expiresAt?: string }[]
  listings: { byStatus: Record<string, number>; recent: { _id: string; title: string; status: string; pricePaise?: number; city?: string; createdAt: string }[] }
  leads: { asBuyer: number; asSeller: number }
  payments: { count: number }
  abuseReportsAgainst: number
}

// ── G4 Listing moderation ───────────────────────────────────────────────────
/** Full raw listing document — pick the fields a reviewer needs, don't render it all. */
export type AdminListing = {
  _id: string
  sellerId: string
  title: string
  slug: string
  purpose: string
  propertyType: string
  status: string
  bhk?: number
  pricePaise?: number
  areaSqft?: number
  description?: string
  city?: string
  locality?: string
  state?: string
  pincode?: string
  submittedAt?: string
  publishedAt?: string
  expiresAt?: string
  rejectionReason?: string
  createdAt: string
  updatedAt: string
  [key: string]: unknown
}

// ── G6 Ads ──────────────────────────────────────────────────────────────────
export type AdProduct = "banner" | "sponsored" | "featured" | "project_promotion"
export type AdminAd = {
  _id: string
  ownerId: string
  product: AdProduct
  listingId?: string
  projectId?: string
  targetCity?: string
  status: string
  amountPaise?: number
  packageId?: string
  startsAt?: string
  endsAt?: string
  creatives?: { mediaType: string; cloudinaryPublicId: string; targetUrl?: string }[]
  rejectionReason?: string
  createdAt: string
  [key: string]: unknown
}
export type AdPackage = {
  _id: string
  product: AdProduct
  name: string
  durationDays: number
  pricePaise: number
  isActive: boolean
  version: number
  createdAt: string
}

// ── G9 Abuse ────────────────────────────────────────────────────────────────
export type AbuseStatus = "open" | "in_review" | "resolved" | "dismissed"
export type AbuseAction = "none" | "warning" | "listing_hidden" | "listing_removed" | "user_suspended"
export type AbuseReport = {
  _id: string
  reporterId: string
  listingId?: string
  reportedUserId?: string
  reason: string
  details?: string
  status: AbuseStatus
  slaDueAt: string
  actionTaken?: AbuseAction
  resolutionNote?: string
  /** Set once the report is closed (verified live). */
  resolvedAt?: string
  /** Admin id that closed it. */
  resolvedBy?: string
  createdAt: string
  updatedAt: string
}
export type AbuseResolveResult = {
  report: AbuseReport
  /** The report is ALWAYS closed; enforcement is best-effort — check `done`. */
  enforcement?: { action: AbuseAction; done: boolean; error?: string }
}

// ── G8 Config / plans / amenities / locations ───────────────────────────────
export type ConfigType = "string" | "int" | "decimal" | "boolean" | "json"
/** `_id` IS the config key. */
export type ConfigEntry = {
  _id: string
  value: unknown
  type: ConfigType
  description: string
  updatedBy?: string
  updatedAt: string
  createdAt: string
}
export type AdminMembershipPlan = {
  _id: string
  tier: "mercury" | "jupiter" | "venus"
  name: string
  pricePaise: number
  durationDays: number
  listingQuota: number
  features: Record<string, boolean>
  isActive: boolean
  version: number
  updatedAt: string
}
export type Amenity = { _id: string; name: string; icon: string; category?: string; isActive: boolean }
export type LocationType = "country" | "state" | "district" | "city" | "locality"
export type LocationActivation = "active" | "inactive" | "coming_soon"
export type AdminLocation = {
  _id: string
  name: string
  slug: string
  type: LocationType
  parentId: string | null
  state?: string | null
  district?: string | null
  pincode?: string | null
  activation: LocationActivation
  aliases: string[]
  displayPath: string
}

// ── G7 Templates ────────────────────────────────────────────────────────────
export type TemplateChannel = "email" | "whatsapp" | "in_app" | string
export type TemplateVersion = {
  id: string
  version: number
  subject: string | null
  body: string
  whatsappTemplateName: string | null
  updatedAt: string
}
export type TemplateEvent = {
  eventKey: string
  domain: string
  isSuppressible: boolean
  /** null = event not wired yet; the backend does no variable check on save. */
  variables: string[] | null
  channels: Record<TemplateChannel, TemplateVersion>
}

// ── Audit log ───────────────────────────────────────────────────────────────
export type AuditEntry = {
  _id: string
  adminUserId: string
  action: string
  entityType: string
  entityId: string
  before?: unknown
  after?: unknown
  ip?: string
  requestId?: string
  createdAt: string
}

// ── G3 Payment ops ──────────────────────────────────────────────────────────
// Built by the backend on 2026-10-27 (KNOWN-ISSUES #25). The spec only says
// "{ orders, page, limit, total }" for the list, so each row is normalised
// from the fields the backend described (user name/mobile/email, plan,
// Razorpay refs, minutes stuck) — both `id` and `_id`, nested or flat.
export type StuckOrder = {
  id: string
  status: string
  purpose: string | null
  amountPaise: number | null
  planName: string | null
  planTier: string | null
  userId: string | null
  userName: string | null
  userMobile: string | null
  userEmail: string | null
  razorpayOrderId: string | null
  razorpayPaymentId: string | null
  createdAt: string | null
  minutesStuck: number | null
  /**
   * Live view from Razorpay's API (fetched by the backend on every list
   * call). undefined = the backend didn't send it; null = a free (₹0)
   * order that never existed on Razorpay.
   */
  live: RazorpayLive | null | undefined
}

export type RazorpayPayment = {
  id: string
  /** created | authorized | captured | refunded | failed */
  status: string
  method: string | null
  /** Bank / UPI id / wallet / card network + last 4 — whatever applies. */
  detail: string | null
  amountPaise: number | null
  feePaise: number | null
  error: string | null
  refundStatus: string | null
  createdAt: string | null
}

export type RazorpayLive = {
  /** Razorpay order status: created | attempted | paid */
  orderStatus: string | null
  amountPaidPaise: number | null
  payments: RazorpayPayment[]
  /** Set when the backend couldn't reach Razorpay for this order. */
  fetchError: string | null
}

type RawRecord = Record<string, unknown>
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v : null)
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null)
const rec = (v: unknown): RawRecord => (v && typeof v === "object" ? (v as RawRecord) : {})

// Razorpay timestamps are unix seconds; the backend may pass ISO strings.
const when = (v: unknown) => (typeof v === "number" ? new Date(v * 1000).toISOString() : str(v))

function toRazorpayPayment(raw: RawRecord): RazorpayPayment {
  const card = rec(raw.card)
  const upi = rec(raw.upi)
  const acquirer = rec(raw.acquirer_data ?? raw.acquirerData)
  const cardText = [str(card.network), str(card.last4) ? `•••• ${str(card.last4)}` : null].filter(Boolean).join(" ")
  return {
    id: str(raw.id) ?? str(raw.paymentId) ?? str(raw.razorpayPaymentId) ?? "",
    status: str(raw.status) ?? "unknown",
    method: str(raw.method),
    detail:
      str(raw.vpa) ?? str(upi.vpa) ?? str(raw.bank) ?? str(raw.wallet) ?? (cardText || null) ?? str(raw.detail) ?? str(acquirer.bank_transaction_id),
    amountPaise: num(raw.amount) ?? num(raw.amountPaise),
    feePaise: num(raw.fee) ?? num(raw.feePaise),
    error:
      str(raw.error_description) ?? str(raw.errorDescription) ?? str(rec(raw.error).description) ?? str(raw.error_reason) ?? str(raw.errorReason) ?? str(raw.error),
    refundStatus: str(raw.refund_status) ?? str(raw.refundStatus),
    createdAt: when(raw.created_at ?? raw.createdAt),
  }
}

function toRazorpayLive(raw: unknown): RazorpayLive | null | undefined {
  if (raw === undefined) return undefined
  if (raw === null) return null
  const r = rec(raw)
  const order = rec(r.order)
  const list = r.payments ?? r.attempts ?? rec(r.payments).items ?? r.items
  const items = Array.isArray(list) ? list : Array.isArray(rec(list).items) ? (rec(list).items as unknown[]) : []
  return {
    orderStatus: str(r.orderStatus) ?? str(order.status) ?? str(r.status),
    amountPaidPaise: num(r.amountPaid) ?? num(r.amount_paid) ?? num(order.amount_paid),
    payments: items.map((p) => toRazorpayPayment(rec(p))).filter((p) => p.id),
    fetchError: str(r.error) ?? str(r.fetchError) ?? str(rec(r.error).message),
  }
}

/** The payment that counts: captured first, then authorized, else the latest attempt. */
export function primaryPayment(live: RazorpayLive | null | undefined): RazorpayPayment | null {
  const payments = live?.payments ?? []
  return (
    payments.find((p) => p.status === "captured") ??
    payments.find((p) => p.status === "authorized") ??
    [...payments].sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""))[0] ??
    null
  )
}

function toStuckOrder(raw: RawRecord): StuckOrder {
  const live = toRazorpayLive(raw.razorpayLiveStatus)
  const user = rec(raw.user ?? raw.userId)
  const plan = rec(raw.plan ?? raw.planId)
  const createdAt = str(raw.createdAt)
  const minutes =
    num(raw.minutesStuck) ?? (createdAt ? Math.floor((Date.now() - new Date(createdAt).getTime()) / 60_000) : null)
  return {
    id: str(raw.id) ?? str(raw._id) ?? str(raw.orderId) ?? "",
    status: str(raw.status) ?? "processing",
    purpose: str(raw.purpose),
    amountPaise: num(raw.amountPaise),
    planName: str(plan.name) ?? str(raw.planName),
    planTier: str(plan.tier) ?? str(raw.tier),
    userId: str(user.id) ?? str(user._id) ?? str(raw.userId),
    userName: str(user.name) ?? str(user.fullName) ?? str(raw.userName),
    userMobile: str(user.mobile) ?? str(raw.userMobile),
    userEmail: str(user.email) ?? str(raw.userEmail),
    razorpayOrderId: str(raw.razorpayOrderId),
    // Not on the stuck list today (KNOWN gap) — picked up from any likely
    // field so it shows as soon as the backend adds it.
    razorpayPaymentId:
      (live ? (live.payments.find((p) => p.status === "captured")?.id ?? null) : null) ??
      str(raw.razorpayPaymentId) ?? str(raw.paymentId) ?? str(rec(raw.payment).razorpayPaymentId) ?? str(rec(raw.payment).id) ?? str(rec(raw.razorpay).paymentId),
    createdAt,
    minutesStuck: minutes,
    live,
  }
}

export const adminApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // G1
    getDashboard: builder.query<AdminDashboard, void>({
      query: () => ({ url: "/api/v1/admin/dashboard" }),
      transformResponse: (res: { data: AdminDashboard }) => res.data,
      providesTags: ["Dashboard"],
    }),

    // G2 — offset paging. filter[tier] → 400 NOT_IMPLEMENTED, so it's not exposed.
    getUsers: builder.query<{ users: AdminUserRow[] } & Paged, { search?: string; status?: AdminUserStatus; page?: number; limit?: number }>({
      query: ({ search, status, page, limit }) => ({
        url: "/api/v1/admin/users",
        params: params({ search, "filter[status]": status, page, limit }),
      }),
      transformResponse: (res: { data: { users: AdminUserRow[] } & Paged }) => res.data,
      providesTags: ["Users"],
    }),
    getUser: builder.query<AdminUserDetail, string>({
      query: (id) => ({ url: `/api/v1/admin/users/${id}` }),
      transformResponse: (res: { data: AdminUserDetail }) => res.data,
      providesTags: (_r, _e, id) => [{ type: "Users", id }],
    }),
    // ⚠ step-up. Reason required (whitespace rejected).
    suspendUser: builder.mutation<{ id: string; status: AdminUserStatus; reason: string }, { id: string; reason: string }>({
      query: ({ id, reason }) => ({ url: `/api/v1/admin/users/${id}/suspend`, method: "POST", body: { reason } }),
      transformResponse: (res: { data: { id: string; status: AdminUserStatus; reason: string } }) => res.data,
      invalidatesTags: (_r, _e, { id }) => ["Users", { type: "Users", id }, "Dashboard", "Audit"],
    }),
    // No step-up (lower-risk direction), reason still required.
    reinstateUser: builder.mutation<{ id: string; status: AdminUserStatus; reason: string }, { id: string; reason: string }>({
      query: ({ id, reason }) => ({ url: `/api/v1/admin/users/${id}/reinstate`, method: "POST", body: { reason } }),
      transformResponse: (res: { data: { id: string; status: AdminUserStatus; reason: string } }) => res.data,
      invalidatesTags: (_r, _e, { id }) => ["Users", { type: "Users", id }, "Dashboard", "Audit"],
    }),
    // ⚠ step-up, super_admin. Takes an ADMIN id, never a regular user id.
    resetAdmin2fa: builder.mutation<{ id: string; email: string; twoFactorReset: boolean }, string>({
      query: (adminId) => ({ url: `/api/v1/admin/users/${adminId}/reset-2fa`, method: "POST" }),
      transformResponse: (res: { data: { id: string; email: string; twoFactorReset: boolean } }) => res.data,
      invalidatesTags: ["Audit"],
    }),

    // G4 — full raw documents, oldest-submitted first.
    getListingQueue: builder.query<AdminListing[], void>({
      query: () => ({ url: "/api/v1/admin/listings/queue" }),
      transformResponse: (res: { data: { listings: AdminListing[] } }) => res.data.listings,
      providesTags: ["ListingQueue"],
    }),
    approveListing: builder.mutation<{ status: string; publishedAt: string; expiresAt: string }, string>({
      query: (id) => ({ url: `/api/v1/admin/listings/${id}/approve`, method: "POST" }),
      transformResponse: (res: { data: { status: string; publishedAt: string; expiresAt: string } }) => res.data,
      invalidatesTags: ["ListingQueue", "Dashboard", "Audit"],
    }),
    rejectListing: builder.mutation<{ status: string; rejectionReason: string }, { id: string; reason: string }>({
      query: ({ id, reason }) => ({ url: `/api/v1/admin/listings/${id}/reject`, method: "POST", body: { reason } }),
      transformResponse: (res: { data: { status: string; rejectionReason: string } }) => res.data,
      invalidatesTags: ["ListingQueue", "Dashboard", "Audit"],
    }),
    // ⚠ step-up. days: positive integer.
    extendListing: builder.mutation<{ expiresAt: string; days: number }, { id: string; days: number }>({
      query: ({ id, days }) => ({ url: `/api/v1/admin/listings/${id}/extend`, method: "POST", body: { days } }),
      transformResponse: (res: { data: { expiresAt: string; days: number } }) => res.data,
      invalidatesTags: ["ListingQueue", "Audit"],
    }),
    // ⚠ step-up.
    removeListing: builder.mutation<{ status: string; rejectionReason: string }, { id: string; reason: string }>({
      query: ({ id, reason }) => ({ url: `/api/v1/admin/listings/${id}/remove`, method: "POST", body: { reason } }),
      transformResponse: (res: { data: { status: string; rejectionReason: string } }) => res.data,
      invalidatesTags: ["ListingQueue", "Dashboard", "Audit"],
    }),

    // G6
    getAdQueue: builder.query<AdminAd[], void>({
      query: () => ({ url: "/api/v1/admin/ads/queue" }),
      transformResponse: (res: { data: AdminAd[] }) => res.data,
      providesTags: ["AdQueue"],
    }),
    approveAd: builder.mutation<{ status: string }, string>({
      query: (id) => ({ url: `/api/v1/admin/ads/${id}/approve`, method: "POST" }),
      transformResponse: (res: { data: { status: string } }) => res.data,
      invalidatesTags: ["AdQueue", "Dashboard", "Audit"],
    }),
    rejectAd: builder.mutation<{ status: string; rejectionReason: string }, { id: string; reason: string }>({
      query: ({ id, reason }) => ({ url: `/api/v1/admin/ads/${id}/reject`, method: "POST", body: { reason } }),
      transformResponse: (res: { data: { status: string; rejectionReason: string } }) => res.data,
      invalidatesTags: ["AdQueue", "Dashboard", "Audit"],
    }),
    getAdPackages: builder.query<AdPackage[], void>({
      query: () => ({ url: "/api/v1/admin/ad-packages" }),
      transformResponse: (res: { data: AdPackage[] }) => res.data,
      providesTags: ["AdPackages"],
    }),
    // ⚠ step-up, super_admin. NOTE (verified live): PATCH creates a NEW
    // version with a NEW _id and leaves the old version active — deactivate
    // the old id afterwards, or sellers see both.
    createAdPackage: builder.mutation<AdPackage, Pick<AdPackage, "product" | "name" | "durationDays" | "pricePaise">>({
      query: (body) => ({ url: "/api/v1/admin/ad-packages", method: "POST", body }),
      transformResponse: (res: { data: AdPackage }) => res.data,
      invalidatesTags: ["AdPackages", "Audit"],
    }),
    updateAdPackage: builder.mutation<AdPackage, { id: string; body: Partial<Pick<AdPackage, "name" | "durationDays" | "pricePaise">> }>({
      query: ({ id, body }) => ({ url: `/api/v1/admin/ad-packages/${id}`, method: "PATCH", body }),
      transformResponse: (res: { data: AdPackage }) => res.data,
      invalidatesTags: ["AdPackages", "Audit"],
    }),
    // Soft-deactivate (isActive:false) — existing orders keep working.
    deactivateAdPackage: builder.mutation<AdPackage, string>({
      query: (id) => ({ url: `/api/v1/admin/ad-packages/${id}`, method: "DELETE" }),
      transformResponse: (res: { data: AdPackage }) => res.data,
      invalidatesTags: ["AdPackages", "Audit"],
    }),

    // G9 — offset paging. NOTE: an unknown filter[status] returns [] (no 400).
    getAbuseReports: builder.query<{ reports: AbuseReport[] } & Paged, { status?: AbuseStatus; reason?: string; page?: number; limit?: number }>({
      query: ({ status, reason, page, limit }) => ({
        url: "/api/v1/admin/abuse-reports",
        params: params({ "filter[status]": status, "filter[reason]": reason, page, limit }),
      }),
      transformResponse: (res: { data: { reports: AbuseReport[] } & Paged }) => res.data,
      providesTags: ["Abuse"],
    }),
    // ⚠ step-up.
    resolveAbuseReport: builder.mutation<AbuseResolveResult, { id: string; action: AbuseAction; note?: string }>({
      query: ({ id, action, note }) => ({
        url: `/api/v1/admin/abuse-reports/${id}/resolve`,
        method: "POST",
        body: { action, ...(note ? { note } : {}) },
      }),
      transformResponse: (res: { data: AbuseResolveResult }) => res.data,
      invalidatesTags: ["Abuse", "Dashboard", "Users", "ListingQueue", "Audit"],
    }),

    // G3 — orders in `processing` (verify succeeded, webhook never arrived).
    getStuckOrders: builder.query<{ orders: StuckOrder[]; page: number; limit: number; total: number }, { olderThanMinutes?: number; page?: number; limit?: number }>({
      query: ({ olderThanMinutes, page, limit }) => ({
        url: "/api/v1/admin/payment-ops/stuck",
        params: params({ olderThanMinutes, page, limit }),
      }),
      transformResponse: (res: { data: { orders?: RawRecord[]; page?: number; limit?: number; total?: number } }) => {
        const orders = (res.data?.orders ?? []).map(toStuckOrder)
        return { orders, page: res.data?.page ?? 1, limit: res.data?.limit ?? orders.length, total: res.data?.total ?? orders.length }
      },
      providesTags: ["PaymentOps"],
    }),
    // ⚠ step-up. Same ActivationService as the webhook; idempotent server-side.
    // razorpayPaymentId is optional only for a ₹0 order.
    activateStuckOrder: builder.mutation<RawRecord, { id: string; note: string; razorpayPaymentId?: string }>({
      query: ({ id, note, razorpayPaymentId }) => ({
        url: `/api/v1/admin/payment-ops/orders/${id}/activate`,
        method: "POST",
        body: { note, ...(razorpayPaymentId ? { razorpayPaymentId } : {}) },
      }),
      transformResponse: (res: { data: RawRecord }) => res.data,
      invalidatesTags: ["PaymentOps", "Dashboard", "Users", "Audit"],
    }),
    // Marks a stuck/bad order `rejected` with a reason (kept, not deleted);
    // idempotent. 409 INVALID_STATE_TRANSITION once it's paid/activated.
    // Rejected orders drop out of the stuck list, so the page keeps them
    // (see payment-ops page) to offer Delete.
    rejectStuckOrder: builder.mutation<RawRecord, { id: string; reason: string }>({
      query: ({ id, reason }) => ({ url: `/api/v1/admin/payment-ops/orders/${id}/reject`, method: "POST", body: { reason } }),
      transformResponse: (res: { data: RawRecord }) => res.data,
      invalidatesTags: ["PaymentOps", "Dashboard", "Audit"],
    }),

    // Permanent. Only allowed once the order is `rejected` (409
    // INVALID_STATE_TRANSITION otherwise) — a deliberate second step.
    deleteRejectedOrder: builder.mutation<{ id: string; deleted: boolean }, string>({
      query: (id) => ({ url: `/api/v1/admin/payment-ops/orders/${id}`, method: "DELETE" }),
      transformResponse: (res: { data: { id: string; deleted: boolean } }) => res.data,
      invalidatesTags: ["PaymentOps", "Audit"],
    }),

    // G8 config — any admin reads; writes are super_admin + ⚠ step-up.
    getConfig: builder.query<ConfigEntry[], void>({
      query: () => ({ url: "/api/v1/admin/config" }),
      transformResponse: (res: { data: ConfigEntry[] }) => res.data,
      providesTags: ["Config"],
    }),
    putConfig: builder.mutation<ConfigEntry, { key: string; value: unknown; type: ConfigType; description: string }>({
      query: ({ key, ...body }) => ({ url: `/api/v1/admin/config/${encodeURIComponent(key)}`, method: "PUT", body }),
      transformResponse: (res: { data: ConfigEntry }) => res.data,
      invalidatesTags: ["Config", "Audit"],
    }),
    // The one success response WITHOUT a `data` envelope: { message }.
    deleteConfig: builder.mutation<{ message: string }, string>({
      query: (key) => ({ url: `/api/v1/admin/config/${encodeURIComponent(key)}`, method: "DELETE" }),
      invalidatesTags: ["Config", "Audit"],
    }),

    getMembershipPlans: builder.query<AdminMembershipPlan[], void>({
      query: () => ({ url: "/api/v1/admin/membership-plans" }),
      transformResponse: (res: { data: { plans: AdminMembershipPlan[] } }) => res.data.plans,
      providesTags: ["Plans"],
    }),
    createMembershipPlan: builder.mutation<AdminMembershipPlan, Pick<AdminMembershipPlan, "tier" | "name" | "pricePaise" | "durationDays" | "listingQuota"> & { features?: Record<string, boolean> }>({
      query: (body) => ({ url: "/api/v1/admin/membership-plans", method: "POST", body }),
      transformResponse: (res: { data: AdminMembershipPlan }) => res.data,
      invalidatesTags: ["Plans", "Audit"],
    }),
    // Price/duration/quota changes create a new version; cosmetic changes mutate in place.
    updateMembershipPlan: builder.mutation<AdminMembershipPlan, { id: string; body: Partial<AdminMembershipPlan> }>({
      query: ({ id, body }) => ({ url: `/api/v1/admin/membership-plans/${id}`, method: "PATCH", body }),
      transformResponse: (res: { data: AdminMembershipPlan }) => res.data,
      invalidatesTags: ["Plans", "Audit"],
    }),
    deactivateMembershipPlan: builder.mutation<AdminMembershipPlan, string>({
      query: (id) => ({ url: `/api/v1/admin/membership-plans/${id}`, method: "DELETE" }),
      transformResponse: (res: { data: AdminMembershipPlan }) => res.data,
      invalidatesTags: ["Plans", "Audit"],
    }),

    getAmenities: builder.query<Amenity[], void>({
      query: () => ({ url: "/api/v1/admin/amenities" }),
      transformResponse: (res: { data: { amenities: Amenity[] } }) => res.data.amenities,
      providesTags: ["Amenities"],
    }),
    createAmenity: builder.mutation<Amenity, Omit<Amenity, "_id">>({
      query: (body) => ({ url: "/api/v1/admin/amenities", method: "POST", body }),
      transformResponse: (res: { data: Amenity }) => res.data,
      invalidatesTags: ["Amenities", "Audit"],
    }),
    updateAmenity: builder.mutation<Amenity, { id: string; body: Partial<Omit<Amenity, "_id">> }>({
      query: ({ id, body }) => ({ url: `/api/v1/admin/amenities/${id}`, method: "PATCH", body }),
      transformResponse: (res: { data: Amenity }) => res.data,
      invalidatesTags: ["Amenities", "Audit"],
    }),

    getLocations: builder.query<AdminLocation[], { type?: LocationType; activation?: LocationActivation; parentId?: string }>({
      query: (q) => ({ url: "/api/v1/admin/locations", params: params(q) }),
      transformResponse: (res: { data: { locations: AdminLocation[] } }) => res.data.locations,
      providesTags: ["Locations"],
    }),
    createLocation: builder.mutation<AdminLocation, { name: string; type: LocationType; parentId?: string; aliases?: string[] }>({
      query: (body) => ({ url: "/api/v1/admin/locations", method: "POST", body }),
      transformResponse: (res: { data: AdminLocation }) => res.data,
      invalidatesTags: ["Locations", "Audit"],
    }),
    updateLocation: builder.mutation<AdminLocation, { id: string; body: { name?: string; activation?: LocationActivation; aliases?: string[] } }>({
      query: ({ id, body }) => ({ url: `/api/v1/admin/locations/${id}`, method: "PATCH", body }),
      transformResponse: (res: { data: AdminLocation }) => res.data,
      invalidatesTags: ["Locations", "Audit"],
    }),

    // G7 templates — save is super_admin + ⚠ step-up; preview saves/sends nothing.
    getTemplates: builder.query<TemplateEvent[], void>({
      query: () => ({ url: "/api/v1/admin/templates" }),
      transformResponse: (res: { data: { events: TemplateEvent[] } }) => res.data.events,
      providesTags: ["Templates"],
    }),
    saveTemplate: builder.mutation<TemplateVersion, { eventKey: string; channel: string; subject?: string; body: string; whatsappTemplateName?: string }>({
      query: ({ eventKey, channel, ...body }) => ({
        url: `/api/v1/admin/templates/${encodeURIComponent(eventKey)}/${encodeURIComponent(channel)}`,
        method: "PUT",
        body,
      }),
      transformResponse: (res: { data: TemplateVersion }) => res.data,
      invalidatesTags: ["Templates", "Audit"],
    }),
    previewTemplate: builder.mutation<{ title?: string; body: string; whatsappTemplateName?: string | null; [k: string]: unknown }, { id: string; variables?: Record<string, string> }>({
      query: ({ id, variables }) => ({ url: `/api/v1/admin/templates/${id}/preview`, method: "POST", body: { variables } }),
      transformResponse: (res: { data: { title?: string; body: string; whatsappTemplateName?: string | null } }) => res.data,
    }),

    // Audit — super_admin only. filter[...] bracket syntax IS correct here.
    // Default page size 50, max 200. NOTE: bad from/to are silently ignored.
    getAuditLog: builder.query<{ entries: AuditEntry[] } & Paged, { adminUserId?: string; entityType?: string; action?: string; from?: string; to?: string; page?: number; limit?: number }>({
      query: ({ adminUserId, entityType, action, from, to, page, limit }) => ({
        url: "/api/v1/admin/audit-log",
        params: params({
          "filter[adminUserId]": adminUserId,
          "filter[entityType]": entityType,
          "filter[action]": action,
          from,
          to,
          page,
          limit,
        }),
      }),
      transformResponse: (res: { data: { entries: AuditEntry[] } & Paged }) => res.data,
      providesTags: ["Audit"],
    }),
  }),
})

export const {
  useGetDashboardQuery,
  useGetUsersQuery,
  useGetUserQuery,
  useSuspendUserMutation,
  useReinstateUserMutation,
  useResetAdmin2faMutation,
  useGetListingQueueQuery,
  useApproveListingMutation,
  useRejectListingMutation,
  useExtendListingMutation,
  useRemoveListingMutation,
  useGetAdQueueQuery,
  useApproveAdMutation,
  useRejectAdMutation,
  useGetAdPackagesQuery,
  useCreateAdPackageMutation,
  useUpdateAdPackageMutation,
  useDeactivateAdPackageMutation,
  useGetAbuseReportsQuery,
  useResolveAbuseReportMutation,
  useGetStuckOrdersQuery,
  useActivateStuckOrderMutation,
  useRejectStuckOrderMutation,
  useDeleteRejectedOrderMutation,
  useGetConfigQuery,
  usePutConfigMutation,
  useDeleteConfigMutation,
  useGetMembershipPlansQuery,
  useCreateMembershipPlanMutation,
  useUpdateMembershipPlanMutation,
  useDeactivateMembershipPlanMutation,
  useGetAmenitiesQuery,
  useCreateAmenityMutation,
  useUpdateAmenityMutation,
  useGetLocationsQuery,
  useCreateLocationMutation,
  useUpdateLocationMutation,
  useGetTemplatesQuery,
  useSaveTemplateMutation,
  usePreviewTemplateMutation,
  useGetAuditLogQuery,
} = adminApi
