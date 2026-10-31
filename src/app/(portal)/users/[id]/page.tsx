"use client"

import { use } from "react"
import { Mail, Phone, Building2, TrendingUp, Wallet, ShieldAlert, UserRound } from "lucide-react"
import { Button } from "@/components/ui/button"
import { StatusPill } from "@/components/admin/status-pill"
import { DetailBackLink, DetailCard } from "@/components/admin/detail-page-shell"
import { NotFoundCard } from "@/components/admin/not-found-card"
import { UserStatusAction } from "@/components/admin/users/user-status-action"
import { UserBadgeCard } from "@/components/admin/users/user-badge-card"
import { isObjectId, USER_STATUS_LABEL, userLabel, userStatusTone } from "@/components/admin/users/user-utils"
import { formatCount, formatDate, formatDateTime, formatPaise, LISTING_STATUS_LABEL, TIER_LABEL } from "@/components/admin/dashboard/dashboard-utils"
import { useGetUserQuery } from "@/store/api/adminApi"
import { getApiErrorCode, getApiErrorMessage } from "@/lib/api-error"
import { ROUTES } from "@/lib/routes"

/**
 * G2 — GET /admin/users/:id, the 360 view. Deliberately a summary: 10 most
 * recent memberships, 5 most recent listings, counts only for leads and
 * payments. A malformed id makes the backend 500, so it's rejected here
 * before any request.
 */
export default function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const validId = isObjectId(id)
  const { data, isLoading, isError, error, refetch, isFetching } = useGetUserQuery(id, { skip: !validId })

  if (!validId || getApiErrorCode(error) === "NOT_FOUND") {
    return (
      <div className="max-w-2xl space-y-6">
        <DetailBackLink href={ROUTES.users} label="All users" />
        <NotFoundCard label="User" id={id} />
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="max-w-2xl space-y-6" aria-busy="true" aria-label="Loading user">
        <DetailBackLink href={ROUTES.users} label="All users" />
        <div className="h-64 animate-pulse bg-brand-tertiary/60" />
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="max-w-2xl space-y-6">
        <DetailBackLink href={ROUTES.users} label="All users" />
        <div className="border border-red-200 bg-card p-6 text-center text-sm">
          <p className="font-semibold text-red-700">Couldn&apos;t load this user.</p>
          <p className="mt-1 text-brand-muted-foreground">{getApiErrorMessage(error) ?? "Please try again."}</p>
          <Button className="mt-3" size="sm" variant="outline" onClick={() => refetch()} disabled={isFetching}>
            Retry
          </Button>
        </div>
      </div>
    )
  }

  const { user, profile } = data
  // Summary blocks are read defensively — one missing nested object in the
  // 360 payload shouldn't blank the whole user page.
  const memberships = data.memberships ?? []
  const byStatus = data.listings?.byStatus ?? {}
  const recentListings = data.listings?.recent ?? []
  const displayName = profile?.fullName || userLabel(user)
  const initials =
    displayName
      .replace(/[^\p{L}\s]/gu, " ")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((n) => n.charAt(0).toUpperCase())
      .join("") || "U"
  const listingTotal = Object.values(byStatus).reduce((a, b) => a + (Number(b) || 0), 0)

  const stats = [
    { label: "Listings", value: listingTotal, icon: Building2 },
    { label: "Leads sent", value: data.leads?.asBuyer, icon: TrendingUp },
    { label: "Leads received", value: data.leads?.asSeller, icon: TrendingUp },
    { label: "Payments", value: data.payments?.count, icon: Wallet },
    { label: "Reports against", value: data.abuseReportsAgainst, icon: ShieldAlert },
  ]

  return (
    <div className="max-w-3xl space-y-6">
      <DetailBackLink href={ROUTES.users} label="All users" />

      <DetailCard>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <div
              className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-gradient-to-br from-ink-black to-brand-secondary text-sm font-bold text-brand-primary"
              aria-hidden
            >
              {profile?.fullName ? initials : <UserRound className="h-5 w-5" />}
            </div>
            <div className="min-w-0">
              <h2 className="truncate font-serif text-xl font-bold text-brand-secondary">{displayName}</h2>
              <div className="mt-0.5 space-y-0.5 text-xs text-brand-secondary/60">
                {user.email && (
                  <div className="flex items-center gap-1.5 break-all">
                    <Mail className="h-3 w-3 shrink-0" aria-hidden /> {user.email}
                  </div>
                )}
                {user.mobile && (
                  <div className="flex items-center gap-1.5">
                    <Phone className="h-3 w-3 shrink-0" aria-hidden /> {user.mobile}
                    {user.mobileVerifiedAt ? " · verified" : " · not verified"}
                  </div>
                )}
              </div>
              <div className="mt-1 font-mono text-[10px] text-brand-secondary/40">{user.id}</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <StatusPill tone={userStatusTone(user.status)}>{USER_STATUS_LABEL[user.status] ?? user.status}</StatusPill>
            <UserStatusAction userId={user.id} status={user.status} label={userLabel(user)} size="default" />
          </div>
        </div>

        <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {stats.map((s) => (
            // dt must precede dd; flex-col-reverse keeps the number visually on top.
            <div key={s.label} className="flex flex-col-reverse items-center bg-brand-tertiary/40 p-3 text-center">
              <dt className="text-[10px] uppercase tracking-wide text-brand-secondary/50">{s.label}</dt>
              <dd className="flex flex-col items-center gap-1 font-serif text-lg font-bold text-brand-secondary">
                <s.icon className="h-4 w-4 text-brand-primary-dark" aria-hidden />
                {formatCount(s.value)}
              </dd>
            </div>
          ))}
        </dl>

        <dl className="mt-5 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-brand-muted-foreground">Joined</dt>
            <dd className="text-brand-secondary">{formatDateTime(user.createdAt)}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-brand-muted-foreground">Last sign-in</dt>
            <dd className="text-brand-secondary">{formatDateTime(user.lastLoginAt)}</dd>
          </div>
        </dl>
      </DetailCard>

      <UserBadgeCard userId={user.id} label={userLabel(user)} />

      <DetailCard>
        <h3 className="font-serif text-base font-bold text-brand-secondary">Profile</h3>
        {profile ? (
          <dl className="mt-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            {(
              [
                // Names are shown exactly as the user typed them — CSS
                // `capitalize` would turn "van der Berg" into "Van Der Berg"
                // in an admin record. Only the intent enum is title-cased.
                ["Full name", profile.fullName, false],
                ["I am a", profile.intent, true],
                ["City", profile.city, false],
                ["State", profile.state, false],
                ["Profile completed", profile.completedAt ? formatDate(profile.completedAt) : "Not completed", false],
              ] as const
            ).map(([k, v, titleCase]) => (
              <div key={k}>
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-brand-muted-foreground">{k}</dt>
                <dd className={`break-words text-brand-secondary${titleCase ? " capitalize" : ""}`}>{v || "—"}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="mt-2 text-sm text-brand-muted-foreground">This user hasn&apos;t filled in a profile yet.</p>
        )}
      </DetailCard>

      <DetailCard>
        <h3 className="font-serif text-base font-bold text-brand-secondary">Memberships</h3>
        <p className="text-[11px] text-brand-muted-foreground">Up to the 10 most recent.</p>
        {memberships.length === 0 ? (
          <p className="mt-2 text-sm text-brand-muted-foreground">Free user — no memberships.</p>
        ) : (
          <ul className="mt-3 divide-y divide-brand-border/70 text-sm">
            {memberships.map((m, i) => (
              <li key={`${i}-${m.tier}-${m.startsAt ?? ""}`} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="font-semibold text-brand-secondary">{TIER_LABEL[m.tier] ?? m.tier}</span>
                <StatusPill tone={m.status === "active" ? "success" : m.status === "pending" ? "warning" : "neutral"}>
                  <span className="capitalize">{m.status || "unknown"}</span>
                </StatusPill>
                <span className="text-xs text-brand-secondary/55">
                  {formatDate(m.startsAt)} → {formatDate(m.expiresAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </DetailCard>

      <DetailCard>
        <h3 className="font-serif text-base font-bold text-brand-secondary">Listings</h3>
        {listingTotal === 0 ? (
          <p className="mt-2 text-sm text-brand-muted-foreground">No listings.</p>
        ) : (
          <>
            <div className="mt-2 flex flex-wrap gap-2">
              {Object.entries(byStatus).map(([status, count]) => (
                <span key={status} className="bg-brand-tertiary/60 px-2 py-1 text-[11px] font-semibold text-brand-secondary">
                  {LISTING_STATUS_LABEL[status] ?? status}: {count}
                </span>
              ))}
            </div>
            <p className="mt-3 text-[11px] text-brand-muted-foreground">5 most recent:</p>
            <ul className="mt-1 divide-y divide-brand-border/70 text-sm">
              {recentListings.map((l) => (
                <li key={l._id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span className="min-w-0 flex-1 truncate font-semibold text-brand-secondary" title={l.title || undefined}>
                    {l.title || "Untitled listing"}
                  </span>
                  <span className="text-xs text-brand-secondary/55">
                    {l.city || "—"} · {formatPaise(l.pricePaise)}
                  </span>
                  <StatusPill tone={l.status === "live" ? "success" : l.status === "pending_review" ? "warning" : "neutral"}>
                    {LISTING_STATUS_LABEL[l.status] ?? l.status}
                  </StatusPill>
                </li>
              ))}
            </ul>
          </>
        )}
      </DetailCard>
    </div>
  )
}
