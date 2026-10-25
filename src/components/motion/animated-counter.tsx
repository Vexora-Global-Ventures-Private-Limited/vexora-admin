"use client"

import { useEffect, useRef, useState } from "react"
import { animate, useInView, useMotionValue, useReducedMotion } from "framer-motion"
import { EASE_OUT } from "@/lib/motion-tokens"
import { cn } from "@/lib/utils"

type Props = {
  to: number
  decimals?: number
  prefix?: string
  suffix?: string
  duration?: number
  separator?: string
  className?: string
}

function format(n: number, decimals: number, separator: string) {
  const fixed = n.toFixed(decimals)
  const [int, dec] = fixed.split(".")
  const withSep = int.replace(/\B(?=(\d{3})+(?!\d))/g, separator)
  return dec ? `${withSep}.${dec}` : withSep
}

export function AnimatedCounter({
  to,
  decimals = 0,
  prefix = "",
  suffix = "",
  duration = 1.35,
  separator = ",",
  className,
}: Props) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, margin: "-40px" })
  const reduce = useReducedMotion()
  const mv = useMotionValue(0)
  const [display, setDisplay] = useState("0")

  useEffect(() => {
    if (!inView || reduce) return
    const controls = animate(mv, to, {
      duration,
      ease: EASE_OUT,
      onUpdate: (v) => setDisplay(format(v, decimals, separator)),
    })
    return () => controls.stop()
  }, [inView, to, decimals, separator, duration, reduce, mv])

  return (
    <span ref={ref} className={cn("tabular-nums", className)}>
      {prefix}
      {/* useReducedMotion() is null on the first render, so seeding state from
          it left reduced-motion users looking at "0" forever. */}
      {reduce ? format(to, decimals, separator) : display}
      {suffix}
    </span>
  )
}
