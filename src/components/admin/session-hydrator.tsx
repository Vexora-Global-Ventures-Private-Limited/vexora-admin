"use client"

import { clearReturnTo, rememberReturnTo } from "@/lib/return-to"
import { useEffect } from "react"
import { useAdminSession } from "@/lib/admin-session"
import {
  ADMIN_ACCESS_TOKEN_STORAGE_KEY,
  clearAccessToken,
  getAccessToken,
  isAccessTokenExpired,
} from "@/lib/admin-tokens"
import { ROUTES } from "@/lib/routes"
import { baseApi } from "@/store/api/baseApi"
import { useAppDispatch } from "@/store/hooks"

const SESSION_STORAGE_KEY = "vxa-admin-session"
const EXPIRY_CHECK_MS = 30_000

/** Pages that are fine to stay on with no session (they're the way back in). */
const isAuthPage = (path: string) => path.startsWith(ROUTES.login) || path.startsWith("/totp")

/**
 * Rehydrates the persisted admin session after mount — admin-session.ts
 * uses skipHydration to avoid an SSR mismatch, so nothing reads localStorage
 * until this fires. Without it, hasHydrated never flips true and every guard
 * (useAdminGuard) hangs on `return null` forever — a blank screen.
 *
 * Also keeps the session honest while a page stays open:
 *  - Other tabs: signing out (or in as someone else) in one tab only writes
 *    localStorage; the `storage` event fires in every OTHER tab, so they drop
 *    their cached data and follow instead of showing a dead session.
 *  - Expiry: the 8h token has no refresh — once it lapses the console
 *    signs out with an explanation instead of failing the next action.
 */
export function AdminSessionHydrator() {
  const dispatch = useAppDispatch()

  useEffect(() => {
    useAdminSession.persist?.rehydrate()
  }, [])

  useEffect(() => {
    const endSession = (reason: "expired" | "signed-out") => {
      clearAccessToken()
      useAdminSession.getState().logout()
      dispatch(baseApi.util.resetApiState())
      if (!isAuthPage(window.location.pathname)) {
        // Expired: bring them back here after signing in. Signed out on purpose: don't.
        if (reason === "expired") rememberReturnTo()
        else clearReturnTo()
        window.location.replace(reason === "expired" ? `${ROUTES.login}?session=expired` : ROUTES.login)
      }
    }

    const onStorage = (e: StorageEvent) => {
      if (e.key !== null && e.key !== ADMIN_ACCESS_TOKEN_STORAGE_KEY && e.key !== SESSION_STORAGE_KEY) return
      if (e.key === ADMIN_ACCESS_TOKEN_STORAGE_KEY || e.key === null) {
        if (!e.newValue && useAdminSession.getState().adminUser) {
          endSession("signed-out")
          return
        }
        // A different token (another tab signed in, or a step-up swapped it):
        // cached responses may belong to another account — refetch fresh.
        dispatch(baseApi.util.resetApiState())
      }
      useAdminSession.persist?.rehydrate()
    }

    const checkExpiry = () => {
      if (useAdminSession.getState().adminUser && getAccessToken() && isAccessTokenExpired()) endSession("expired")
    }

    window.addEventListener("storage", onStorage)
    const timer = window.setInterval(checkExpiry, EXPIRY_CHECK_MS)
    return () => {
      window.removeEventListener("storage", onStorage)
      window.clearInterval(timer)
    }
  }, [dispatch])

  return null
}
