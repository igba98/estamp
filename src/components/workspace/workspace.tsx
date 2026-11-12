"use client"

import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { nanoid } from "nanoid"
import { toast } from "sonner"
import {
  ArrowLeft,
  Copy,
  CopyPlus,
  Download,
  FileWarning,
  Loader2,
  Lock,
  MousePointerClick,
  RefreshCw,
  RotateCcw,
  Trash2,
} from "lucide-react"
import type { PDFDocumentProxy } from "pdfjs-dist"
import { Page, PageHeader, Panel } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { DropZone } from "@/components/drop-zone"
import { WorkspaceSkeleton, PageRenderSkeleton } from "@/components/skeletons"
import { Skeleton } from "@/components/ui/skeleton"
import { PaperSheet, StampView } from "@/components/stamp/stamp-view"
import { InkDot } from "@/components/stamp/stamp-tiles"
import { Segmented } from "@/components/designer/segmented"
import { DocIcon, Fade, kindLabel } from "@/components/docs/doc-bits"
import { PageFrame, STAMP_MIME, type PageSource } from "./page-frame"
import { PlacementBox } from "./placement-box"
import { exportStamped, type ExportResult } from "./export"
import { SuccessDialog } from "./success-dialog"
import {
  detectKind,
  docxPageSizes,
  formatBytes,
  imageInfo,
  openPdf,
  type PageInfo,
  type Placement,
} from "@/lib/documents"
import { buildStampSvg, type StampContext } from "@/lib/stamp-svg"
import { peekRef, setPendingFile, takePendingFile, useAppState } from "@/lib/store"
import type { DocKind, StampDesign } from "@/lib/types"
import { verifyUrlFor } from "@/lib/verify"
import { friendlyError } from "@/lib/supabase"
import { cn } from "@/lib/utils"

type Loaded = {
  file: File
  bytes: ArrayBuffer
  kind: DocKind
  pages: PageInfo[]
  /** Pages in the real document (DOCX may show only first and last). */
  pageCount: number
  sources: PageSource[]
  labels: string[]
  short: string[]
  pdf?: PDFDocumentProxy
  imageUrl?: string
  cleanup: () => void
}

type Status = { s: "idle" } | { s: "loading"; name: string } | { s: "ready" } | { s: "error"; message: string }

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))

export function Workspace() {
  const params = useSearchParams()
  const router = useRouter()
  const ready = useAppState((s) => s.ready)
  const stamps = useAppState((s) => s.stamps)
  const [status, setStatus] = useState<Status>({ s: "idle" })
  const [doc, setDoc] = useState<Loaded | null>(null)
  const [placements, setPlacements] = useState<Placement[]>([])
  const [fresh, setFresh] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [chosenStamp, setActiveStamp] = useState<string | null>(params.get("with"))
  const [currentPage, setCurrentPage] = useState(0)
  const [imageFormat, setImageFormat] = useState<"pdf" | "png">("pdf")
  const [exporting, setExporting] = useState(false)
  const [result, setResult] = useState<ExportResult | null>(null)
  const pagesRef = useRef<HTMLDivElement>(null)

  /* ---------------- load a file ---------------- */

  const open = useCallback(async (file: File) => {
    const kind = detectKind(file)
    if (!kind) return
    setStatus({ s: "loading", name: file.name })
    setDoc((old) => {
      old?.cleanup()
      return null
    })
    setPlacements([])
    setSelected(null)
    setCurrentPage(0)
    setResult(null)
    try {
      const bytes = await file.arrayBuffer()
      let loaded: Loaded
      if (kind === "pdf") {
        const { doc: pdf, pages } = await openPdf(bytes)
        loaded = {
          file,
          bytes,
          kind,
          pages,
          pageCount: pages.length,
          sources: pages.map(() => ({ kind: "pdf", doc: pdf })),
          labels: pages.map((_, i) => `Page ${i + 1} of ${pages.length}`),
          short: pages.map((_, i) => `Page ${i + 1}`),
          pdf,
          cleanup: () => void pdf.loadingTask.destroy(),
        }
      } else if (kind === "image") {
        const info = await imageInfo(file)
        loaded = {
          file,
          bytes,
          kind,
          pages: [{ widthPt: info.width * 0.75, heightPt: info.height * 0.75 }],
          pageCount: 1,
          sources: [{ kind: "image", url: info.url }],
          labels: [`${info.width} × ${info.height} px`],
          short: ["Image"],
          imageUrl: info.url,
          cleanup: () => URL.revokeObjectURL(info.url),
        }
      } else {
        loaded = await openDocx(file, bytes)
      }
      setDoc(loaded)
      setStatus({ s: "ready" })
    } catch (e) {
      console.error(e)
      const msg =
        e instanceof Error && /password|encrypt/i.test(e.message)
          ? "This PDF is password-protected. Remove the password and try again."
          : kind === "docx"
            ? "This Word file couldn't be read. Open it in Word and save it again as .docx, then retry."
            : "This file couldn't be opened. It may be damaged or in an unsupported format."
      setStatus({ s: "error", message: msg })
    }
  }, [])

  // File handed over from the dashboard drop zone.
  useEffect(() => {
    const f = takePendingFile()
    if (f) queueMicrotask(() => void open(f))
  }, [open])

  useEffect(() => () => doc?.cleanup(), [doc])

  // Fall back to the first stamp when nothing (valid) is chosen.
  const activeStamp = chosenStamp && stamps.some((s) => s.id === chosenStamp) ? chosenStamp : (stamps[0]?.id ?? null)

  // Warn before leaving with unsaved placements.
  useEffect(() => {
    if (!placements.length || result) return
    const h = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener("beforeunload", h)
    return () => window.removeEventListener("beforeunload", h)
  }, [placements.length, result])

  // Track which page is in view.
  useEffect(() => {
    const root = pagesRef.current
    if (!root || !doc) return
    const io = new IntersectionObserver(
      (entries) => {
        const best = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
        if (best) setCurrentPage(Number((best.target as HTMLElement).dataset.page))
      },
      { threshold: [0.25, 0.5, 0.75] },
    )
    root.querySelectorAll("[data-page]").forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [doc])

  /* ---------------- stamps ---------------- */

  const byId = useMemo(() => new Map(stamps.map((s) => [s.id, s])), [stamps])
  const aspects = useMemo(() => {
    const m = new Map<string, { aspect: number; widthMm: number }>()
    for (const s of stamps) {
      const b = buildStampSvg(s)
      m.set(s.id, { aspect: b.width / b.height, widthMm: b.widthMm })
    }
    return m
  }, [stamps])

  const previewCtx: StampContext = useMemo(() => {
    const ref = peekRef()
    return {
      date: new Date(),
      ref,
      // Same length as a real record id, so the preview QR has the real density.
      qrText: verifyUrlFor("preview00000"),
    }
    // A new reference is reserved after each export, so refresh with the result.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc, result])

  function defaultWidth(stamp: StampDesign, page: PageInfo) {
    const a = aspects.get(stamp.id)
    if (!doc || !a) return 0.3
    if (doc.kind === "image") return stamp.showQR ? 0.4 : 0.28
    const pageMm = (page.widthPt / 72) * 25.4
    return clamp(a.widthMm / pageMm, 0.08, 0.75)
  }

  function addPlacement(stampId: string, page: number, at?: { x: number; y: number }) {
    const stamp = byId.get(stampId)
    if (!stamp || !doc) return
    const info = doc.pages[page]
    const w = defaultWidth(stamp, info)
    const aspect = aspects.get(stampId)?.aspect ?? 1
    const hFrac = (w / aspect) * (info.widthPt / info.heightPt)
    // Offset repeated adds on the same page so stamps don't stack exactly.
    // Further stamps on the same page line up to the left, then wrap upwards.
    const already = placements.filter((p) => p.page === page).length
    const perRow = Math.max(1, Math.floor(0.86 / (w + 0.03)))
    const col = already % perRow
    const row = Math.floor(already / perRow)
    const x = at?.x ?? 1 - w / 2 - 0.07 - col * (w + 0.03)
    const y = at?.y ?? 1 - hFrac / 2 - 0.08 - row * (hFrac + 0.03)
    const p: Placement = {
      id: nanoid(8),
      stampId,
      page,
      x: clamp(x, w / 2, 1 - w / 2),
      y: clamp(y, hFrac / 2, 1 - hFrac / 2),
      w,
      rot: 0,
    }
    setPlacements((ps) => [...ps, p])
    setSelected(p.id)
    setFresh(p.id)
    setActiveStamp(stampId)
  }

  function update(id: string, patch: Partial<Placement>) {
    setPlacements((ps) => ps.map((p) => (p.id === id ? { ...p, ...patch } : p)))
  }
  function remove(id: string) {
    setPlacements((ps) => ps.filter((p) => p.id !== id))
    setSelected((s) => (s === id ? null : s))
  }
  function copyToAllPages(id: string) {
    const src = placements.find((p) => p.id === id)
    if (!src || !doc) return
    const add: Placement[] = []
    for (let i = 0; i < doc.pages.length; i++) {
      if (i === src.page) continue
      if (placements.some((p) => p.page === i && p.stampId === src.stampId)) continue
      add.push({ ...src, id: nanoid(8), page: i })
    }
    setPlacements((ps) => [...ps, ...add])
    toast.success(add.length ? `Added to ${add.length} more ${add.length === 1 ? "page" : "pages"}` : "Every page already has this stamp")
  }

  async function runExport() {
    if (!doc || !placements.length) return
    setExporting(true)
    try {
      const res = await exportStamped({
        file: doc.file,
        bytes: doc.bytes,
        kind: doc.kind,
        pages: doc.pageCount,
        placements,
        stamps,
        imageFormat,
        pdf: doc.pdf,
        imageUrl: doc.imageUrl,
        docxLastPage: doc.pages.length - 1,
      })
      const { download } = await import("@/lib/documents")
      setResult(res)
      await download(res.bytes, res.name, res.mime)
    } catch (e) {
      console.error(e)
      const gated = stamps.find((s) => s.requiresApproval && placements.some((p) => p.stampId === s.id))
      const needsApproval = String((e as { message?: string })?.message).includes("approval_required")
      toast.error(needsApproval ? "This stamp needs approval" : "Couldn't create the stamped file", {
        description: friendlyError(e),
        ...(needsApproval && gated
          ? {
              action: {
                label: "Request approval",
                onClick: () => {
                  setPendingFile(doc.file)
                  router.push(`/approvals?request=${gated.id}`)
                },
              },
            }
          : {}),
      })
    } finally {
      setExporting(false)
    }
  }

  function reset() {
    doc?.cleanup()
    setDoc(null)
    setPlacements([])
    setSelected(null)
    setResult(null)
    setStatus({ s: "idle" })
  }

  /* ---------------- render ---------------- */

  if (!ready) return <WorkspaceSkeleton />

  const sel = placements.find((p) => p.id === selected) ?? null
  const selStamp = sel ? byId.get(sel.stampId) : undefined
  const outLabel = doc?.kind === "docx" ? "Word file" : doc?.kind === "image" && imageFormat === "png" ? "PNG" : "PDF"

  if (!doc) {
    return (
      <Fade>
        <Page className="max-w-[1180px]">
          <PageHeader
            title="Stamp a document"
            description="Choose the file, place your stamp, download. Everything happens in your browser."
          />
          <div className="mt-8 grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div>
              {status.s === "loading" ? (
                <LoadingFile name={status.name} />
              ) : (
                <>
                  <DropZone onFile={open} />
                  {status.s === "error" && (
                    <div role="alert" className="mt-3 flex items-start gap-3 rounded-xl border border-destructive/25 bg-destructive/10 p-3.5 text-[13.5px]">
                      <FileWarning className="mt-0.5 size-4 shrink-0 text-destructive" />
                      <span className="text-foreground/90">{status.message}</span>
                    </div>
                  )}
                </>
              )}
            </div>
            <StampPicker stamps={stamps} active={activeStamp} onPick={setActiveStamp} hint="Pick the stamp to start with. You can add more on the document." />
          </div>
        </Page>
      </Fade>
    )
  }

  return (
    <Fade>
      <div className="mx-auto w-full max-w-[1480px] px-4 pt-5 pb-28 sm:px-6 lg:pb-12">
        {/* Toolbar */}
        <div className="sticky top-14 z-20 -mx-4 mb-5 border-b border-border bg-background/85 px-4 py-3 backdrop-blur-xl backdrop-saturate-150 sm:-mx-6 sm:px-6 md:top-0">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={reset}
              className="press grid size-9 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-white/5 hover:text-foreground"
              aria-label="Close this document"
            >
              <ArrowLeft className="size-4" />
            </button>
            <DocIcon kind={doc.kind} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14.5px] font-semibold">{doc.file.name}</p>
              <p className="tnum truncate text-[12.5px] text-faint">
                {kindLabel(doc.kind)} · {doc.pageCount} {doc.pageCount === 1 ? "page" : "pages"} · {formatBytes(doc.file.size)}
              </p>
            </div>
            <span className="hidden items-center gap-1.5 text-[12.5px] text-faint md:flex">
              <Lock className="size-3.5" /> Not uploaded
            </span>
            <Button variant="outline" className="hidden sm:inline-flex" onClick={reset}>
              <RefreshCw /> Change file
            </Button>
            <Button onClick={runExport} disabled={!placements.length || exporting} className="hidden sm:inline-flex">
              {exporting ? <Loader2 className="animate-spin" /> : <Download />}
              {exporting ? "Stamping…" : `Download ${outLabel}`}
            </Button>
          </div>
        </div>

        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
          {/* Pages */}
          <div className="flex gap-4">
            {doc.pages.length > 2 && (
              <nav aria-label="Pages" className="sticky top-24 hidden max-h-[calc(100dvh-8rem)] w-14 shrink-0 flex-col gap-1.5 overflow-y-auto pr-1 xl:flex">
                {doc.pages.map((_, i) => {
                  const n = placements.filter((p) => p.page === i).length
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => pagesRef.current?.querySelector(`[data-page="${i}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" })}
                      className={cn(
                        "tnum relative h-10 shrink-0 rounded-lg border text-[12.5px] font-semibold transition-colors duration-150",
                        currentPage === i ? "border-ink/60 bg-ink/15 text-foreground" : "border-white/[0.07] text-faint hover:text-foreground",
                      )}
                      aria-current={currentPage === i ? "page" : undefined}
                    >
                      {i + 1}
                      {n > 0 && <span className="absolute -top-1 -right-1 size-2.5 rounded-full bg-ink ring-2 ring-background" aria-label={`${n} stamps`} />}
                    </button>
                  )
                })}
              </nav>
            )}
            <div ref={pagesRef} className="mx-auto w-full max-w-[820px] min-w-0 space-y-8">
              {doc.kind === "docx" && (
                <p className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3 text-[13px] leading-relaxed text-muted-foreground">
                  Word decides where pages break, so stamps go on the <strong className="text-foreground">first</strong>
                  {doc.pages.length > 1 && (
                    <>
                      {" "}or <strong className="text-foreground">last</strong>
                    </>
                  )}{" "}
                  page and the file stays a .docx. The preview is close to, but not exactly, how Word lays it out.
                </p>
              )}
              {doc.pages.map((info, i) => (
                <PageFrame
                  key={i}
                  index={i}
                  label={doc.labels[i]}
                  info={info}
                  source={doc.sources[i]}
                  active={currentPage === i && doc.pages.length > 1}
                  onActivate={() => setCurrentPage(i)}
                  onBackgroundClick={() => setSelected(null)}
                  onDropStamp={(id, x, y) => addPlacement(id, i, { x, y })}
                >
                  {placements
                    .filter((p) => p.page === i)
                    .map((p) => {
                      const d = byId.get(p.stampId)
                      if (!d) return null
                      return (
                        <PlacementBox
                          key={p.id}
                          placement={p}
                          design={d}
                          ctx={previewCtx}
                          aspect={aspects.get(d.id)?.aspect ?? 1}
                          pageAspect={info.widthPt / info.heightPt}
                          selected={selected === p.id}
                          fresh={fresh === p.id}
                          onSelect={() => {
                            setSelected(p.id)
                            setCurrentPage(i)
                          }}
                          onChange={(patch) => update(p.id, patch)}
                          onRemove={() => remove(p.id)}
                        />
                      )
                    })}
                  {placements.every((p) => p.page !== i) && i === currentPage && activeStamp && (
                    <button
                      type="button"
                      onClick={() => addPlacement(activeStamp, i)}
                      className="press absolute right-3 bottom-3 inline-flex h-9 items-center gap-2 rounded-full bg-[#141416]/90 px-3.5 text-[13px] font-semibold text-white shadow-lg ring-1 ring-white/10 backdrop-blur hover:bg-[#141416]"
                    >
                      <MousePointerClick className="size-4" /> Stamp this page
                    </button>
                  )}
                </PageFrame>
              ))}
            </div>
          </div>

          {/* Inspector */}
          <aside className="space-y-4 lg:sticky lg:top-24 lg:max-h-[calc(100dvh-7rem)] lg:overflow-y-auto lg:pb-2 [scrollbar-gutter:stable]">
            <StampPicker
              stamps={stamps}
              active={activeStamp}
              onPick={(id) => addPlacement(id, currentPage)}
              hint={`Click to add to ${doc.pages.length > 1 ? doc.short[currentPage].toLowerCase() : doc.kind === "image" ? "the image" : "the page"}, or drag onto ${doc.pages.length > 1 ? "any page" : "it"}.`}
              draggable
            />

            {sel && selStamp && (
              <Panel className="space-y-4 p-4">
                <div className="flex items-center gap-2">
                  <InkDot ink={selStamp.ink} />
                  <p className="min-w-0 flex-1 truncate text-[14px] font-semibold">{selStamp.name}</p>
                  <span className="tnum text-[12px] text-faint">{doc.short[sel.page]}</span>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-[13px] text-muted-foreground">
                    <span>Size</span>
                    <span className="tnum font-semibold text-foreground">
                      {doc.kind === "image" ? `${Math.round(sel.w * 100)}% of width` : `${Math.round(sel.w * (doc.pages[sel.page].widthPt / 72) * 25.4)} mm`}
                    </span>
                  </div>
                  <Slider value={[sel.w * 100]} min={5} max={95} step={0.5} onValueChange={(v) => update(sel.id, { w: (Array.isArray(v) ? v[0] : v) / 100 })} aria-label="Stamp size" />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[13px] text-muted-foreground">
                    <span>Rotation</span>
                    <span className="flex items-center gap-1.5">
                      <span className="tnum font-semibold text-foreground">{sel.rot}°</span>
                      {sel.rot !== 0 && (
                        <button type="button" onClick={() => update(sel.id, { rot: 0 })} className="press grid size-6 place-items-center rounded-md text-faint hover:text-foreground" aria-label="Reset rotation">
                          <RotateCcw className="size-3.5" />
                        </button>
                      )}
                    </span>
                  </div>
                  <Slider value={[sel.rot]} min={-180} max={180} step={1} onValueChange={(v) => update(sel.id, { rot: Array.isArray(v) ? v[0] : v })} aria-label="Stamp rotation" />
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  {doc.pages.length > 1 && (
                    <Button variant="outline" size="sm" onClick={() => copyToAllPages(sel.id)}>
                      <CopyPlus /> {doc.kind === "docx" ? "Also on other page" : "Copy to all pages"}
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={() => addPlacement(sel.stampId, sel.page)}>
                    <Copy /> Duplicate
                  </Button>
                  <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => remove(sel.id)}>
                    <Trash2 /> Remove
                  </Button>
                </div>
                <p className="text-[12px] leading-relaxed text-faint">
                  Tip: drag to move, use the corner to resize, the top handle to rotate (hold Shift for 15° steps). Arrow keys nudge.
                </p>
              </Panel>
            )}

            <Panel className="space-y-4 p-4">
              {doc.kind === "image" && (
                <div className="space-y-2">
                  <p className="text-[13px] font-medium text-muted-foreground">Download as</p>
                  <Segmented
                    label="Output format"
                    value={imageFormat}
                    onChange={setImageFormat}
                    options={[
                      { value: "pdf", label: "PDF" },
                      { value: "png", label: "PNG image" },
                    ]}
                  />
                </div>
              )}
              <dl className="space-y-2 text-[13px]">
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Stamps placed</dt>
                  <dd className="tnum font-semibold">
                    {placements.length}
                    {placements.length > 0 && doc.pages.length > 1 && (
                      <span className="font-normal text-faint">
                        {" "}
                        on {new Set(placements.map((p) => p.page)).size} {new Set(placements.map((p) => p.page)).size === 1 ? "page" : "pages"}
                      </span>
                    )}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Reference</dt>
                  <dd className="tnum font-semibold">{previewCtx.ref}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">You get</dt>
                  <dd className="font-semibold">{doc.file.name.replace(/\.[^.]+$/, "")}-stamped.{doc.kind === "docx" ? "docx" : doc.kind === "image" && imageFormat === "png" ? "png" : "pdf"}</dd>
                </div>
              </dl>
              <Button size="lg" className="w-full" onClick={runExport} disabled={!placements.length || exporting}>
                {exporting ? <Loader2 className="animate-spin" /> : <Download />}
                {exporting ? "Stamping…" : placements.length ? `Download stamped ${outLabel}` : "Add a stamp to continue"}
              </Button>
            </Panel>
          </aside>
        </div>

        {/* Mobile action bar */}
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/90 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-xl sm:hidden">
          <Button size="lg" className="w-full" onClick={runExport} disabled={!placements.length || exporting}>
            {exporting ? <Loader2 className="animate-spin" /> : <Download />}
            {exporting ? "Stamping…" : placements.length ? `Download stamped ${outLabel}` : "Add a stamp to continue"}
          </Button>
        </div>

        <SuccessDialog
          result={result}
          onClose={() => setResult(null)}
          onAnother={reset}
        />
      </div>
    </Fade>
  )
}

/* ------------------------------------------------------------------ */

function StampPicker({
  stamps,
  active,
  onPick,
  hint,
  draggable,
}: {
  stamps: StampDesign[]
  active: string | null
  onPick: (id: string) => void
  hint: string
  draggable?: boolean
}) {
  return (
    <Panel className="overflow-hidden">
      <div className="flex items-center justify-between px-4 pt-4">
        <h2 className="text-[15px] font-semibold">Your stamps</h2>
        <Link href="/stamps/new" className="press rounded-md text-[13px] font-semibold text-muted-foreground hover:text-foreground">
          New stamp
        </Link>
      </div>
      <p className="px-4 pt-1 text-[12.5px] leading-relaxed text-faint">{hint}</p>
      {stamps.length === 0 ? (
        <div className="p-4">
          <Button variant="outline" className="w-full" nativeButton={false} render={<Link href="/stamps/new" />}>
            Design a stamp first
          </Button>
        </div>
      ) : (
        <ul className="max-h-[300px] space-y-1 overflow-y-auto p-2 lg:max-h-[min(300px,32dvh)]">
          {stamps.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                draggable={draggable}
                onDragStart={(e) => {
                  e.dataTransfer.setData(STAMP_MIME, s.id)
                  e.dataTransfer.effectAllowed = "copy"
                }}
                onClick={() => onPick(s.id)}
                className={cn(
                  "press flex w-full items-center gap-3 rounded-xl border p-2 text-left transition-colors duration-150",
                  active === s.id ? "border-ink/50 bg-ink/[0.09]" : "border-transparent hover:bg-white/[0.04]",
                )}
                aria-pressed={active === s.id}
              >
                <PaperSheet className="w-[68px] shrink-0 rounded-md">
                  <div className="flex aspect-[4/3] items-center justify-center p-1.5">
                    <StampView design={{ ...s, showQR: false }} className="max-h-full w-full mix-blend-multiply" />
                  </div>
                </PaperSheet>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-semibold">{s.name}</span>
                  <span className="mt-0.5 flex items-center gap-1.5 truncate text-[12.5px] text-faint">
                    <InkDot ink={s.ink} className="size-2" /> {s.label}
                    {s.showQR && " · QR"}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

function LoadingFile({ name }: { name: string }) {
  return (
    <div className="flex min-h-[260px] flex-col items-center justify-center gap-5 rounded-2xl border border-white/[0.08] p-8" role="status" aria-live="polite">
      <div className="w-[150px]">
        <PageRenderSkeleton ratio={0.707} />
      </div>
      <div className="flex flex-col items-center gap-2">
        <p className="max-w-[40ch] truncate text-[14.5px] font-semibold">Opening {name}</p>
        <Skeleton className="h-1.5 w-40 rounded-full" />
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------- DOCX */

async function openDocx(file: File, bytes: ArrayBuffer): Promise<Loaded> {
  const [{ renderAsync }, sizes] = await Promise.all([import("docx-preview"), docxPageSizes(bytes)])
  const holder = document.createElement("div")
  holder.setAttribute("aria-hidden", "true")
  holder.style.cssText = "position:fixed;left:-100000px;top:0;pointer-events:none;"
  document.body.appendChild(holder)
  await renderAsync(new Blob([bytes]), holder, holder, {
    className: "docx",
    inWrapper: false,
    breakPages: true,
    ignoreLastRenderedPageBreak: false,
    renderHeaders: true,
    renderFooters: true,
    experimental: true,
    useBase64URL: true,
  })
  const sections = Array.from(holder.querySelectorAll<HTMLElement>("section.docx"))
  if (!sections.length) throw new Error("No pages rendered")
  for (const s of sections) {
    s.style.margin = "0"
    s.style.boxShadow = "none"
  }
  const ptToPx = (pt: number) => (pt * 96) / 72
  const first = sections[0]
  const last = sections[sections.length - 1]
  const pages: PageInfo[] = [sizes.first]
  const sources: PageSource[] = [{ kind: "docx", node: first, widthPx: ptToPx(sizes.first.widthPt) }]
  const labels = [sections.length > 1 ? `First page · 1 of ${sections.length}` : "Page 1"]
  const short = [sections.length > 1 ? "First page" : "Page 1"]
  if (sections.length > 1) {
    pages.push(sizes.last)
    sources.push({ kind: "docx", node: last, widthPx: ptToPx(sizes.last.widthPt) })
    labels.push(`Last page · ${sections.length} of ${sections.length}`)
    short.push("Last page")
  }
  return {
    file,
    bytes,
    kind: "docx",
    pages,
    pageCount: sections.length,
    sources,
    labels,
    short,
    cleanup: () => holder.remove(),
  }
}
