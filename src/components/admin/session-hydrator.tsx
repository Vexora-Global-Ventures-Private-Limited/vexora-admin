"use client"

import { useEffect } from "react"
import { useAdminSession } from "@/lib/admin-session"

/** Rehydrates the persisted mock admin session after mount — admin-session.ts
 *  uses skipHydration to avoid an SSR mismatch, so nothing reads localStorage
 *  until this fires. Without it, hasHydrated never flips true and every guard
 *  (useAdminGuard) hangs on `return null` forever — a blank screen. */
export function AdminSessionHydrator() {
  useEffect(() => {
    useAdminSession.persist?.rehydrate()
  }, [])

  return null
}
