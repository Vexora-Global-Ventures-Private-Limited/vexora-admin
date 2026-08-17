"use client"

import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"

type PaginationControlsProps = {
  page: number
  setPage: (updater: (p: number) => number) => void
  totalPages: number
  start: number
  pageSize: number
  totalRows: number
}

/** Prev/Next footer shared by DataTable and any non-table paginated list (e.g. config fields). */
export function PaginationControls({ page, setPage, totalPages, start, pageSize, totalRows }: PaginationControlsProps) {
  if (totalPages <= 1) return null

  return (
    <div className="flex items-center justify-between border-t border-brand-border px-4 py-3 text-xs text-brand-muted-foreground">
      <span>
        Showing {start + 1}–{Math.min(start + pageSize, totalRows)} of {totalRows}
      </span>
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="gap-1 px-2.5">
          <ChevronLeft className="h-3.5 w-3.5" /> Prev
        </Button>
        <span className="font-semibold text-brand-secondary">
          Page {page} of {totalPages}
        </span>
        <Button size="sm" variant="outline" disabled={page === totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} className="gap-1 px-2.5">
          Next <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}
