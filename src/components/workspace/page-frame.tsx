"use client"

import { useEffect, useRef, useState } from "react"
import type { PDFDocumentProxy } from "pdfjs-dist"
import { PageRenderSkeleton } from "@/components/skeletons"
import { renderPdfPage, type PageInfo } from "@/lib/documents"
import { cn } from "@/lib/utils"

export type PageSource =
  | { kind: "pdf"; doc: PDFDocumentProxy }
  | { kind: "image"; url: string }
  | { kind: "docx"; node: HTMLElement; widthPx: number }

export const STAMP_MIME = "application/x-estamp-id"

export function PageFrame({
  index,
  label,
  info,
  source,
  active,
  children,
  onActivate,
  onDropStamp,
  onBackgroundClick,
}: {
  index: number
  label: string
  info: PageInfo
  source: PageSource
  active: boolean
  children?: React.ReactNode
  onActivate: () => void
  onDropStamp: (stampId: string, x: number, y: number) => void
  onBackgroundClick: () => void
}) {
  const frame = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const docxHost = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const [visible, setVisible] = useState(index < 2)
  const [rendered, setRendered] = useState(source.kind !== "pdf")
  const [dragOver, setDragOver] = useState(false)
  const ratio = info.widthPt / info.heightPt

  // Track size and visibility.
  useEffect(() => {
    const el = frame.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setWidth(Math.round(e.contentRect.width)))
    ro.observe(el)
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setVisible(true), { rootMargin: "600px 0px" })
    io.observe(el)
    return () => {
      ro.disconnect()
      io.disconnect()
    }
  }, [])

  // Render PDF pages lazily, re-rendering when the width settles at a new size.
  const renderedWidth = useRef(0)
  useEffect(() => {
    if (source.kind !== "pdf" || !visible || !width || !canvas.current) return
    if (Math.abs(renderedWidth.current - width) < 24 && renderedWidth.current) return
    let cancelled = false
    let task: { cancel: () => void } | undefined
    const t = setTimeout(async () => {
      try {
        task = await renderPdfPage(source.doc, index, canvas.current!, width)
        if (!cancelled) {
          renderedWidth.current = width
          setRendered(true)
        }
      } catch {
        /* cancelled or failed render; skeleton stays */
      }
    }, renderedWidth.current ? 160 : 0)
    return () => {
      cancelled = true
      clearTimeout(t)
      task?.cancel()
    }
  }, [source, index, visible, width])

  // Mount the DOCX page node, scaled to the frame.
  useEffect(() => {
    if (source.kind !== "docx" || !docxHost.current) return
    const host = docxHost.current
    host.replaceChildren(source.node)
    return () => {
      if (source.node.parentElement === host) host.removeChild(source.node)
    }
  }, [source])

  const docxScale = source.kind === "docx" && width ? width / source.widthPx : 1

  return (
    <div className="scroll-mt-24" data-page={index}>
      <div
        ref={frame}
        onPointerDown={(e) => {
          if (e.target === e.currentTarget || (e.target as HTMLElement).dataset.pagebg !== undefined) {
            onActivate()
            onBackgroundClick()
          }
        }}
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes(STAMP_MIME)) {
            e.preventDefault()
            e.dataTransfer.dropEffect = "copy"
            setDragOver(true)
          }
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          const id = e.dataTransfer.getData(STAMP_MIME)
          setDragOver(false)
          if (!id) return
          e.preventDefault()
          const r = e.currentTarget.getBoundingClientRect()
          onDropStamp(id, (e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height)
        }}
        className={cn(
          "relative w-full overflow-hidden rounded-[6px] bg-white shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_18px_40px_-16px_rgba(0,0,0,0.8)]",
          "transition-shadow duration-200",
          active && "shadow-[0_0_0_2px_var(--ink),0_18px_40px_-16px_rgba(0,0,0,0.8)]",
          dragOver && "shadow-[0_0_0_3px_var(--ink),0_18px_40px_-16px_rgba(0,0,0,0.8)]",
        )}
        style={{ aspectRatio: ratio }}
      >
        {source.kind === "pdf" && (
          <>
            {!rendered && (
              <div className="absolute inset-0">
                <PageRenderSkeleton ratio={ratio} />
              </div>
            )}
            <canvas ref={canvas} data-pagebg="" className={cn("absolute inset-0 size-full", !rendered && "opacity-0")} />
          </>
        )}
        {source.kind === "image" && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={source.url} alt="" data-pagebg="" draggable={false} className="absolute inset-0 size-full object-fill select-none" />
        )}
        {source.kind === "docx" && (
          <div data-pagebg="" className="absolute inset-0 overflow-hidden">
            <div
              ref={docxHost}
              data-pagebg=""
              className="pointer-events-none origin-top-left"
              style={{ width: source.widthPx, transform: `scale(${docxScale})` }}
            />
          </div>
        )}
        {children}
      </div>
      <p className="tnum mt-2.5 text-center text-[12.5px] font-medium text-faint">{label}</p>
    </div>
  )
}
