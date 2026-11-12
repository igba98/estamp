"use client"

import { memo, useId, useMemo } from "react"
import { buildStampSvg, type StampContext } from "@/lib/stamp-svg"
import type { StampDesign } from "@/lib/types"
import { cn } from "@/lib/utils"

/** Renders a stamp design as inline SVG, scaled to its container width. */
export const StampView = memo(function StampView({
  design,
  ctx,
  className,
  style,
}: {
  design: StampDesign
  ctx?: StampContext
  className?: string
  style?: React.CSSProperties
}) {
  const rid = useId().replace(/[^a-zA-Z0-9]/g, "")
  const s = useMemo(() => buildStampSvg(design, { ...ctx, uid: `${design.id}${rid}` }), [design, ctx, rid])
  const html = useMemo(() => s.svg.replace(/width="[\d.]+" height="[\d.]+"/, 'width="100%" height="100%"'), [s])
  return (
    <div
      role="img"
      aria-label={`${design.label} stamp for ${design.orgName}`}
      className={cn("[&>svg]:block", className)}
      style={{ aspectRatio: `${s.width} / ${s.height}`, ...style }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
})

/** A sheet of paper with the stamp pressed on it. */
export function PaperSheet({ children, className, lines }: { children: React.ReactNode; className?: string; lines?: boolean }) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[10px] bg-paper shadow-[0_1px_0_rgba(255,255,255,0.6)_inset,0_8px_24px_-8px_rgba(0,0,0,0.7)]",
        className,
      )}
    >
      {lines && (
        <div aria-hidden className="pointer-events-none absolute inset-x-[9%] top-[10%] space-y-[5%] opacity-70">
          <div className="h-[3px] w-[38%] rounded-full bg-paper-line" />
          <div className="h-[3px] w-[64%] rounded-full bg-paper-line/70" />
        </div>
      )}
      <div className="relative">{children}</div>
    </div>
  )
}
