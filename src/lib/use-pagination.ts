"use client"

import { useState } from "react"

/** Shared client-side pagination — slices `rows` and keeps `page` in range
 *  when the underlying list shrinks (e.g. an approve/reject removes a row).
 *  The clamp is derived during render rather than written back from an
 *  effect, so there's no extra render and no out-of-range frame. */
export function usePagination<T>(rows: T[], pageSize: number) {
  const [rawPage, setPage] = useState(1)
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize))
  const page = Math.min(rawPage, totalPages)

  const start = (page - 1) * pageSize
  const pageRows = rows.slice(start, start + pageSize)

  return { page, setPage, totalPages, start, pageRows }
}
