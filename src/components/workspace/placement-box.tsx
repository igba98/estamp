"use client"

import { motion, useReducedMotion } from "motion/react"
import { useEffect, useRef } from "react"
import { RotateCw, X } from "lucide-react"
import { StampView } from "@/components/stamp/stamp-view"
import type { Placement } from "@/lib/documents"
import type { StampContext } from "@/lib/stamp-svg"
import type { StampDesign } from "@/lib/types"
import { cn } from "@/lib/utils"

type Props = {
  placement: Placement
  design: StampDesign
  ctx: StampContext
  /** width / height of the stamp artwork */
  aspect: number
  /** width / height of the page */
  pageAspect: number
  selected: boolean
  fresh: boolean
  onSelect: () => void
  onChange: (p: Partial<Placement>) => void
  onRemove: () => void
}

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))

export function PlacementBox({ placement: p, design, ctx, aspect, pageAspect, selected, fresh, onSelect, onChange, onRemove }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const reduce = useReducedMotion()

  // Bring a newly added stamp into view if it landed off-screen.
  useEffect(() => {
    if (!fresh || !ref.current) return
    const r = ref.current.getBoundingClientRect()
    if (r.top < 80 || r.bottom > window.innerHeight - 24) {
      ref.current.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" })
    }
  }, [fresh, reduce])

  function frameRect() {
    return ref.current!.parentElement!.getBoundingClientRect()
  }

  function startDrag(e: React.PointerEvent) {
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    onSelect()
    const el = e.currentTarget as HTMLElement
    el.setPointerCapture(e.pointerId)
    const r = frameRect()
    const start = { x: e.clientX, y: e.clientY, px: p.x, py: p.y }
    const move = (ev: PointerEvent) => {
      onChange({
        x: clamp(start.px + (ev.clientX - start.x) / r.width, 0, 1),
        y: clamp(start.py + (ev.clientY - start.y) / r.height, 0, 1),
      })
    }
    const up = () => {
      el.removeEventListener("pointermove", move)
      el.removeEventListener("pointerup", up)
      el.removeEventListener("pointercancel", up)
    }
    el.addEventListener("pointermove", move)
    el.addEventListener("pointerup", up)
    el.addEventListener("pointercancel", up)
  }

  function startResize(e: React.PointerEvent) {
    e.preventDefault()
    e.stopPropagation()
    const el = e.currentTarget as HTMLElement
    el.setPointerCapture(e.pointerId)
    const r = frameRect()
    const cx = r.left + p.x * r.width
    const cy = r.top + p.y * r.height
    // Half-diagonal of the stamp box in px at the current size.
    const w0 = p.w * r.width
    const h0 = w0 / aspect
    const d0 = Math.hypot(w0 / 2, h0 / 2)
    const dist0 = Math.hypot(e.clientX - cx, e.clientY - cy)
    const move = (ev: PointerEvent) => {
      const dist = Math.hypot(ev.clientX - cx, ev.clientY - cy)
      const k = (d0 + (dist - dist0)) / d0
      onChange({ w: clamp(p.w * k, 0.05, 0.95) })
    }
    const up = () => {
      el.removeEventListener("pointermove", move)
      el.removeEventListener("pointerup", up)
    }
    el.addEventListener("pointermove", move)
    el.addEventListener("pointerup", up)
  }

  function startRotate(e: React.PointerEvent) {
    e.preventDefault()
    e.stopPropagation()
    const el = e.currentTarget as HTMLElement
    el.setPointerCapture(e.pointerId)
    const r = frameRect()
    const cx = r.left + p.x * r.width
    const cy = r.top + p.y * r.height
    const move = (ev: PointerEvent) => {
      let deg = (Math.atan2(ev.clientY - cy, ev.clientX - cx) * 180) / Math.PI + 90
      if (ev.shiftKey) deg = Math.round(deg / 15) * 15
      else {
        for (const snap of [-180, -90, 0, 90, 180, 270]) if (Math.abs(deg - snap) < 4) deg = snap
      }
      deg = ((deg + 540) % 360) - 180
      onChange({ rot: Math.round(deg) })
    }
    const up = () => {
      el.removeEventListener("pointermove", move)
      el.removeEventListener("pointerup", up)
    }
    el.addEventListener("pointermove", move)
    el.addEventListener("pointerup", up)
  }

  function onKey(e: React.KeyboardEvent) {
    const step = e.shiftKey ? 0.02 : 0.004
    const k = e.key
    if (k === "ArrowLeft") onChange({ x: clamp(p.x - step, 0, 1) })
    else if (k === "ArrowRight") onChange({ x: clamp(p.x + step, 0, 1) })
    else if (k === "ArrowUp") onChange({ y: clamp(p.y - step * pageAspect, 0, 1) })
    else if (k === "ArrowDown") onChange({ y: clamp(p.y + step * pageAspect, 0, 1) })
    else if (k === "[") onChange({ rot: p.rot - (e.shiftKey ? 15 : 1) })
    else if (k === "]") onChange({ rot: p.rot + (e.shiftKey ? 15 : 1) })
    else if (k === "-" || k === "_") onChange({ w: clamp(p.w * 0.96, 0.05, 0.95) })
    else if (k === "=" || k === "+") onChange({ w: clamp(p.w * 1.04, 0.05, 0.95) })
    else if (k === "Delete" || k === "Backspace") onRemove()
    else return
    e.preventDefault()
  }

  return (
    <div
      ref={ref}
      className="absolute"
      style={{
        left: `${p.x * 100}%`,
        top: `${p.y * 100}%`,
        width: `${p.w * 100}%`,
        transform: `translate(-50%, -50%) rotate(${p.rot}deg)`,
        zIndex: selected ? 20 : 10,
      }}
    >
      <motion.div
        initial={fresh && !reduce ? { scale: 1.16, opacity: 0, filter: "blur(3px)" } : false}
        animate={{ scale: 1, opacity: 1, filter: "blur(0px)" }}
        transition={{ duration: 0.24, ease: [0.23, 1, 0.32, 1] }}
        role="button"
        tabIndex={0}
        aria-label={`${design.name} stamp. Drag to move. Arrow keys nudge, [ and ] rotate, + and − resize, Delete removes.`}
        aria-pressed={selected}
        onPointerDown={startDrag}
        onKeyDown={onKey}
        onFocus={onSelect}
        className={cn(
          "relative cursor-grab touch-none outline-none select-none active:cursor-grabbing",
          "rounded-[4px] ring-offset-0",
          selected ? "ring-[1.5px] ring-ink" : "hover:ring-1 hover:ring-ink/50",
        )}
      >
        <StampView design={design} ctx={ctx} className="pointer-events-none mix-blend-multiply" />
      </motion.div>

      {selected && (
        <>
          {/* rotate */}
          <button
            type="button"
            tabIndex={-1}
            aria-hidden
            onPointerDown={startRotate}
            className="absolute -top-9 left-1/2 grid size-7 -translate-x-1/2 cursor-grab touch-none place-items-center rounded-full border border-black/10 bg-white text-ink shadow-md"
          >
            <RotateCw className="size-3.5" />
          </button>
          <span className="pointer-events-none absolute -top-2 left-1/2 h-2 w-px -translate-x-1/2 bg-ink" aria-hidden />
          {/* remove */}
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={onRemove}
            aria-label="Remove this stamp"
            className="absolute -top-3 -right-3 grid size-6 place-items-center rounded-full bg-[#1c1c1f] text-white shadow-md ring-2 ring-white"
          >
            <X className="size-3.5" />
          </button>
          {/* resize */}
          <span
            aria-hidden
            onPointerDown={startResize}
            className="absolute -right-2 -bottom-2 size-4 cursor-nwse-resize touch-none rounded-[4px] border-2 border-ink bg-white shadow"
          />
          {/* bigger touch target for resize on coarse pointers */}
          <span aria-hidden onPointerDown={startResize} className="absolute -right-5 -bottom-5 hidden size-10 touch-none [@media(pointer:coarse)]:block" />
        </>
      )}
    </div>
  )
}
