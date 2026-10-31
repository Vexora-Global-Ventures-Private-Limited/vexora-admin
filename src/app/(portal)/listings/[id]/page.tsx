"use client"

import { UserCard } from "@/components/admin/users/user-chip"
import { use } from "react"
import { useRouter } from "next/navigation"
import { StatusPill } from "@/components/admin/status-pill"
import { DetailBackLink, DetailCard } from "@/components/admin/detail-page-shell"
import { ListingPhotosCell } from "@/components/admin/moderation/listing-photos-cell"
import { PendingListingButtons, LiveListingTools, useListingActions } from "@/components/admin/moderation/listing-actions"
import { Fact, QueryState, ShortId, formatDateTime, formatPaise, isObjectId } from "@/components/admin/moderation/shared"
import { listingStatusLabel, listingStatusTone } from "@/lib/listing-status"
import { listingPhotos, useGetListingQueueQuery } from "@/store/api/adminApi"
import { ROUTES } from "@/lib/routes"

/**
 * There's no admin "get listing by id" endpoint, so a listing's review card
 * is derived from the moderation queue. A listing that isn't in the queue
 * (already decided, or a live listing opened by id) gets the live-listing
 * tools instead — extend/remove work on any listing id.
 */
export default function ListingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { data, isLoading, isFetching, error, refetch } = useGetListingQueueQuery(undefined, { refetchOnMountOrArgChange: true })
  // Once a pending listing is approved/rejected it leaves the queue — go back to it.
  const actions = useListingActions((action) => {
    if (action === "approved" || action === "rejected") router.push(ROUTES.listings)
  })
  const listing = data?.find((l) => l._id === id)

  if (!isObjectId(id)) {
    return (
      <div className="max-w-2xl space-y-6">
        <DetailBackLink href={ROUTES.listings} label="Listing queue" />
        <DetailCard>
          <p className="text-sm text-brand-secondary/70">“{id}” isn&apos;t a valid listing id.</p>
        </DetailCard>
      </div>
    )
  }

  return (
    <div className="max-w-2xl space-y-6">
      <DetailBackLink href={ROUTES.listings} label="Listing queue" />

      <QueryState isLoading={isLoading} error={error} onRetry={refetch} isFetching={isFetching} rows={3}>
        {listing ? (
          <DetailCard>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="break-words font-serif text-xl font-bold text-brand-secondary">{listing.title || "Untitled listing"}</div>
                <div className="mt-1 text-sm text-brand-secondary/55">
                  {[listing.locality, listing.city, listing.state, listing.pincode].filter(Boolean).join(", ") || "Location not given"}
                </div>
              </div>
              <StatusPill tone={listingStatusTone(listing.status)}>{listingStatusLabel(listing.status)}</StatusPill>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
              <Fact label="Price" value={formatPaise(listing.pricePaise)} />
              <Fact label="Type" value={listing.propertyType || "—"} />
              <Fact label="Purpose" value={listing.purpose === "rent" ? "Rent" : listing.purpose === "sale" ? "Sale" : listing.purpose || "—"} />
              <Fact label="BHK" value={listing.bhk ?? "—"} />
              <Fact label="Area" value={listing.areaSqft ? `${listing.areaSqft.toLocaleString("en-IN")} sq.ft` : "—"} />
              <Fact label="Submitted" value={formatDateTime(listing.submittedAt ?? listing.updatedAt)} />
              <Fact label="Created" value={formatDateTime(listing.createdAt)} />
              <Fact label="Listing id" value={<ShortId id={listing._id} />} />
            </div>

            <div className="mt-4">
              <UserCard id={listing.sellerId} role="Seller — who posted this listing" />
            </div>

            <div className="mt-4">
              <div className="text-[10px] uppercase tracking-wide text-brand-secondary/50">Photos</div>
              <div className="mt-1">
                <ListingPhotosCell title={listing.title || "Listing"} photos={listingPhotos(listing)} size="lg" />
              </div>
            </div>

            {listing.description && (
              <div className="mt-4">
                <div className="text-[10px] uppercase tracking-wide text-brand-secondary/50">Description</div>
                <p className="mt-1 whitespace-pre-wrap break-words text-sm text-brand-secondary/80">{listing.description}</p>
              </div>
            )}

            {listing.status === "pending_review" && (
              <div className="mt-5">
                <PendingListingButtons id={listing._id} title={listing.title || "this listing"} actions={actions} size="default" />
              </div>
            )}
          </DetailCard>
        ) : (
          <DetailCard>
            <div className="font-serif text-lg font-bold text-brand-secondary">Not in the review queue</div>
            <p className="mt-1 text-sm text-brand-secondary/65">
              Listing <span className="font-mono text-xs">{id}</span> isn&apos;t waiting for review — it was already decided, withdrawn, or
              it&apos;s a live listing. If it&apos;s live, you can still extend or remove it below.
            </p>
          </DetailCard>
        )}
      </QueryState>

      {!isLoading && !error && (!listing || listing.status !== "pending_review") && <LiveListingTools actions={actions} presetId={id} />}
    </div>
  )
}
