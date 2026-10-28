import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react"
import { rememberReturnTo } from "@/lib/return-to"
import type { BaseQueryFn, FetchArgs, FetchBaseQueryError } from "@reduxjs/toolkit/query/react"
import { clearAccessToken, getAccessToken } from "@/lib/admin-tokens"
import { getApiErrorCode } from "@/lib/api-error"
import { useAdminSession } from "@/lib/admin-session"
import { ROUTES } from "@/lib/routes"

const rawBaseQuery = fetchBaseQuery({
  baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL,
  prepareHeaders: (headers) => {
    const accessToken = getAccessToken()
    if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`)
    return headers
  },
})

// 401 codes that are a normal "try again" outcome of the login/enrollment
// *ceremony* itself — the calling form already surfaces these — not a dead
// session, so they must never trigger a hard clear+redirect:
//  - ADMIN_AUTH_FAILED / TOTP_INVALID / TEMP_TOKEN_INVALID: wrong password,
//    wrong code, or an expired 10-min tempToken, all pre-session.
//  - TOTP_STEPUP_REQUIRED: the live signal useStepUp() reacts to — the
//    session is fine, it just needs a fresh re-verify.
// Any *other* 401 (chiefly UNAUTHENTICATED) means the request actually had
// no valid session to work with — including from `totpVerify` itself when
// it's doing step-up (Bearer-token, not tempToken) and that Bearer token
// turns out to be dead. Routing on the error code rather than the endpoint
// name is what makes that last case work: `totpVerify` is reused for two
// very different auth states (pre-session tempToken vs. authenticated
// step-up), so only the code tells you which one actually failed.
const NON_SESSION_KILLING_401_CODES = new Set([
  "ADMIN_AUTH_FAILED",
  "TOTP_INVALID",
  "TEMP_TOKEN_INVALID",
  "TOTP_STEPUP_REQUIRED",
])

/**
 * admin_auth.json's admin session has no refresh token (8h accessToken,
 * that's it — see PARTNER-AUTH-INTEGRATION.md §4: "On 401 → send the user
 * back to login"), so unlike vexora-web's baseApi there is nothing to
 * transparently refresh here. This wrapper's only job is to clear the dead
 * session and hard-redirect to /login on a real 401 — see the code-set
 * comment above for which 401s that excludes.
 */
const baseQueryWithReauth: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (
  args,
  api,
  extraOptions,
) => {
  const result = await rawBaseQuery(args, api, extraOptions)

  if (result.error?.status === 401) {
    const code = getApiErrorCode(result.error)
    if (!code || !NON_SESSION_KILLING_401_CODES.has(code)) {
      clearAccessToken()
      useAdminSession.getState().logout()
      // Say why (the login page shows it), and never bounce someone who's
      // already on the sign-in screens — that would wipe a half-typed login.
      if (typeof window !== "undefined" && !/^\/(login|totp)/.test(window.location.pathname)) {
        rememberReturnTo()
        window.location.replace(`${ROUTES.login}?session=expired`)
      }
    }
  }

  return result
}

export const baseApi = createApi({
  reducerPath: "vexoraAdminApi",
  baseQuery: baseQueryWithReauth,
  tagTypes: [
    "Dashboard",
    "Users",
    "ListingQueue",
    "AdQueue",
    "AdPackages",
    "Abuse",
    "Config",
    "Plans",
    "Amenities",
    "Locations",
    "Templates",
    "Audit",
    "PaymentOps",
  ],
  endpoints: () => ({}),
})
