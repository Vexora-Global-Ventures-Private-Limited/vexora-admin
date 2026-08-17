"use client"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export type FilterOption = { label: string; value: string }

export type FilterDef = {
  key: string
  label: string
  value: string
  onChange: (value: string) => void
  options: FilterOption[]
  /** Value that represents "no filter applied" — defaults to "all". */
  allValue?: string
}

type FilterBarProps = {
  filters: FilterDef[]
}

/** Row of Select-based filters shared by admin list pages (API doc §1.3 filter[field] grammar). */
export function FilterBar({ filters }: FilterBarProps) {
  if (filters.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      {filters.map((f) => (
        <Select key={f.key} value={f.value} onValueChange={f.onChange}>
          <SelectTrigger size="sm" className="w-[168px] bg-card" aria-label={f.label}>
            <SelectValue placeholder={f.label} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={f.allValue ?? "all"}>All {f.label.toLowerCase()}</SelectItem>
            {f.options.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ))}
    </div>
  )
}
