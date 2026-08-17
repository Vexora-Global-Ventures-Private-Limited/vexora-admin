/**
 * Editorial motion system — restrained, performant, non-template.
 * Prefer opacity + small translate. Avoid springs, loops, and parallax stacks.
 */

/** Primary ease — decelerates into place (luxury editorial) */
export const EASE_OUT = [0.16, 1, 0.3, 1] as const

/** Legacy alias */
export const EASE_ROYAL = EASE_OUT

export const MOTION = {
  instant: 0.15,
  fast: 0.28,
  base: 0.42,
  slow: 0.52,
  page: 0.32,
} as const

/** Scroll-reveal defaults */
export const REVEAL = {
  distance: 12,
  duration: 0.45,
  stagger: 0.045,
  viewportMargin: "-48px",
} as const

export function tween(
  duration: number = MOTION.base,
  delay = 0,
  ease: readonly [number, number, number, number] = EASE_OUT,
) {
  return { duration, delay, ease }
}

/** @deprecated Use CSS hover-lift / card-sheen instead of Framer springs */
export const SPRING = {
  card: { type: "tween" as const, duration: MOTION.base, ease: EASE_OUT },
  soft: { type: "tween" as const, duration: MOTION.slow, ease: EASE_OUT },
  snappy: { type: "tween" as const, duration: MOTION.fast, ease: EASE_OUT },
}
