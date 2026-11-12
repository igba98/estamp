"use client"

import Link from "next/link"
import { useRef, useState } from "react"
import { toast } from "sonner"
import { CircleAlert, CircleCheck, Download, FileUp, LoaderCircle, Lock, X } from "lucide-react"
import { Page, PageHeader, Panel } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Fade } from "@/components/docs/doc-bits"
import { ListSkeleton } from "@/components/skeletons"
import { Segmented } from "@/components/designer/segmented"
import { InkDot } from "@/components/stamp/stamp-tiles"
import { exportStamped, type ExportResult } from "@/components/workspace/export"
import { detectKind, download, formatBytes, imageInfo, MAX_BYTES, openPdf, type PageInfo } from "@/lib/documents"
import { cornerPlacement, type Corner } from "@/lib/placement"
import { buildStampSvg } from "@/lib/stamp-svg"
import { isAdmin, useAppState } from "@/lib/store"
import { friendlyError } from "@/lib/supabase"
import type { StampDesign } from "@/lib/types"
import { cn } from "@/lib/utils"

type PageChoice = "first" | "last" | "all"
type Item = {
  key: string
  file: File
  state: "waiting" | "working" | "done" | "failed"
  result?: ExportResult
  error?: string
}

// shortcut: whole batch is kept in memory for the ZIP; raise or stream when offices need more than 50 files.
const MAX_FILES = 50

// Laid out as on the page: top row first.
const CORNER_GRID: { value: Corner; label: string }[] = [
  { value: "tl", label: "Top left" },
  { value: "tr", label: "Top right" },
  { value: "bl", label: "Bottom left" },
  { value: "br", label: "Bottom right" },
]

const PAGES: { value: PageChoice; label: string }[] = [
  { value: "first", label: "First page" },
  { value: "last", label: "Last page" },
  { value: "all", label: "Every page" },
]

/** Stamp one PDF or image with one stamp in a corner, through the normal record → file → fingerprint flow. */
async function stampOne(file: File, stamp: StampDesign, corner: Corner, pages: PageChoice) {
  const kind = detectKind(file)
  if (!kind) throw new Error("Not a PDF or image.")
  if (kind === "docx") throw new Error("Word files need the single-document screen, where you can see the page.")
  if (file.size > MAX_BYTES) throw new Error(`Over ${formatBytes(MAX_BYTES)}.`)
  const bytes = await file.arrayBuffer()
  const art = buildStampSvg(stamp)
  let info: PageInfo[]
  let cleanup = () => {}
  let pdf: Awaited<ReturnType<typeof openPdf>>["doc"] | undefined
  let imageUrl: string | undefined
  if (kind === "pdf") {
    const opened = await openPdf(bytes)
    pdf = opened.doc
    info = opened.pages
    cleanup = () => void opened.doc.loadingTask.destroy()
  } else {
    const img = await imageInfo(file)
    imageUrl = img.url
    info = [{ widthPt: img.width * 0.75, heightPt: img.height * 0.75 }]
    cleanup = () => URL.revokeObjectURL(img.url)
  }
  try {
    const targets = pages === "all" ? info.map((_, i) => i) : [pages === "first" ? 0 : info.length - 1]
    const placements = targets.map((page) =>
      cornerPlacement({
        id: `${page}`,
        stampId: stamp.id,
        page,
        info: info[page],
        widthMm: art.widthMm,
        aspect: art.width / art.height,
        image: kind === "image",
        showQR: stamp.showQR,
        corner,
      }),
    )
    return await exportStamped({
      file,
      bytes,
      kind,
      pages: info.length,
      placements,
      stamps: [stamp],
      imageFormat: "pdf",
      pdf,
      imageUrl,
      docxLastPage: 0,
    })
  } finally {
    cleanup()
  }
}

export function Bulk() {
  const ready = useAppState((s) => s.ready)
  const stamps = useAppState((s) => s.stamps)
  const admin = useAppState(isAdmin)
  const [stampId, setStampId] = useState<string | null>(null)
  const [corner, setCorner] = useState<Corner>("br")
  const [pages, setPages] = useState<PageChoice>("first")
  const [items, setItems] = useState<Item[]>([])
  const [running, setRunning] = useState(false)
  const [over, setOver] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  if (!ready) return <ListSkeleton />

  const stamp = stamps.find((s) => s.id === stampId) ?? stamps[0]
  const gated = !!stamp?.requiresApproval && !admin
  const waiting = items.filter((i) => i.state === "waiting" || i.state === "failed")
  const done = items.filter((i) => i.state === "done")

  function add(files: FileList | File[]) {
    const all = Array.from(files)
    const list = all.filter((f) => {
      const k = detectKind(f)
      return k === "pdf" || k === "image"
    })
    const words = all.filter((f) => detectKind(f) === "docx").length
    const skipped = all.length - list.length - words
    setItems((cur) => {
      const room = MAX_FILES - cur.length
      if (list.length > room) toast.error(`Up to ${MAX_FILES} files per batch. ${list.length - Math.max(0, room)} not added.`)
      return [...cur, ...list.slice(0, Math.max(0, room)).map((file) => ({ key: crypto.randomUUID(), file, state: "waiting" as const }))]
    })
    if (words) toast.error(`${words} Word ${words === 1 ? "file" : "files"} skipped: stamp ${words === 1 ? "it" : "them"} one at a time under Stamp a document.`)
    if (skipped) toast.error(`${skipped} ${skipped === 1 ? "file isn't" : "files aren't"} a PDF or image.`)
  }

  function patch(key: string, p: Partial<Item>) {
    setItems((cur) => cur.map((i) => (i.key === key ? { ...i, ...p } : i)))
  }

  async function run() {
    if (!stamp) return
    setRunning(true)
    // One at a time: each file renders pages and uploads; parallel runs would exhaust memory on phones.
    for (const item of waiting) {
      patch(item.key, { state: "working", error: undefined })
      try {
        const result = await stampOne(item.file, stamp, corner, pages)
        patch(item.key, { state: "done", result })
      } catch (e) {
        patch(item.key, { state: "failed", error: friendlyError(e) })
      }
    }
    setRunning(false)
  }

  async function downloadZip() {
    const JSZip = (await import("jszip")).default
    const zip = new JSZip()
    const used = new Set<string>()
    for (const i of done) {
      const r = i.result!
      let name = r.name
      for (let n = 2; used.has(name); n++) name = r.name.replace(/(\.[^.]+)?$/, ` (${n})$1`)
      used.add(name)
      zip.file(name, r.bytes)
    }
    const bytes = await zip.generateAsync({ type: "uint8array" })
    await download(bytes, `stamped-${new Date().toISOString().slice(0, 10)}.zip`, "application/zip")
  }

  return (
    <Fade>
      <Page className="max-w-[1100px]">
        <PageHeader
          title="Bulk stamping"
          description="Stamp a batch of PDFs or images with one stamp in the same place. Each file gets its own reference number, verify record and saved copy."
        />

        <div className="mt-8 grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          <Panel
            className={cn("flex min-h-[320px] flex-col overflow-hidden transition-[border-color] duration-150", over && "border-white/25")}
            onDragOver={(e) => {
              e.preventDefault()
              setOver(true)
            }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => {
              e.preventDefault()
              setOver(false)
              if (!running) add(e.dataTransfer.files)
            }}
          >
            {items.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 text-center">
                <span className="grid size-12 place-items-center rounded-2xl border border-white/[0.08] bg-white/[0.03]">
                  <FileUp className="size-5 text-muted-foreground" />
                </span>
                <p className="mt-4 text-[16px] font-semibold">Drop files here</p>
                <p className="mt-1 max-w-[42ch] text-[13.5px] text-muted-foreground">PDFs and images, up to {MAX_FILES} at a time. Word files go through Stamp a document.</p>
                <Button className="mt-5" onClick={() => input.current?.click()}>
                  Choose files
                </Button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between gap-3 border-b border-white/[0.05] px-5 py-3">
                  <p className="text-[13.5px] text-muted-foreground">
                    <span className="tnum font-semibold text-foreground">{items.length}</span> {items.length === 1 ? "file" : "files"}
                    {done.length > 0 && (
                      <>
                        {" "}· <span className="tnum">{done.length}</span> stamped
                      </>
                    )}
                  </p>
                  <div className="flex gap-1">
                    <Button variant="ghost" disabled={running} onClick={() => input.current?.click()}>
                      Add files
                    </Button>
                    <Button variant="ghost" disabled={running} onClick={() => setItems([])}>
                      Clear
                    </Button>
                  </div>
                </div>
                <ul className="max-h-[480px] flex-1 divide-y divide-white/[0.05] overflow-y-auto">
                  {items.map((i) => (
                    <li key={i.key} className="flex items-center gap-3 px-5 py-3">
                      <StatusIcon state={i.state} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14px] font-medium">{i.file.name}</p>
                        <p className={cn("truncate text-[12.5px]", i.state === "failed" ? "text-destructive" : "text-faint")}>
                          {i.state === "done"
                            ? `${i.result!.doc.ref}${i.result!.registerNo ? ` · ${i.result!.registerNo}` : ""}${i.result!.synced ? "" : " · not saved online"}`
                            : i.state === "failed"
                              ? i.error
                              : formatBytes(i.file.size)}
                        </p>
                      </div>
                      {i.state === "waiting" && !running && (
                        <button
                          type="button"
                          onClick={() => setItems((cur) => cur.filter((x) => x.key !== i.key))}
                          className="press grid size-9 shrink-0 place-items-center rounded-lg text-faint hover:bg-white/5 hover:text-foreground"
                          aria-label={`Remove ${i.file.name}`}
                        >
                          <X className="size-4" />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </>
            )}
            <input
              ref={input}
              type="file"
              multiple
              accept="application/pdf,.pdf,image/png,image/jpeg,image/webp"
              className="sr-only"
              tabIndex={-1}
              onChange={(e) => {
                if (e.target.files) add(e.target.files)
                e.target.value = ""
              }}
            />
          </Panel>

          <Panel className="h-fit space-y-5 p-5">
            <fieldset>
              <legend className="mb-2 text-[13.5px] font-medium">Stamp</legend>
              <div className="grid max-h-[240px] gap-1.5 overflow-y-auto">
                {stamps.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    aria-pressed={stamp?.id === s.id}
                    disabled={running}
                    onClick={() => setStampId(s.id)}
                    className={cn(
                      "press flex items-center gap-2.5 rounded-xl border px-3 py-2 text-left text-[13.5px] transition-[background-color,border-color] duration-150",
                      stamp?.id === s.id ? "border-white/25 bg-white/[0.06]" : "border-white/[0.07] hover:bg-white/[0.03]",
                    )}
                  >
                    <InkDot ink={s.ink} />
                    <span className="min-w-0 flex-1 truncate font-medium">{s.name}</span>
                    {s.requiresApproval && <Lock className="size-3.5 shrink-0 text-faint" aria-label="Needs approval" />}
                  </button>
                ))}
              </div>
            </fieldset>
            <div>
              <p className="mb-2 text-[13.5px] font-medium">Position</p>
              <div role="radiogroup" aria-label="Stamp position" className="grid grid-cols-2 gap-1.5">
                {CORNER_GRID.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    role="radio"
                    aria-checked={corner === c.value}
                    disabled={running}
                    onClick={() => setCorner(c.value)}
                    className={cn(
                      "press h-9 rounded-[10px] border text-[13px] font-medium transition-[background-color,border-color] duration-150",
                      corner === c.value ? "border-white/25 bg-white/[0.06]" : "border-white/[0.07] text-muted-foreground hover:bg-white/[0.03]",
                    )}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-[12px] text-faint">At the stamp&apos;s real size, like the first stamp you place by hand.</p>
            </div>
            <div>
              <p className="mb-2 text-[13.5px] font-medium">Pages</p>
              <Segmented label="Pages to stamp" value={pages} onChange={setPages} options={PAGES} />
            </div>
            {gated && (
              <p className="flex items-start gap-2 rounded-xl border border-warn/25 bg-warn/10 p-3 text-[12.5px] leading-relaxed text-muted-foreground">
                <Lock className="mt-0.5 size-3.5 shrink-0 text-warn" />
                <span>
                  {stamp!.name} needs an admin&apos;s approval for each file. Request it under{" "}
                  <Link href="/approvals" className="font-semibold text-foreground underline decoration-white/20">
                    Approvals
                  </Link>
                  .
                </span>
              </p>
            )}
            <div className="grid gap-2">
              <Button size="lg" disabled={running || !waiting.length || !stamp || gated} onClick={() => void run()}>
                {running ? (
                  <>
                    <LoaderCircle className="animate-spin" /> Stamping {done.length + 1} of {items.length}…
                  </>
                ) : (
                  waiting.length ? `Stamp ${waiting.length} ${waiting.length === 1 ? "file" : "files"}` : "Stamp files"
                )}
              </Button>
              {done.length > 0 && !running && (
                <Button variant="outline" size="lg" onClick={() => void downloadZip()}>
                  <Download /> Download {done.length} as ZIP
                </Button>
              )}
            </div>
          </Panel>
        </div>
      </Page>
    </Fade>
  )
}

function StatusIcon({ state }: { state: Item["state"] }) {
  if (state === "done") return <CircleCheck className="size-5 shrink-0 text-ok" aria-label="Stamped" />
  if (state === "failed") return <CircleAlert className="size-5 shrink-0 text-destructive" aria-label="Failed" />
  if (state === "working") return <LoaderCircle className="size-5 shrink-0 animate-spin text-muted-foreground" aria-label="Stamping" />
  return <span className="grid size-5 shrink-0 place-items-center" aria-label="Waiting"><span className="size-2 rounded-full bg-white/20" /></span>
}
