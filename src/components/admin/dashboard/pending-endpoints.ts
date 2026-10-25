import { baseApi } from "@/store/api/baseApi"

/**
 * G3 / G10 endpoints that still answer 501 NOT_IMPLEMENTED on the backend
 * (Stage 9 work never finished — KNOWN-ISSUES.md #25: there's no manual
 * activation route at all). The pages probe them so their "not available
 * yet" state shows the backend's own message — and flips to a real 200 the
 * day the backend ships them, instead of silently staying stubbed here.
 */
const pendingEndpointsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    probeStuckOrders: builder.query<unknown, void>({
      query: () => ({ url: "/api/v1/admin/payment-ops/stuck" }),
    }),
    probePayments: builder.query<unknown, void>({
      query: () => ({ url: "/api/v1/admin/payments", params: { limit: 1 } }),
    }),
  }),
})

export const { useProbeStuckOrdersQuery, useProbePaymentsQuery } = pendingEndpointsApi
