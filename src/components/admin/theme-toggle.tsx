"use client"

import { useSyncExternalStore } from "react"
import { useTheme } from "next-themes"
import { Moon, Sun } from "lucide-react"
import { Button } from "@/components/ui/button"

/** Light/dark toggle — flips next-themes' class strategy; globals.css already
 *  ships both `:root` and `.dark` token sets (shared with VXP's brand tokens). */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  // false during SSR/hydration, true on the client — the resolved theme is
  // only known client-side. (Replaces a setState-in-effect "mounted" flag.)
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  )

  if (!mounted) return <div className="h-9 w-9" />

  const isDark = resolvedTheme === "dark"

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  )
}
