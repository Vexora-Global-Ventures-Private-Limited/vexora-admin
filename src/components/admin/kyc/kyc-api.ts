import { baseApi } from "@/store/api/baseApi"

/**
 * G5 read endpoints. Both return 501 NOT_IMPLEMENTED on the deployed API
 * today ("G5 KYC review is built in Stage 13"), so no response shape has
 * ever been observed — the types are deliberately loose and the screens
 * only render a not-available state for now. Kept here (not in adminApi.ts)
 * because nothing else uses them yet.
 */
export const kycApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getKycQueue: builder.query<unknown, void>({
      query: () => ({ url: "/api/v1/admin/kyc/queue" }),
    }),
    getBadgeQueues: builder.query<unknown, void>({
      query: () => ({ url: "/api/v1/admin/badges/queues" }),
    }),
  }),
})

export const { useGetKycQueueQuery, useGetBadgeQueuesQuery } = kycApi
