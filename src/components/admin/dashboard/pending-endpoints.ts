import { baseApi } from "@/store/api/baseApi"

/**
 * G10 endpoint that still answers 501 NOT_IMPLEMENTED on the backend. The
 * page probes it so its "not available yet" state shows the backend's own
 * message — and flips to a real 200 the day the backend ships it, instead of
 * silently staying stubbed here. (G3 payment ops shipped 2026-10-27 and now
 * lives in adminApi.)
 */
const pendingEndpointsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    probePayments: builder.query<unknown, void>({
      query: () => ({ url: "/api/v1/admin/payments", params: { limit: 1 } }),
    }),
  }),
})

export const { useProbePaymentsQuery } = pendingEndpointsApi
