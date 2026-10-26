"use client"

import { useMemo, useState, type ReactNode } from "react"
import { ArrowUp, ArrowDown, ChevronsUpDown } from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { PaginationControls } from "@/components/admin/pagination-controls"
import { usePagination } from "@/lib/use-pagination"
import { cn } from "@/lib/utils"

export type DataTableColumn<T> = {
  key: string
  header: string
  render: (row: T) => ReactNode
  className?: string
  /** Enables the clickable sort header for this column. Requires sortValue. */
  sortable?: boolean
  /** Value to compare when sorting — strings compare case-insensitively, numbers numerically. */
  sortValue?: (row: T) => string | number
}

type SortDirection = "asc" | "desc"

type DataTableProps<T> = {
  columns: DataTableColumn<T>[]
  rows: T[]
  rowKey: (row: T) => string
  emptyLabel?: string
  onRowClick?: (row: T) => void
  /** Rows per page — pagination controls only render once rows exceed this. */
  pageSize?: number
  /** Column key to sort by initially (must be a sortable column). */
  defaultSortKey?: string
  defaultSortDirection?: SortDirection
  /** Shows skeleton rows instead of the empty state while the first fetch runs. */
  loading?: boolean
  /** Accessible name for the table. */
  ariaLabel?: string
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  emptyLabel = "Nothing to show yet.",
  onRowClick,
  pageSize = 5,
  defaultSortKey,
  defaultSortDirection = "asc",
  loading,
  ariaLabel,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | undefined>(defaultSortKey)
  const [sortDirection, setSortDirection] = useState<SortDirection>(defaultSortDirection)

  const sortedRows = useMemo(() => {
    const col = columns.find((c) => c.key === sortKey)
    if (!col?.sortValue) return rows
    const { sortValue } = col
    const sorted = [...rows].sort((a, b) => {
      const av = sortValue(a)
      const bv = sortValue(b)
      if (typeof av === "number" && typeof bv === "number") return av - bv
      return String(av).localeCompare(String(bv), undefined, { sensitivity: "base" })
    })
    if (sortDirection === "desc") sorted.reverse()
    return sorted
  }, [rows, sortKey, sortDirection, columns])

  const { page, setPage, totalPages, start, pageRows } = usePagination(sortedRows, pageSize)

  const toggleSort = (col: DataTableColumn<T>) => {
    if (!col.sortable || !col.sortValue) return
    if (sortKey !== col.key) {
      setSortKey(col.key)
      setSortDirection("asc")
    } else {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"))
    }
  }

  if (loading && rows.length === 0) {
    return (
      <div className="space-y-2 border border-brand-border bg-card p-4" aria-busy="true" aria-label="Loading">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-8 w-full animate-pulse bg-brand-tertiary/70" />
        ))}
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div className="border border-brand-border bg-card p-8 text-center text-sm text-brand-muted-foreground">
        {emptyLabel}
      </div>
    )
  }

  return (
    // Focusable scroll region: on narrow screens the table scrolls sideways,
    // and keyboard users need to be able to reach the hidden columns too.
    <div
      className="overflow-x-auto border border-brand-border bg-card focus-visible:outline-2 focus-visible:outline-brand-primary"
      tabIndex={0}
      role="region"
      aria-label={ariaLabel ? `${ariaLabel} (scrollable)` : "Table (scrollable)"}
    >
      <Table aria-label={ariaLabel}>
        <TableHeader>
          <TableRow className="border-brand-border hover:bg-transparent">
            {columns.map((col) => (
              <TableHead
                key={col.key}
                aria-sort={
                  col.sortable && sortKey === col.key ? (sortDirection === "asc" ? "ascending" : "descending") : undefined
                }
                className={cn("text-[11px] font-semibold uppercase tracking-wide text-brand-muted-foreground", col.className)}
              >
                {col.sortable && col.sortValue ? (
                  <button
                    type="button"
                    onClick={() => toggleSort(col)}
                    className="inline-flex items-center gap-1 hover:text-brand-secondary"
                  >
                    {col.header}
                    {sortKey === col.key ? (
                      sortDirection === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                    ) : (
                      <ChevronsUpDown className="h-3 w-3 opacity-40" />
                    )}
                  </button>
                ) : (
                  col.header
                )}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {pageRows.map((row) => (
            <TableRow
              key={rowKey(row)}
              className={cn("border-brand-border/70", onRowClick && "cursor-pointer hover:bg-brand-tertiary/50")}
              // Ignore clicks that started on a link/button/input inside the row —
              // e.g. a row action button would otherwise also open the row.
              onClick={(e) => {
                if (!onRowClick) return
                const interactive = (e.target as HTMLElement).closest("a,button,input,select,textarea,[role=button],[role=menuitem]")
                if (interactive && interactive !== e.currentTarget) return
                onRowClick(row)
              }}
              {...(onRowClick
                ? {
                    role: "button" as const,
                    tabIndex: 0,
                    onKeyDown: (e: React.KeyboardEvent<HTMLTableRowElement>) => {
                      if ((e.key === "Enter" || e.key === " ") && e.target === e.currentTarget) {
                        e.preventDefault()
                        onRowClick(row)
                      }
                    },
                  }
                : {})}
            >
              {columns.map((col) => (
                <TableCell key={col.key} className={col.className}>
                  {col.render(row)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <PaginationControls page={page} setPage={setPage} totalPages={totalPages} start={start} pageSize={pageSize} totalRows={sortedRows.length} />
    </div>
  )
}
