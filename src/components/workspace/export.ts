"use client"

import type { PDFDocumentProxy } from "pdfjs-dist"
import {
  drawPlacements,
  imageToStampedPdf,
  loadImage,
  stampDocx,
  stampImagePng,
  stampPdf,
  stampedName,
  type Placement,
  type StampImage,
} from "@/lib/documents"
import { buildStampSvg, stampToPng } from "@/lib/stamp-svg"
import { completeStamp, discardStamp, issueStamp } from "@/lib/store"
import type { DocKind, StampDesign, StampedDoc } from "@/lib/types"
import { sha256Hex, verifyUrlFor } from "@/lib/verify"

export type ExportInput = {
  file: File
  bytes: ArrayBuffer
  kind: DocKind
  pages: number
  placements: Placement[]
  stamps: StampDesign[]
  imageFormat: "pdf" | "png"
  pdf?: PDFDocumentProxy
  imageUrl?: string
  docxLastPage: number
}

export type ExportResult = {
  bytes: Uint8Array
  name: string
  mime: string
  doc: StampedDoc
  registerNo: string | null
  /** Saved online and fingerprinted for the verify page. */
  synced: boolean
}

const MIME = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  png: "image/png",
} as const

export async function exportStamped(input: ExportInput): Promise<ExportResult> {
  const { file, bytes, kind, placements } = input
  const used = Array.from(new Set(placements.map((p) => p.stampId)))
  const designs = used.map((id) => input.stamps.find((s) => s.id === id)).filter(Boolean) as StampDesign[]
  if (!designs.length) throw new Error("Add at least one stamp to the document first.")

  // The record (and its reference number) exists before the file, so the QR can point at it.
  const originalHash = await sha256Hex(bytes)
  const issued = await issueStamp({
    stampIds: used,
    fileName: file.name,
    kind,
    pages: input.pages,
    sizeBytes: file.size,
    originalHash,
  })
  const now = new Date(issued.stamped_at)
  const ref = issued.ref
  const url = verifyUrlFor(issued.id)

  // Render each stamp once, at ~300 dpi for its physical size.
  const images = new Map<string, StampImage>()
  for (const d of designs) {
    const s = buildStampSvg(d, { date: now, ref, qrText: url, uid: `x${d.id}`, seed: Math.floor(Math.random() * 900) + 1 })
    const px = Math.round(Math.min(2000, Math.max(700, (s.widthMm / 25.4) * 300)))
    const png = await stampToPng(s, px)
    images.set(d.id, { bytes: png.bytes, w: png.w, h: png.h, url: URL.createObjectURL(png.blob) })
  }

  let result: ExportResult
  try {
    let out: Uint8Array
    let outKind: StampedDoc["outputKind"]
    if (kind === "pdf") {
      out = await stampPdf(bytes, placements, images)
      outKind = "pdf"
    } else if (kind === "docx") {
      out = await stampDocx(bytes, placements, images, input.docxLastPage)
      outKind = "docx"
    } else if (input.imageFormat === "png") {
      out = await stampImagePng(input.imageUrl!, placements, images)
      outKind = "png"
    } else {
      out = await imageToStampedPdf(file, input.imageUrl!, placements, images)
      outKind = "pdf"
    }

    const thumb = await makeThumb(input, images).catch(() => undefined)
    const name = stampedName(file.name, outKind)
    const doc: StampedDoc = {
      id: issued.id,
      fileName: file.name,
      outputName: name,
      kind,
      outputKind: outKind,
      pages: input.pages,
      stampNames: designs.map((d) => d.name),
      ink: designs[0].ink,
      ref,
      stampedAt: now.getTime(),
      sizeBytes: file.size,
      outputBytes: out.byteLength,
      originalHash,
      outputHash: await sha256Hex(out.slice().buffer),
      verifyUrl: url,
      thumb,
      labels: issued.labels,
      stampedBy: issued.stamped_by,
    }
    result = { bytes: out, name, mime: MIME[outKind], doc, registerNo: issued.register_no, synced: false }
  } catch (e) {
    void discardStamp(issued.id)
    throw e
  } finally {
    images.forEach((i) => URL.revokeObjectURL(i.url))
  }
  // The file is made; saving it online must not stop the download.
  const saved = await completeStamp(result.doc, used, result.bytes, result.mime, !!result.registerNo).catch(() => null)
  result.synced = Boolean(saved?.uploaded && saved.fingerprinted)
  return result
}

/** Small JPEG of the first stamped page, for the history list. */
async function makeThumb(input: ExportInput, images: Map<string, StampImage>) {
  const page = input.kind === "docx" ? -1 : Math.min(...input.placements.map((p) => p.page))
  if (page < 0) return undefined
  const W = 360
  const canvas = document.createElement("canvas")
  const ctx = canvas.getContext("2d")!
  if (input.kind === "pdf" && input.pdf) {
    const pg = await input.pdf.getPage(page + 1)
    const base = pg.getViewport({ scale: 1 })
    const vp = pg.getViewport({ scale: W / base.width })
    canvas.width = Math.round(vp.width)
    canvas.height = Math.round(vp.height)
    ctx.fillStyle = "#fff"
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    await pg.render({ canvas, canvasContext: ctx, viewport: vp }).promise
  } else if (input.imageUrl) {
    const img = await loadImage(input.imageUrl)
    canvas.width = W
    canvas.height = Math.round((img.naturalHeight / img.naturalWidth) * W)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  } else return undefined
  await drawPlacements(
    ctx,
    canvas.width,
    canvas.height,
    input.placements.filter((p) => p.page === page),
    images,
  )
  return canvas.toDataURL("image/jpeg", 0.72)
}
