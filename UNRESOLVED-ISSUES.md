# Unresolved Issues — vexora-admin

Issues found while integrating `vexora-admin` with the live dev API (`https://vex-dev.up.railway.app`, October 2026) that **cannot be fixed in the admin frontend**. Everything here was verified live with a real `super_admin` session unless marked otherwise.

**Owners at a glance**

| Section | Owner |
|---|---|
| A. Endpoints not built yet (501) | Backend |
| B. Backend bugs & validation gaps | Backend |
| C. Missing APIs | Backend |
| D. Config, data & test access | Backend / Admin |

---

## A. Endpoints not built yet — return `501 NOT_IMPLEMENTED`

| # | Endpoint | Screen affected | Note |
|---|---|---|---|
| 1 | `GET /admin/kyc/queue` | KYC & badges | "G5 KYC review is built in Stage 13" — not deployed on dev (the consumer KYC endpoints are missing too) |
| 2 | `GET /admin/badges/queues` | KYC & badges | Same — Stage 13 |
| 3 | `GET /admin/payment-ops/stuck` | Payment ops | "G3 payment ops is built in Stage 9" — still the Stage 8 stub |
| 4 | `POST /admin/payment-ops/orders/{id}/activate` | Payment ops | **Never built** (`KNOWN-ISSUES.md` #25). The activation service supports `admin_manual`, but no route calls it — so on dev no purchase can ever complete (orders stay `processing`), which blocks testing every paid-tier flow on vexora-web |
| 5 | `GET /admin/payments`, `POST /admin/payments/{id}/refund-note` | Payments | "G10 payment log is built in Stage 9" |

## B. Backend bugs & validation gaps

| # | Problem (verified live) | Needed |
|---|---|---|
| 6 | **CORS:** `/api/v1/admin/**` on vex-dev only allows `http://localhost:3000`, `https://vxa.vercel.app`, `https://vxp.vercel.app`. The docs say `ADMIN_CORS_ORIGINS` defaults to `http://localhost:3001` in dev, but 3001 is rejected — so the admin portal and vexora-web can't run locally at the same time (both need port 3000) | Add `http://localhost:3001` to `ADMIN_CORS_ORIGINS` on vex-dev |
| 7 | **Ad packages:** `PATCH /admin/ad-packages/{id}` creates a new version with a new `_id` but leaves the old version `isActive: true` — sellers see both the old and new price | Deactivate the previous version on PATCH (the admin UI works around it by deactivating the old id itself) |
| 8 | `GET /admin/users/abc` (malformed id) → **500** `INTERNAL` "Failed to load user" | Validate ObjectId → 400 / 404 |
| 9 | `GET /admin/users?page=0` and `?limit=500` accepted (docs: max 100) | Validate `page` ≥ 1, cap `limit` |
| 10 | `GET /admin/abuse-reports?filter[status]=bogus` → `200` with `[]` instead of `400 VALIDATION_ERROR` | Validate the enum (users list already does) |
| 11 | `GET /admin/audit-log?from=garbage` silently ignored; `limit=500` accepted (docs: max 200) | Validate dates, cap `limit` |
| 12 | `POST /admin/listings/{id}/reject` with a whitespace reason on an unknown id returns `NOT_FOUND` before validating the body (minor — order of checks) | Validate the body first |
| 13 | `/admin/dashboard` `pending` lists `leads.last30d` and `memberships.byTier` as stubs, although `FRONTEND-ADMIN-INTEGRATION-ROADMAP.md` says `KNOWN-ISSUES.md` #36 fixed them — and `memberships.byTier` only contains `mercury` | Confirm whether #36 regressed on dev |

| 21 | `GET /admin/users?filter[status]=deleted` always returns 0 — soft-deleted users are excluded from both the list and the detail view, so the "Deleted" filter can never show anything | Include soft-deleted users when that filter is requested, or drop the value |
| 22 | Unfiltered `GET /admin/abuse-reports` returns only `open` + `in_review` — undocumented | Document it, or add an explicit "all" option |
| 23 | Ad creatives and click-through URLs accept `javascript:` / `http:` — the admin UI renders them as inert text and warns, but the backend stores and serves them (security; same as vexora-web #4) | https-only validation on save and in click serving |
| 24 | Validation order is inconsistent: listing reject validates `reason` before checking the listing exists; ad reject checks existence first | Consistent order (validate body first) |
| 25 | `POST /admin/membership-plans {}` reports only the first missing field (`tier`) instead of all of them | Validate all fields together |
| 26 | Location `type` / `parentId` can't be changed after creation (`PATCH` only accepts `name`, `activation`, `aliases`) | Allow it, or document that it's fixed at creation |

## C. Missing APIs

| # | Needed | Why |
|---|---|---|
| 14 | `GET /admin/admins` (list admin accounts) | `POST /admin/users/{id}/reset-2fa` needs an **admin** id, but there's no way to list admins — a "Manage admins" screen can't be built |
| 15 | `GET /admin/listings/{id}` (any status) | The moderation detail page can only show listings still in the queue; approved / rejected / removed listings can't be opened |
| 16 | `GET /admin/ads/{id}` (any status) | Same for ads |
| 17 | User list rows have no name / tier | `GET /admin/users` returns only `_id, email, mobile, status, createdAt, lastLoginAt`; `filter[tier]` returns `NOT_IMPLEMENTED` |
| 18 | Analytics / time-series endpoints | The Reports screen can only show today's dashboard counts — no trends |
| 27 | List live listings for moderation (e.g. `GET /admin/listings?status=live`) | Extend / remove only work on a pasted listing id — there's no way to browse live listings in the admin |
| 28 | Creatives in the ad queue payload | `GET /admin/ads/queue` rows carry no `creatives`, so a banner can't be reviewed visually before approving |
| 29 | Draft preview for templates (`POST /admin/templates/{id}/preview` with `{ body, subject }`) | The server only renders the saved version; the editor previews drafts client-side with sample values |
| 30 | Admin name / email on audit-log and config `updatedBy` | Only admin ids are returned, so other admins show as ids (and seeded config shows "seed") |

## D. Config, data & test access

| # | Needed | Owner |
|---|---|---|
| 19 | Admin TOTP is real (no demo code): live testing of ⚠ step-up actions needs a fresh code from the admin's authenticator every 15 minutes | Admin — consider a second dev admin account for testing |
| 20 | Dev credentials for the seeded admin are committed in `vexora-docs/PARTNER-AUTH-INTEGRATION.md` ("rotate before production") | Rotate before production |
| 31 | All 7 seeded WhatsApp templates have `whatsappTemplateName: null`, so WhatsApp notifications can't be sent; every template body is a seed placeholder ("Default template for … on email") | Ops / Product — real BSP-approved template names + real copy |
| 32 | Documented step-up rules, verified live 2026-10-25: suspend, config writes, membership-plan writes, ad-package writes, listing extend/remove, abuse resolve **require** a fresh code; reinstate, listing/ad approve-reject, amenity and location writes **don't** | Backend docs — add to `06-API.md` so it's not guesswork |

---

## Data touched on dev during integration (all cleaned up)

| What | State now |
|---|---|
| Test user `6adda1b8a02c88f2dc70c479` (+91 93929 09750) — suspended / reinstated several times to test the flow | `active` |
| Ad packages "ZZ integration test" (v1 + v2) and "x" (₹1) — created while testing the package flow | All deactivated (`isActive: false`) |
| Config keys `zz_integration_test`, `zz_x` — created while testing config writes | Deleted |
| 3 junk abuse reports filed during the vexora-web review | Resolved with action `none` |

Every one of these actions is in the admin audit log.
