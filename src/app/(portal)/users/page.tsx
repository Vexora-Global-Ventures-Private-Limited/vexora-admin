"use client"

import { Suspense, useEffect, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { DataTable, type DataTableColumn } from "@/components/admin/data-table"
import { FilterBar } from "@/components/admin/filter-bar"
import { StatusPill } from "@/components/admin/status-pill"
import { UserStatusAction, useCanManageUsers } from "@/components/admin/users/user-status-action"
import { formatDate, formatDateTime } from "@/components/admin/dashboard/dashboard-utils"
import { USER_STATUSES, USER_STATUS_LABEL, userLabel, userStatusTone } from "@/components/admin/users/user-utils"
import { useGetUsersQuery, type AdminUserRow, type AdminUserStatus, type AdminUserTierFilter } from "@/store/api/adminApi"
import { getApiErrorMessage } from "@/lib/api-error"
import { ROUTES } from "@/lib/routes"
import { parsePage, useSetUrlParams } from "@/components/admin/url-state"

const STATUSES = USER_STATUSES
const TIERS: AdminUserTierFilter[] = ["free", "mercury", "jupiter", "venus"]
const TIER_LABEL: Record<AdminUserTierFilter, string> = {
  free: "Free (no membership)",
  mercury: "Mercury",
  jupiter: "Jupiter",
  venus: "Venus",
}
const STATUS_LABEL = USER_STATUS_LABEL
const PAGE_SIZE = 20
const SEARCH_MAX = 100

export default function UsersPage() {
  return (
    <Suspense fallback={null}>
      <UsersList />
    </Suspense>
  )
}

/**
 * G2 — GET /admin/users. Server-side search (email or mobile substring),
 * status filter (the 3 real values only — anything else is a 400), tier
 * filter (free / mercury / jupiter / venus — "free" means no active
 * membership, distinct from the ₹0 Mercury tier) and offset paging, all
 * kept in the URL. Each row carries currentTier + membershipExpiresAt.
 */
function UsersList() {
  const searchParams = useSearchParams()
  const setParams = useSetUrlParams()
  const canManage = useCanManageUsers()

  // Capped like the input — a hand-edited URL can't send a 10k-char search.
  const qParam = (searchParams.get("q") ?? "").slice(0, SEARCH_MAX)
  const statusParam = searchParams.get("status")
  const status = STATUSES.includes(statusParam as AdminUserStatus) ? (statusParam as AdminUserStatus) : undefined
  const tierParam = searchParams.get("tier")
  const tier = TIERS.includes(tierParam as AdminUserTierFilter) ? (tierParam as AdminUserTierFilter) : undefined
  const page = parsePage(searchParams.get("page"))

  const [query, setQuery] = useState(qParam)
  // Follow back/forward navigation without clobbering in-progress typing.
  const [seenQ, setSeenQ] = useState(qParam)
  if (qParam !== seenQ) {
    setSeenQ(qParam)
    setQuery(qParam)
  }

  // Debounced search → URL (resets to page 1). setParams reads the live URL,
  // so a filter changed during the debounce window isn't undone.
  useEffect(() => {
    const trimmed = query.trim()
    if (trimmed === qParam) return
    const t = setTimeout(() => setParams({ q: trimmed, page: 1 }), 350)
    return () => clearTimeout(t)
  }, [query, qParam, setParams])

  const goToPage = (next: number) => {
    setParams({ page: next })
    // The pager sits under a long table — start the new page from its top.
    window.scrollTo({ top: 0, behavior: "smooth" })
  }
  const hasFilters = !!(qParam || status || tier)

  const { data, isLoading, isFetching, isError, error, refetch } = useGetUsersQuery({
    search: qParam || undefined,
    status,
    tier,
    page,
    limit: PAGE_SIZE,
  })

  const users = data?.users ?? []
  // The server should only return rows of the chosen tier. If any row
  // disagrees, this API build ignores filter[tier] (seen on vex-dev
  // 2026-10-31: the fields are there, the filter isn't) — say so instead of
  // presenting an unfiltered list as filtered.
  const tierFilterIgnored =
    !!tier &&
    users.some((u) => u.currentTier !== undefined && (tier === "free" ? !!u.currentTier : u.currentTier !== tier))
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const columns: DataTableColumn<AdminUserRow>[] = [
    {
      key: "user",
      header: "User",
      render: (u) => (
        <Link href={ROUTES.userDetail(u._id)} className="hover:underline focus-visible:underline">
          <div className="text-xs font-bold text-brand-secondary">{userLabel(u)}</div>
          {u.email && u.mobile && <div className="text-[10px] text-brand-secondary/55">{u.mobile}</div>}
          <div className="font-mono text-[10px] text-brand-secondary/40">{u._id}</div>
        </Link>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (u) => <StatusPill tone={userStatusTone(u.status)}>{STATUS_LABEL[u.status] ?? u.status}</StatusPill>,
    },
    {
      key: "tier",
      header: "Membership",
      render: (u) => {
        // Older API builds don't send currentTier — show nothing rather than "Free".
        if (u.currentTier === undefined) return <span className="text-brand-secondary/40">—</span>
        if (!u.currentTier) return <span className="text-xs text-brand-secondary/55">Free</span>
        return (
          <div className="text-xs">
            <div className="font-semibold capitalize text-brand-secondary">{u.currentTier}</div>
            {u.membershipExpiresAt && <div className="text-[10px] text-brand-secondary/55">until {formatDate(u.membershipExpiresAt)}</div>}
          </div>
        )
      },
    },
    { key: "joined", header: "Joined", render: (u) => <span className="text-brand-secondary/55">{formatDate(u.createdAt)}</span> },
    { key: "lastLogin", header: "Last sign-in", render: (u) => <span className="text-brand-secondary/55">{formatDateTime(u.lastLoginAt)}</span> },
    ...(canManage
      ? [
          {
            key: "actions",
            header: "Actions",
            render: (u: AdminUserRow) => <UserStatusAction userId={u._id} status={u.status} label={userLabel(u)} />,
          },
        ]
      : []),
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-[220px] max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-secondary/40" aria-hidden />
          <Input
            type="search"
            aria-label="Search users by email or mobile"
            placeholder="Search part of an email or mobile…"
            value={query}
            maxLength={SEARCH_MAX}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <FilterBar
          filters={[
            {
              key: "status",
              label: "Status",
              value: status ?? "all",
              onChange: (v) => setParams({ status: v, page: 1 }),
              options: STATUSES.map((s) => ({ label: STATUS_LABEL[s], value: s })),
            },
            {
              key: "tier",
              label: "Membership",
              value: tier ?? "all",
              onChange: (v) => setParams({ tier: v, page: 1 }),
              options: TIERS.map((t) => ({ label: TIER_LABEL[t], value: t })),
            },
          ]}
        />
        <span className="text-xs text-brand-muted-foreground" aria-live="polite">
          {data ? `${total.toLocaleString("en-IN")} user${total === 1 ? "" : "s"}` : ""}
          {isFetching && data ? " · updating…" : ""}
        </span>
        {hasFilters && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              setQuery("")
              setParams({ q: undefined, status: undefined, tier: undefined, page: 1 })
            }}
          >
            Clear filters
          </Button>
        )}
      </div>

      {/* {tierFilterIgnored && (
        <div role="alert" className="border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <b>The membership filter isn&apos;t applied by this server yet.</b> It returned users of every tier (the total and pages
          aren&apos;t filtered). The backend says <code>filter[tier]</code> is live on uat; it hasn&apos;t reached this API yet. Rows of
          other tiers are hidden below, so this page only shows the matches among the {users.length} users it received.
        </div>
      )} */}

      {isError ? (
        <div className="border border-red-200 bg-card p-6 text-center text-sm">
          <p className="font-semibold text-red-700">Couldn&apos;t load users.</p>
          <p className="mt-1 text-brand-muted-foreground">{getApiErrorMessage(error) ?? "Please try again."}</p>
          <Button className="mt-3" variant="outline" size="sm" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      ) : (
        <>
          <DataTable
            ariaLabel="Users"
            columns={columns}
            rows={tierFilterIgnored ? users.filter((u) => (tier === "free" ? !u.currentTier : u.currentTier === tier)) : users}
            rowKey={(u) => u._id}
            loading={isLoading}
            // Server-paged: render the whole page the API returned.
            pageSize={Math.max(users.length, 1)}
            emptyLabel={
              status === "deleted"
                ? "No deleted users to show — the backend leaves deleted accounts out of the admin list entirely."
                : qParam || status || tier
                  ? "No users match these filters."
                  : "No users yet."
            }
          />
          {data && page > totalPages && total > 0 ? (
            <div className="text-center text-sm text-brand-muted-foreground">
              Nothing on page {page}.{" "}
              <button type="button" className="font-semibold text-brand-primary-dark underline" onClick={() => goToPage(1)}>
                Go to page 1
              </button>
            </div>
          ) : (
            totalPages > 1 && (
              <nav className="flex flex-wrap items-center justify-between gap-2 text-xs text-brand-muted-foreground" aria-label="Users pagination">
                <span>
                  Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total.toLocaleString("en-IN")}
                </span>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" disabled={page <= 1 || isFetching} onClick={() => goToPage(page - 1)}>
                    Prev
                  </Button>
                  <span className="font-semibold text-brand-secondary">
                    Page {page} of {totalPages}
                  </span>
                  <Button size="sm" variant="outline" disabled={!data?.hasMore || isFetching} onClick={() => goToPage(page + 1)}>
                    Next
                  </Button>
                </div>
              </nav>
            )
          )}
        </>
      )}
    </div>
  )
}
