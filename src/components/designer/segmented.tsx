"use client"

import { motion } from "motion/react"
import { useId } from "react"
import { cn } from "@/lib/utils"

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string; icon?: React.ReactNode; iconOnly?: boolean }[]
  label: string
  className?: string
}) {
  const id = useId()
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn("grid gap-1 rounded-[12px] border border-white/[0.07] bg-black/25 p-1", className)}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
      onKeyDown={(e) => {
        const i = options.findIndex((o) => o.value === value)
        if (e.key === "ArrowRight" || e.key === "ArrowDown") {
          e.preventDefault()
          onChange(options[(i + 1) % options.length].value)
        } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
          e.preventDefault()
          onChange(options[(i - 1 + options.length) % options.length].value)
        }
      }}
    >
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(o.value)}
            className={cn(
              "relative flex h-9 items-center justify-center gap-1.5 rounded-[9px] text-[13px] font-semibold transition-colors duration-150",
              active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {active && (
              <motion.span
                layoutId={`seg-${id}`}
                className="absolute inset-0 rounded-[9px] bg-white/[0.09] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_1px_2px_rgba(0,0,0,0.4)]"
                transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
              />
            )}
            <span className="relative flex items-center gap-1.5">
              {o.icon}
              <span className={o.iconOnly ? "sr-only" : undefined}>{o.label}</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}
