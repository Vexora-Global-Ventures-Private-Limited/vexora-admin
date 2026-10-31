"use client"

import { useState } from "react"
import { Images } from "lucide-react"
import { PhotoCarouselDialog } from "@/components/admin/photo-carousel-dialog"

/**
 * Cover thumbnail + photo count; click opens every photo in a carousel.
 * `photos === null` means the API didn't send a photo field at all — said
 * plainly, so it isn't mistaken for "the seller added no photos".
 */
export function ListingPhotosCell({ title, photos, size = "sm" }: { title: string; photos: string[] | null; size?: "sm" | "lg" }) {
  const [open, setOpen] = useState(false)

  if (photos === null) {
    return (
      <span className="text-[11px] text-brand-secondary/45" title="The admin listings API doesn't include photos yet">
        Not sent by API
      </span>
    )
  }
  if (photos.length === 0) return <span className="text-[11px] text-brand-secondary/55">No photos</span>

  const box = size === "lg" ? "h-24 w-36" : "h-12 w-16"
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`View ${photos.length} photo${photos.length === 1 ? "" : "s"} of ${title}`}
        className={`group relative block ${box} shrink-0 overflow-hidden bg-brand-tertiary/40 ring-1 ring-brand-border hover:ring-brand-primary`}
      >
        <img src={photos[0]} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover transition-transform group-hover:scale-105" />
        <span className="absolute bottom-0.5 right-0.5 inline-flex items-center gap-0.5 bg-ink-black/75 px-1 text-[10px] font-bold text-white">
          <Images className="h-2.5 w-2.5" /> {photos.length}
        </span>
      </button>
      {open && <PhotoCarouselDialog photos={photos} title={title} onClose={() => setOpen(false)} />}
    </>
  )
}
