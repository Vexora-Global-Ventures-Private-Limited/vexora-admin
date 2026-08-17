"use client"

import { useEffect, useState } from "react"

/** Shared client-side pagination — slices `rows` and keeps `page` in range
 *  when the underlying list shrinks (e.g. an approve/reject removes a row). */
export function usePagination<T>(rows: T[], pageSize: number) {
  const [page, setPage] = useState(1)
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize))

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const start = (page - 1) * pageSize
  const pageRows = rows.slice(start, start + pageSize)

  return { page, setPage, totalPages, start, pageRows }
}
