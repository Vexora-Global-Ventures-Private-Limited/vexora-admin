"use client"

import { useEffect, useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

/**
 * Photos in a popup carousel: big image, ‹ › buttons, ← → keys, thumbnail
 * strip, "n / total". Plain <img> (any https host the seller used), with no
 * referrer so the image host doesn't learn the admin portal's URL.
 */
export function PhotoCarouselDialog({
  photos,
  title,
  startIndex = 0,
  onClose,
}: {
  photos: string[]
  title: string
  startIndex?: number
  onClose: () => void
}) {
  const [index, setIndex] = useState(Math.min(startIndex, Math.max(0, photos.length - 1)))
  const count = photos.length
  const go = (delta: number) => setIndex((i) => (i + delta + count) % count)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") setIndex((i) => (i - 1 + count) % count)
      else if (e.key === "ArrowRight") setIndex((i) => (i + 1) % count)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [count])

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl gap-3 p-4 sm:p-5">
        <DialogHeader>
          <DialogTitle className="font-serif text-lg">{title}</DialogTitle>
          <DialogDescription>
            Photo {index + 1} of {count} · use ← → to browse
          </DialogDescription>
        </DialogHeader>

        <div className="relative flex h-[60vh] items-center justify-center bg-ink-black/90">
          <img src={photos[index]} alt={`${title} — photo ${index + 1}`} referrerPolicy="no-referrer" className="max-h-full max-w-full select-none object-contain" draggable={false} />
          {count > 1 && (
            <>
              <button
                type="button"
                onClick={() => go(-1)}
                aria-label="Previous photo"
                className="absolute left-2 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center border border-white/25 bg-ink-black/60 text-white hover:bg-white/10"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => go(1)}
                aria-label="Next photo"
                className="absolute right-2 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center border border-white/25 bg-ink-black/60 text-white hover:bg-white/10"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </>
          )}
          <a href={photos[index]} target="_blank" rel="noopener noreferrer" className="absolute bottom-2 right-2 bg-ink-black/70 px-2 py-1 text-[11px] text-white hover:underline">
            Open original ↗
          </a>
        </div>

        {count > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {photos.map((src, i) => (
              <button
                key={`${src}-${i}`}
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Show photo ${i + 1}`}
                aria-current={i === index}
                className={cn("h-14 w-20 shrink-0 overflow-hidden ring-2", i === index ? "ring-brand-primary" : "opacity-60 ring-transparent hover:opacity-100")}
              >
                <img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
