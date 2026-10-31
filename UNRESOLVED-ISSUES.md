# Unresolved Issues — vexora-admin

Issues found while integrating `vexora-admin` with the live dev API (`https://vex-dev.up.railway.app`, October 2026) that **cannot be fixed in the admin frontend**. Everything here was verified live with a real `super_admin` session unless marked otherwise.

Every frontend-fixable bug found in the same review (about 180 across two review passes — auth, dashboard, users, audit, moderation, ads, abuse, config and templates) has already been fixed on `ganesh-oct-dev`. Where the admin UI could guard against a backend gap it does (client validation, double-submit locks, unsafe-URL rendering, the package-version workaround) — but those guards can be bypassed by calling the API directly.

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
| 1 | ~~`GET /admin/kyc/queue`~~ | KYC & badges | **Solved 2026-10-31:** live; KYC page lists the queue, review page shows documents with Approve / Reject (super_admin or moderator). Row shape undocumented — normalised defensively, untested with a real submission. Was: | "G5 KYC review is built in Stage 13" — not deployed on dev (the consumer KYC endpoints are missing too) |
| 2 | ~~`GET /admin/badges/queues`~~ | KYC & badges | **Solved 2026-10-31:** removed from the API by design (badges are only granted through KYC approval). Badge revoke (`POST /admin/badges/{userId}/revoke`, super_admin + step-up) is on the user page. Was: | Same — Stage 13 |
| 3 | ~~`GET /admin/payment-ops/stuck`~~ | Payment ops | **Solved 2026-10-27:** live on vex-dev; wired into the Payment ops page |
| 4 | ~~`POST /admin/payment-ops/orders/{id}/activate`~~ | Payment ops | **Solved 2026-10-27:** live on vex-dev (step-up, audited, idempotent); Activate dialog on the Payment ops page |
| 5 | `GET /admin/payments`, `POST /admin/payments/{id}/refund-note` | Payments | **2026-10-31:** `GET /admin/payments` dropped from the API spec — the Payments page no longer calls it and says the log isn't available. Payment ops now also has **Reject** (`POST …/orders/{id}/reject`); **Delete** wired too (rejected orders are kept in the admin's browser, since no API lists them). Was: | "G10 payment log is built in Stage 9" |

## B. Backend bugs & validation gaps

| # | Problem (verified live) | Needed |
|---|---|---|
| 6 | **CORS:** as of 2026-10-26 vex-dev's admin routes (`/api/v1/admin/**`) allow **only `https://vxa.vercel.app`** — `localhost:3000` (allowed on 2026-10-25) and `localhost:3001` (the documented dev default for `ADMIN_CORS_ORIGINS`) are both rejected, so a browser on localhost can't call the admin API at all. **Worked around for local dev:** the admin app now proxies `/api/v1/*` through its own Next.js server when `API_PROXY_TARGET` is set (see `.env.example`), so it runs on `localhost:3001` next to vexora-web on 3000 | Add `http://localhost:3001` to `ADMIN_CORS_ORIGINS` on vex-dev (removes the need for the proxy) |
| 7 | **Ad packages:** `PATCH /admin/ad-packages/{id}` creates a new version with a new `_id` but leaves the old version `isActive: true` — sellers see both the old and new price | Deactivate the previous version on PATCH (worked around on both sides: the admin deactivates the old id itself, and since 2026-10-26 vexora-web's ad-purchase screen shows only the newest active version of each package, so sellers never see two prices) |
| 8 | `GET /admin/users/abc` (malformed id) → **500** `INTERNAL` "Failed to load user" | Validate ObjectId → 400 / 404 |
| 9 | `GET /admin/users?page=0` and `?limit=500` accepted (docs: max 100) | Validate `page` ≥ 1, cap `limit` |
| 10 | `GET /admin/abuse-reports?filter[status]=bogus` → `200` with `[]` instead of `400 VALIDATION_ERROR` | Validate the enum (users list already does) |
| 11 | `GET /admin/audit-log?from=garbage` silently ignored; `limit=500` accepted (docs: max 200) | Validate dates, cap `limit` |
| 12 | `POST /admin/listings/{id}/reject` with a whitespace reason on an unknown id returns `NOT_FOUND` before validating the body (minor — order of checks) | Validate the body first |
| 13 | `/admin/dashboard` `pending` lists `leads.last30d` and `memberships.byTier` as stubs, although `FRONTEND-ADMIN-INTEGRATION-ROADMAP.md` says `KNOWN-ISSUES.md` #36 fixed them — and `memberships.byTier` only contains `mercury` | Confirm whether #36 regressed on dev |
| 14 | `GET /admin/users?filter[status]=deleted` always returns 0 — soft-deleted users are excluded from both the list and the detail view, so the "Deleted" filter can never show anything | Include soft-deleted users when that filter is requested, or drop the value |
| 15 | Unfiltered `GET /admin/abuse-reports` returns only `open` + `in_review` — undocumented | Document it, or add an explicit "all" option |
| 16 | Ad creatives and click-through URLs accept `javascript:` / `http:` — the admin UI renders them as inert text and warns, but the backend stores and serves them (security; same as vexora-web #4) | https-only validation on save and in click serving |
| 17 | Validation order is inconsistent: listing reject validates `reason` before checking the listing exists; ad reject checks existence first | Consistent order (validate body first) |
| 18 | `POST /admin/membership-plans {}` reports only the first missing field (`tier`) instead of all of them | Validate all fields together |
| 19 | Location `type` / `parentId` can't be changed after creation (`PATCH` only accepts `name`, `activation`, `aliases`) | Allow it, or document that it's fixed at creation |
| 20 | A suspended user's open session keeps working until its access token expires (up to 15 min) — the auth guard never checks the database | Revoke tokens on suspend, or check user status in the guard |
| 21 | `GET /admin/users` and `GET /admin/audit-log` return `200` with an empty list for a page past the end | Validate `page` against `total` |
| 22 | Pending ads keep the run window chosen at purchase — all 3 pending ads on dev (paid in September) have windows that already ended; approving one makes an already-expired ad "active" | Recompute `startsAt`/`endsAt` on approval, or auto-expire stale pending ads |
| 23 | Listing reject / remove and ad reject accept reasons of any length (6,000 chars passed validation) | Server-side length limit |
| 24 | `listing_hidden` and `listing_removed` abuse actions do exactly the same thing | A distinct "hidden" state, or drop one action |
| 25 | No optimistic concurrency on config, membership plans or templates — `PUT /admin/config/{key}` is an upsert and every save is last-write-wins (the UI re-reads right before saving, but a race in that gap remains) | `If-Match` / `updatedAt` precondition on writes |
| 26 | Membership-plan versioning doesn't match the docs: they say price/duration/quota edits create a new version, but on dev a past price edit stayed on the same id at `version: 1` | Confirm the intended behaviour; if a new version is created, deactivate the old one |
| 27 | `POST /admin/locations` takes no `activation`, and the default for a new location is undocumented | Accept `activation` on create, or document the default |
| 28 | Amenity `category` can't be cleared once set | Accept `category: null` on `PATCH` |
| 29 | ~~Payment ops can't show the Razorpay **payment id or live payment status**~~ — **solved 2026-10-31:** `vex-latest.json` adds `razorpayLiveStatus` to each stuck order; the page shows a Paid / Not paid / Failed / Authorized / Refunded tag, the captured payment id (pre-filled in Activate), method + bank/UPI, and every attempt (error, fee, refund). Shape only described in prose — normalised defensively, unverified against a real response. Was:29 | Payment ops can't show the Razorpay **payment id or live payment status**: `GET /admin/payment-ops/stuck` rows have no `razorpayPaymentId` (even after verify), and reading status from Razorpay needs the key secret (backend only). The page links each real order to its Razorpay dashboard page meanwhile (2026-10-31) | Return `razorpayPaymentId` + `razorpayStatus` (captured / failed / authorized, via `razorpay.orders.fetchPayments`) on each stuck row |
| 29 | **No admin logout endpoint** (`POST /admin/auth/logout` → 404) — "Sign out" only clears the browser; the 8-hour token stays valid server-side until it expires | A logout / token-revocation endpoint |
| 30 | **Admin token is stored in `localStorage`** (readable by any script that runs on the page) because the backend only returns it in the JSON body | An httpOnly, Secure, SameSite cookie session for the admin API |
| 31 | No rate limiting observed on `POST /admin/auth/login` or `/admin/auth/totp/verify` — repeated wrong passwords / codes never returned `429` | Confirm or enable the limiter on vex-dev (brute-force protection) |
| 32 | Config values have no per-key schema — any JSON is stored for any key (e.g. `allowed_bhk_values: ["3"]` would break vexora-web's wizard) | Server-side schema per config key — and store JSON exactly (no silent loss of duplicate keys or integers beyond 2^53) (the admin UI validates the 6 keys vexora-web reads) |
| 33 | Whether a **name-only** `PATCH /admin/ad-packages/{id}` creates a new version (price/duration changes do) is undocumented — couldn't be verified without editing a real package | Document the versioning rule per field |

## C. Missing APIs

| # | Needed | Why |
|---|---|---|
| 34 | `GET /admin/admins` (list admin accounts) | `POST /admin/users/{id}/reset-2fa` needs an **admin** id, but there's no way to list admins. The **Admins** screen (super_admin only) works around it: it resets 2FA for a *pasted* admin id (found on that admin's audit-log entries), behind a typed `RESET` confirmation + step-up, and refuses your own id. A real list would remove the copy-paste step |
| 35 | `GET /admin/listings/{id}` (any status) | The moderation detail page can only show listings still in the queue; approved / rejected / removed listings can't be opened |
| 36 | `GET /admin/ads/{id}` (any status) | Same for ads |
| 37 | User list rows have no name / ~~tier~~ — **tier part solved 2026-10-31:** rows carry `currentTier` + `membershipExpiresAt`, shown in a Membership column, plus a `filter[tier]` (free / mercury / jupiter / venus) filter. Names are still missing. Was: | `GET /admin/users` returns only `_id, email, mobile, status, createdAt, lastLoginAt`; `filter[tier]` returns `NOT_IMPLEMENTED` |
| 38 | Analytics / time-series endpoints | The Reports screen can only show today's dashboard counts — no trends |
| 39 | List live listings for moderation (e.g. `GET /admin/listings?status=live`) | Extend / remove only work on a pasted listing id — there's no way to browse live listings in the admin |
| 40 | Creatives in the ad queue payload | `GET /admin/ads/queue` rows carry no `creatives`, so a banner can't be reviewed visually before approving |
| 41 | Draft preview for templates (`POST /admin/templates/{id}/preview` with `{ body, subject }`) | The server only renders the saved version; the editor previews drafts client-side with sample values |
| 42 | Admin name / email on audit-log and config `updatedBy` | Only admin ids are returned, so other admins show as ids (and seeded config shows "seed") |
| 43 | Recovery codes: the format is undocumented and there's no way to see how many unused codes remain | Document the format; add a remaining-codes count |
| 44 | Role guards (`requireRole`) for the users list, KYC, payments, templates and reports are undocumented — those nav items stay visible to every role | Document the allowed roles per admin route |
| 45 | A list of possible audit `filter[action]` / `filter[entityType]` values (both are exact-match) | The admin UI builds the action dropdown from the entries it has loaded; partial text finds nothing |
| 46 | Documentation of template variable syntax (whitespace inside `{{ }}`, dotted names) and a validate-only mode for template / config / plan saves | Validation errors are unreachable without a fresh code, because step-up runs before validation |
| 47 | Allowed hosts for ad creative images | Undefined — the admin auto-previews only Cloudinary / Unsplash images (any other host could log the reviewing admin's IP) and asks before loading others. A server-side allow-list of creative hosts would make this a hard rule |

## D. Config, data & test access

| # | Needed | Owner |
|---|---|---|
| 48 | Admin TOTP is real (no demo code): live testing of ⚠ step-up actions needs a fresh code from the admin's authenticator every 15 minutes | Admin — consider a second dev admin account for testing |
| 49 | Dev credentials for the seeded admin are committed in `vexora-docs/PARTNER-AUTH-INTEGRATION.md` ("rotate before production") | Rotate before production |
| 50 | All 7 seeded WhatsApp templates have `whatsappTemplateName: null`, so WhatsApp notifications can't be sent; every template body is a seed placeholder ("Default template for … on email") — and users see them: since 2026-10-27 every new account gets an `auth.welcome` in-app notification reading "Auth Welcome — Default template for auth.welcome on in_app". vexora-web now swaps placeholder text for readable copy, but the real fix is writing the templates in the admin **Templates** screen (needs a fresh authenticator code) | Ops / Product — real BSP-approved template names + real copy |
| 51 | Documented step-up rules, verified live 2026-10-25: suspend, config writes, membership-plan writes, ad-package writes, listing extend/remove, abuse resolve **require** a fresh code; reinstate, listing/ad approve-reject, amenity and location writes **don't** | Backend docs — add to `06-API.md` so it's not guesswork |
| 52 | Dev has 4 duplicate active "Test Package" pairs (left by the package-versioning bug, #7) | Admin — one click on "Deactivate older versions" in Ad approval → Packages |
| 53 | Only one admin account exists (`super_admin`), so role-based screens (ops / finance / moderator) and multi-admin flows can't be tested | Admin — create one test account per role on dev |
| 54 | Login silently normalises email case and surrounding spaces — fine, but undocumented | Backend docs |
| 55 | Unit of the dashboard `mrr` field (rupees or paise) is undocumented | Backend docs |
| 56 | ~~After a session expires the admin lands on `/login` and loses the page they were on. A "return to" link back is possible, but needs an allow-list of internal paths so it can't become an open redirect~~ — **solved 2026-10-26:** after an expired session the admin returns to the page they were on. The page is kept in this tab's `sessionStorage` (never in the URL, so no open redirect), checked to be an internal portal path, used once, and cleared on a deliberate sign-out | — |
| 57 | The 2nd review pass ran without a live admin session (the 8-hour token had expired), so its fixes were verified by code, unit tests and page loads only — not re-run against the API | Admin — one fresh authenticator code to re-run the error-path checks |

---

## Data touched on dev during integration (all cleaned up)

| What | State now |
|---|---|
| Test user `6adda1b8a02c88f2dc70c479` (+91 93929 09750) — suspended / reinstated several times to test the flow | `active` |
| Ad packages "ZZ integration test" (v1 + v2) and "x" (₹1) — created while testing the package flow | All deactivated (`isActive: false`) |
| Config keys `zz_integration_test`, `zz_x` — created while testing config writes | Deleted |
| 3 junk abuse reports filed during the vexora-web review | Resolved with action `none` |

Every one of these actions is in the admin audit log.
