import { baseApi } from "./baseApi"

export type AdminRole = "super_admin" | "ops" | "finance" | "moderator"

export type ApiAdmin = {
  id: string
  email: string
  role: AdminRole
}

export type AdminLoginRequest = {
  email: string
  password: string
}

export type AdminLoginResponse = {
  data: {
    /** true only on this admin's very first-ever login — no TOTP secret enrolled yet. */
    needsEnrollment?: boolean
    /** true on every login after enrollment. */
    needsTotp?: boolean
    /** otpauth:// URI for the enrollment QR — only present when needsEnrollment is true. */
    otpauthUrl?: string | null
    /** 10-minute throwaway — carries the flow to /totp/enroll or /totp/verify, not a session. */
    tempToken: string
  }
}

export type AdminTotpEnrollRequest = {
  tempToken: string
  code: string
}

export type AdminTotpEnrollResponse = {
  data: {
    accessToken: string
    admin: ApiAdmin
    /** Shown once, ever — the only way back in if the authenticator device is lost. */
    recoveryCodes: string[]
  }
}

export type AdminTotpVerifyRequest = {
  /** Present for the login path (after /login returned needsTotp). Omitted for the
   *  step-up path, which instead relies on the Authorization: Bearer header of the
   *  already-authenticated session being re-verified. */
  tempToken?: string
  /** A 6-digit TOTP code, or one of the one-time recovery codes (consumed on use). */
  code: string
}

export type AdminTotpVerifyResponse = {
  data: {
    accessToken: string
    admin: ApiAdmin
  }
}

export const adminAuthApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    login: builder.mutation<AdminLoginResponse, AdminLoginRequest>({
      query: (body) => ({ url: "/api/v1/admin/auth/login", method: "POST", body }),
    }),
    totpEnroll: builder.mutation<AdminTotpEnrollResponse, AdminTotpEnrollRequest>({
      query: (body) => ({ url: "/api/v1/admin/auth/totp/enroll", method: "POST", body }),
    }),
    totpVerify: builder.mutation<AdminTotpVerifyResponse, AdminTotpVerifyRequest>({
      query: (body) => ({ url: "/api/v1/admin/auth/totp/verify", method: "POST", body }),
    }),
  }),
})

export const { useLoginMutation, useTotpEnrollMutation, useTotpVerifyMutation } = adminAuthApi
