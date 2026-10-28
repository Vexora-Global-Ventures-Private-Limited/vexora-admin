export const ROUTES = {
  login: "/login",
  totpVerify: "/totp/verify",
  totpEnroll: "/totp/enroll",

  dashboard: "/dashboard",

  users: "/users",
  userDetail: (id: string) => `/users/${id}`,

  paymentOps: "/payment-ops",

  listings: "/listings",
  listingDetail: (id: string) => `/listings/${id}`,

  kyc: "/kyc",
  kycDetail: (id: string) => `/kyc/${id}`,

  ads: "/ads",
  adDetail: (id: string) => `/ads/${id}`,

  templates: "/templates",
  templateDetail: (eventKey: string, channel: string) => `/templates/${eventKey}/${channel}`,

  reports: "/reports",

  config: "/config",

  abuse: "/abuse",

  payments: "/payments",
  admins: "/admins",
  audit: "/audit",
} as const
