import { cn } from "@/lib/utils"

/** eStamp mark: a seal ring pressed into an ink-blue tile. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-8 shrink-0", className)} aria-hidden>
      <rect width="32" height="32" rx="9" fill="var(--ink)" />
      <rect width="32" height="32" rx="9" fill="url(#lm-sheen)" />
      <circle cx="16" cy="16" r="9.6" fill="none" stroke="#fff" strokeWidth="2" />
      <circle cx="16" cy="16" r="6.4" fill="none" stroke="#fff" strokeOpacity="0.55" strokeWidth="1" />
      <path d="M12.6 16h6.8M12.6 13.4h6.8M12.6 18.6h4.4" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
      <defs>
        <linearGradient id="lm-sheen" x1="0" y1="0" x2="0" y2="32">
          <stop offset="0" stopColor="#fff" stopOpacity="0.22" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  )
}

export function Logo({ className, compact }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <LogoMark />
      {!compact && (
        <span className="text-[17px] font-bold tracking-[-0.02em]">
          e<span className="text-foreground">Stamp</span>
        </span>
      )}
    </span>
  )
}
