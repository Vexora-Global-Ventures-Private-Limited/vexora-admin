"use client"

import Link from "next/link"
import { ExternalLink, Mail, Phone, UserRound } from "lucide-react"
import { StatusPill } from "@/components/admin/status-pill"
import { ShortId, isObjectId } from "@/components/admin/moderation/shared"
import { TIER_LABEL, formatDate } from "@/components/admin/dashboard/dashboard-utils"
import { useGetUserQuery, type AdminUserDetail } from "@/store/api/adminApi"
import { ROUTES } from "@/lib/routes"
import { cn } from "@/lib/utils"

/** The user's current active membership tier, or null (Free). */
function activeTier(detail: AdminUserDetail | undefined): string | null {
  const m = detail?.memberships?.find((x) => x.status === "active")
  return m ? (TIER_LABEL[m.tier] ?? m.tier) : null
}

/**
 * A user reference that shows WHO it is — name + mobile — and links to the
 * user page. One GET /admin/users/{id} per user (cached and shared across
 * the page), falling back to the short id while loading or if it fails.
 */
export function UserChip({ id, className }: { id: string | null | undefined; className?: string }) {
  const valid = !!id && isObjectId(id)
  const { data } = useGetUserQuery(id ?? "", { skip: !valid })
  if (!valid) return <ShortId id={id} className={className} />
  const name = data?.profile?.fullName?.trim()
  const contact = data?.user.mobile ?? data?.user.email
  return (
    <Link href={ROUTES.userDetail(id)} className={cn("group block min-w-0 text-xs", className)} title={`Open user ${id}`}>
      <span className={cn("block truncate font-semibold group-hover:underline", name ? "text-brand-secondary" : "italic text-brand-secondary/55")}>
        {name ?? (data ? "No name" : <ShortId id={id} />)}
      </span>
      {contact && <span className="block truncate text-[10px] text-brand-secondary/55">{contact}</span>}
    </Link>
  )
}

/** Full contact card for detail pages: name, mobile, email, tier, status, joined. */
export function UserCard({ id, role }: { id: string | null | undefined; role: string }) {
  const valid = !!id && isObjectId(id)
  const { data, isLoading, isError } = useGetUserQuery(id ?? "", { skip: !valid })
  const tier = activeTier(data)

  return (
    <div className="bg-brand-tertiary/40 p-4">
      <div className="text-[10px] uppercase tracking-wide text-brand-secondary/50">{role}</div>
      {!valid ? (
        <p className="mt-1 text-sm text-brand-secondary/60">Unknown user</p>
      ) : isLoading ? (
        <p className="mt-1 text-sm text-brand-secondary/60">Loading…</p>
      ) : isError || !data ? (
        <p className="mt-1 text-sm text-brand-secondary/60">
          Couldn&apos;t load this user. <ShortId id={id} />
        </p>
      ) : (
        <div className="mt-1.5 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1 text-sm">
            <div className="flex items-center gap-2 font-bold text-brand-secondary">
              <UserRound className="h-4 w-4 text-brand-primary-dark" />
              {data.profile?.fullName?.trim() || <span className="font-normal italic text-brand-secondary/55">No name</span>}
            </div>
            {data.user.mobile && (
              <a href={`tel:${data.user.mobile}`} className="flex items-center gap-2 text-brand-secondary/75 hover:underline">
                <Phone className="h-3.5 w-3.5" /> {data.user.mobile}
              </a>
            )}
            {data.user.email && (
              <a href={`mailto:${data.user.email}`} className="flex items-center gap-2 break-all text-brand-secondary/75 hover:underline">
                <Mail className="h-3.5 w-3.5" /> {data.user.email}
              </a>
            )}
            <div className="text-xs text-brand-secondary/55">
              {[data.profile?.city, tier ? `${tier} member` : "Free (no membership)", `joined ${formatDate(data.user.createdAt)}`].filter(Boolean).join(" · ")}
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <StatusPill tone={data.user.status === "active" ? "success" : "danger"}>{data.user.status}</StatusPill>
            <Link href={ROUTES.userDetail(id)} className="inline-flex items-center gap-1 text-xs font-semibold text-brand-primary-dark hover:underline">
              Open profile <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
