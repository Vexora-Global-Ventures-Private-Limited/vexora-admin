import { baseApi } from "@/store/api/baseApi"

/**
 * G5 — KYC review and badges (Stage 13).
 *  - GET /admin/kyc/queue: pending submissions, oldest first. Reads and
 *    approve/reject are super_admin or moderator, no step-up.
 *  - POST /admin/kyc/{id}/approve: grants the badge the submission targeted
 *    (`verified` or `verified_developer`), re-indexes the member's listings.
 *  - POST /admin/kyc/{id}/reject { reason }: member can resubmit.
 *  - POST /admin/badges/{userId}/revoke: super_admin + ⚠ step-up.
 *  - GET /users/{id}/badges: public, current badge (at most one).
 * The queue's row shape isn't documented beyond "{ submissions }", so rows
 * are normalised defensively (user may be an id or a populated object).
 */

type RawRecord = Record<string, unknown>
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v : null)
const obj = (v: unknown) => (v && typeof v === "object" && !Array.isArray(v) ? (v as RawRecord) : null)

export type BadgeType = "verified" | "verified_developer"

export type KycDocument = { type: string; ref: string }

export type KycSubmission = {
  id: string
  userId: string | null
  userName: string | null
  userMobile: string | null
  userEmail: string | null
  tier: string | null
  targetBadge: string | null
  status: string
  documents: KycDocument[]
  submittedAt: string | null
  rejectionReason: string | null
}

function toSubmission(raw: RawRecord): KycSubmission {
  const user = obj(raw.user) ?? obj(raw.userId)
  const profile = obj(user?.profile)
  const docs = Array.isArray(raw.documents) ? raw.documents : []
  return {
    id: str(raw._id) ?? str(raw.id) ?? "",
    userId: str(raw.userId) ?? str(user?._id) ?? str(user?.id),
    userName: str(user?.fullName) ?? str(profile?.fullName) ?? str(raw.userName),
    userMobile: str(user?.mobile) ?? str(raw.userMobile),
    userEmail: str(user?.email) ?? str(raw.userEmail),
    tier: str(raw.tier) ?? str(user?.tier),
    targetBadge: str(raw.targetBadge),
    status: str(raw.status) ?? "submitted",
    documents: docs
      .map((d) => obj(d))
      .filter((d): d is RawRecord => !!d)
      .map((d) => ({ type: str(d.type) ?? "document", ref: str(d.cloudinaryPublicId) ?? str(d.cloudinaryId) ?? str(d.url) ?? "" })),
    submittedAt: str(raw.submittedAt) ?? str(raw.createdAt),
    rejectionReason: str(raw.rejectionReason),
  }
}

export const BADGE_LABEL: Record<string, string> = { verified: "Verified", verified_developer: "Verified Developer" }
export const DOCUMENT_LABEL: Record<string, string> = { pan: "PAN card", aadhaar: "Aadhaar", cin: "CIN (company)", gst: "GST certificate" }

export const kycApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getKycQueue: builder.query<KycSubmission[], void>({
      query: () => ({ url: "/api/v1/admin/kyc/queue" }),
      transformResponse: (res: { data: { submissions?: RawRecord[] } | RawRecord[] }) => {
        const rows = Array.isArray(res.data) ? res.data : (res.data?.submissions ?? [])
        return rows.map(toSubmission)
      },
      providesTags: ["Kyc"],
    }),
    approveKyc: builder.mutation<unknown, string>({
      query: (id) => ({ url: `/api/v1/admin/kyc/${id}/approve`, method: "POST" }),
      invalidatesTags: ["Kyc", "Badges", "Dashboard", "Users", "Audit"],
    }),
    rejectKyc: builder.mutation<unknown, { id: string; reason: string }>({
      query: ({ id, reason }) => ({ url: `/api/v1/admin/kyc/${id}/reject`, method: "POST", body: { reason } }),
      invalidatesTags: ["Kyc", "Dashboard", "Audit"],
    }),
    // Public endpoint — no admin role needed.
    getUserBadges: builder.query<{ type: string; grantedAt: string | null }[], string>({
      query: (userId) => ({ url: `/api/v1/users/${userId}/badges` }),
      transformResponse: (res: { data: { badges?: RawRecord[] } }) =>
        (res.data?.badges ?? []).map((b) => ({ type: str(b.type) ?? "", grantedAt: str(b.grantedAt) })).filter((b) => b.type),
      providesTags: (_r, _e, userId) => [{ type: "Badges", id: userId }],
    }),
    // ⚠ super_admin + step-up.
    revokeBadge: builder.mutation<unknown, string>({
      query: (userId) => ({ url: `/api/v1/admin/badges/${userId}/revoke`, method: "POST" }),
      invalidatesTags: (_r, _e, userId) => [{ type: "Badges", id: userId }, "Users", "Audit"],
    }),
  }),
})

export const { useGetKycQueueQuery, useApproveKycMutation, useRejectKycMutation, useGetUserBadgesQuery, useRevokeBadgeMutation } = kycApi
