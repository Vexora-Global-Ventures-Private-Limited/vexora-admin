"use client"

import { useCallback } from "react"
import { usePathname, useRouter } from "next/navigation"

export type ParamPatch = Record<string, string | number | undefined>

/**
 * Updates list filters kept in the URL. Reads the CURRENT query string from
 * window.location at call time instead of a `useSearchParams()` value
 * captured in a closure — a debounced search timer that fired after the user
 * changed another filter used to rebuild the URL from the stale copy and
 * silently undo that change.
 *
 * `undefined`, "", "all" and page=1 remove the key (clean URLs, one
 * canonical form per view).
 */
export function useSetUrlParams() {
  const router = useRouter()
  const pathname = usePathname()

  return useCallback(
    (patch: ParamPatch) => {
      const params = new URLSearchParams(window.location.search)
      for (const [key, value] of Object.entries(patch)) {
        if (value === undefined || value === "" || value === "all" || (key === "page" && value === 1)) params.delete(key)
        else params.set(key, String(value))
      }
      const qs = params.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    },
    [router, pathname],
  )
}

/** Positive-integer `page` param, defaulting to 1 for missing / junk values. */
export function parsePage(raw: string | null) {
  const n = Number(raw)
  return Number.isInteger(n) && n >= 1 ? n : 1
}
