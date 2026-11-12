"use client"

import type { PDFDocumentProxy } from "pdfjs-dist"
import type { DocKind } from "./types"

export type Placement = {
  id: string
  stampId: string
  /** Page index. For DOCX only the first (0) and last page are allowed. */
  page: number
  /** Centre of the stamp as a fraction of page width / height (top-left origin). */
  x: number
  y: number
  /** Stamp width as a fraction of page width. */
  w: number
  /** Clockwise degrees. */
  rot: number
}

export type PageInfo = {
  /** Displayed size in points (after the page's own rotation). */
  widthPt: number
  heightPt: number
}

export type StampImage = { bytes: Uint8Array; w: number; h: number; url: string }

export const ACCEPT =
  ".pdf,.docx,.png,.jpg,.jpeg,.webp,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/png,image/jpeg,image/webp"

export const MAX_BYTES = 40 * 1024 * 1024

export function detectKind(file: File): DocKind | null {
  const n = file.name.toLowerCase()
  if (file.type === "application/pdf" || n.endsWith(".pdf")) return "pdf"
  if (n.endsWith(".docx") || file.type.includes("wordprocessingml")) return "docx"
  if (/^image\/(png|jpe?g|webp)$/.test(file.type) || /\.(png|jpe?g|webp)$/.test(n)) return "image"
  return null
}

export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10240 ? 1 : 0)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

/* ------------------------------------------------------------------ PDF */

let pdfjsPromise: Promise<typeof import("pdfjs-dist")> | null = null
export function pdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import("pdfjs-dist").then((m) => {
      m.GlobalWorkerOptions.workerSrc = new URL(`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/pdf.worker.min.mjs`, window.location.origin).toString()
      return m
    })
  }
  return pdfjsPromise
}

export async function openPdf(bytes: ArrayBuffer) {
  const lib = await pdfjs()
  // pdf.js transfers the buffer to its worker, so give it a copy.
  const doc = await lib.getDocument({ data: new Uint8Array(bytes.slice(0)) }).promise
  const pages: PageInfo[] = []
  for (let i = 1; i <= doc.numPages; i++) {
    const p = await doc.getPage(i)
    const vp = p.getViewport({ scale: 1 })
    pages.push({ widthPt: vp.width, heightPt: vp.height })
  }
  return { doc, pages }
}

export async function renderPdfPage(doc: PDFDocumentProxy, index: number, canvas: HTMLCanvasElement, cssWidth: number) {
  const page = await doc.getPage(index + 1)
  const base = page.getViewport({ scale: 1 })
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  const scale = (cssWidth / base.width) * dpr
  const vp = page.getViewport({ scale })
  canvas.width = Math.floor(vp.width)
  canvas.height = Math.floor(vp.height)
  const task = page.render({ canvas, canvasContext: canvas.getContext("2d")!, viewport: vp })
  await task.promise
  return task
}

export async function stampPdf(bytes: ArrayBuffer, placements: Placement[], images: Map<string, StampImage>) {
  const { PDFDocument, degrees } = await import("pdf-lib")
  const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true })
  const embedded = new Map<string, Awaited<ReturnType<typeof pdf.embedPng>>>()
  for (const [id, img] of images) embedded.set(id, await pdf.embedPng(img.bytes))
  const pages = pdf.getPages()

  for (const pl of placements) {
    const page = pages[pl.page]
    const img = embedded.get(pl.stampId)
    const raw = images.get(pl.stampId)
    if (!page || !img || !raw) continue
    const box = page.getCropBox()
    const W = box.width
    const H = box.height
    const R = (((page.getRotation().angle % 360) + 360) % 360) as 0 | 90 | 180 | 270
    const Wd = R % 180 === 0 ? W : H
    const Hd = R % 180 === 0 ? H : W
    const xd = pl.x * Wd
    const yd = pl.y * Hd
    let X: number
    let Y: number
    if (R === 90) {
      X = yd
      Y = xd
    } else if (R === 180) {
      X = W - xd
      Y = yd
    } else if (R === 270) {
      X = W - yd
      Y = H - xd
    } else {
      X = xd
      Y = H - yd
    }
    X += box.x
    Y += box.y
    const w = pl.w * Wd
    const h = w * (raw.h / raw.w)
    const theta = R - pl.rot // pdf-lib rotates counter-clockwise
    const t = (theta * Math.PI) / 180
    const ox = (w / 2) * Math.cos(t) - (h / 2) * Math.sin(t)
    const oy = (w / 2) * Math.sin(t) + (h / 2) * Math.cos(t)
    page.drawImage(img, { x: X - ox, y: Y - oy, width: w, height: h, rotate: degrees(theta) })
  }
  pdf.setProducer("eStamp")
  pdf.setModificationDate(new Date())
  return pdf.save()
}

/* ---------------------------------------------------------------- IMAGE */

export async function loadImage(src: string) {
  const img = new Image()
  img.src = src
  await img.decode()
  return img
}

export async function imageInfo(file: File) {
  const url = URL.createObjectURL(file)
  const img = await loadImage(url)
  return { url, width: img.naturalWidth, height: img.naturalHeight }
}

/** Draw stamps onto an image and return a PNG. */
export async function stampImagePng(imageUrl: string, placements: Placement[], images: Map<string, StampImage>) {
  const base = await loadImage(imageUrl)
  const canvas = document.createElement("canvas")
  canvas.width = base.naturalWidth
  canvas.height = base.naturalHeight
  const ctx = canvas.getContext("2d")!
  ctx.drawImage(base, 0, 0)
  await drawPlacements(ctx, canvas.width, canvas.height, placements, images)
  const blob = await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("Could not export image"))), "image/png"))
  return new Uint8Array(await blob.arrayBuffer())
}

export async function drawPlacements(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  placements: Placement[],
  images: Map<string, StampImage>,
) {
  for (const pl of placements) {
    const raw = images.get(pl.stampId)
    if (!raw) continue
    const img = await loadImage(raw.url)
    const w = pl.w * W
    const h = w * (raw.h / raw.w)
    ctx.save()
    ctx.translate(pl.x * W, pl.y * H)
    ctx.rotate((pl.rot * Math.PI) / 180)
    ctx.drawImage(img, -w / 2, -h / 2, w, h)
    ctx.restore()
  }
}

/** Wrap an image as a one-page PDF (96 dpi → points), then stamp it. */
export async function imageToStampedPdf(file: File, imageUrl: string, placements: Placement[], images: Map<string, StampImage>) {
  const { PDFDocument } = await import("pdf-lib")
  const pdf = await PDFDocument.create()
  const img = await loadImage(imageUrl)
  let embedded
  if (file.type === "image/jpeg" || /\.jpe?g$/i.test(file.name)) {
    embedded = await pdf.embedJpg(new Uint8Array(await file.arrayBuffer()))
  } else {
    const c = document.createElement("canvas")
    c.width = img.naturalWidth
    c.height = img.naturalHeight
    c.getContext("2d")!.drawImage(img, 0, 0)
    const b = await new Promise<Blob>((res) => c.toBlob((x) => res(x!), "image/png"))
    embedded = await pdf.embedPng(new Uint8Array(await b.arrayBuffer()))
  }
  const W = img.naturalWidth * 0.75
  const H = img.naturalHeight * 0.75
  const page = pdf.addPage([W, H])
  page.drawImage(embedded, { x: 0, y: 0, width: W, height: H })
  const bytes = await pdf.save()
  return stampPdf(bytes.buffer as ArrayBuffer, placements.map((p) => ({ ...p, page: 0 })), images)
}

/* ----------------------------------------------------------------- DOCX */

const NS_WP = "http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
const NS_R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"

type SectSize = { w: number; h: number } // twips

function sectSizes(xml: string): SectSize[] {
  const out: SectSize[] = []
  const re = /<w:pgSz\b([^>]*)\/?>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(xml))) {
    const w = Number(/w:w="(\d+)"/.exec(m[1])?.[1] ?? 11906)
    const h = Number(/w:h="(\d+)"/.exec(m[1])?.[1] ?? 16838)
    const landscape = /w:orient="landscape"/.test(m[1])
    out.push(landscape && h > w ? { w: h, h: w } : { w, h })
  }
  if (!out.length) out.push({ w: 11906, h: 16838 })
  return out
}

export async function docxPageSizes(bytes: ArrayBuffer) {
  const JSZip = (await import("jszip")).default
  const zip = await JSZip.loadAsync(bytes)
  const xml = await zip.file("word/document.xml")?.async("string")
  if (!xml) throw new Error("This Word file has no document body.")
  const s = sectSizes(xml)
  const toPt = (t: SectSize) => ({ widthPt: t.w / 20, heightPt: t.h / 20 })
  return { first: toPt(s[0]), last: toPt(s[s.length - 1]) }
}

function anchorXml(o: { rid: string; id: number; x: number; y: number; cx: number; cy: number; rot: number }) {
  const rot = Math.round((((o.rot % 360) + 360) % 360) * 60000)
  return (
    `<w:r><w:drawing><wp:anchor distT="0" distB="0" distL="0" distR="0" simplePos="0" relativeHeight="${251660000 + o.id}" behindDoc="0" locked="0" layoutInCell="1" allowOverlap="1">` +
    `<wp:simplePos x="0" y="0"/>` +
    `<wp:positionH relativeFrom="page"><wp:posOffset>${Math.round(o.x)}</wp:posOffset></wp:positionH>` +
    `<wp:positionV relativeFrom="page"><wp:posOffset>${Math.round(o.y)}</wp:posOffset></wp:positionV>` +
    `<wp:extent cx="${Math.round(o.cx)}" cy="${Math.round(o.cy)}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:wrapNone/>` +
    `<wp:docPr id="${90000 + o.id}" name="eStamp ${o.id}" descr="Electronic stamp applied with eStamp"/>` +
    `<wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr>` +
    `<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
    `<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${90000 + o.id}" name="estamp-${o.id}.png"/><pic:cNvPicPr/></pic:nvPicPr>` +
    `<pic:blipFill><a:blip r:embed="${o.rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
    `<pic:spPr><a:xfrm rot="${rot}"><a:off x="0" y="0"/><a:ext cx="${Math.round(o.cx)}" cy="${Math.round(o.cy)}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>` +
    `</pic:pic></a:graphicData></a:graphic></wp:anchor></w:drawing></w:r>`
  )
}

/** Insert `run` into the first or last body paragraph. */
function insertRun(xml: string, run: string, where: "first" | "last") {
  const bodyStart = xml.indexOf("<w:body>")
  const bodyEnd = xml.lastIndexOf("</w:body>")
  if (bodyStart < 0 || bodyEnd < 0) throw new Error("Unexpected Word file structure.")
  const re = /<w:p(?:\s[^>]*)?(\/)?>/g
  re.lastIndex = bodyStart
  let target: RegExpExecArray | null = null
  let m: RegExpExecArray | null
  while ((m = re.exec(xml)) && m.index < bodyEnd) {
    target = m
    if (where === "first") break
  }
  if (!target) {
    // No paragraph at all: add one at the start of the body.
    const at = bodyStart + "<w:body>".length
    return xml.slice(0, at) + `<w:p>${run}</w:p>` + xml.slice(at)
  }
  const tag = target[0]
  if (target[1]) {
    // <w:p/> → <w:p>run</w:p>
    const open = tag.replace(/\/>$/, ">")
    return xml.slice(0, target.index) + open + run + "</w:p>" + xml.slice(target.index + tag.length)
  }
  const after = target.index + tag.length
  // Place the run after paragraph properties if present.
  const pPrClose = xml.indexOf("</w:pPr>", after)
  const pClose = xml.indexOf("</w:p>", after)
  const nextP = xml.slice(after).search(/<w:p[\s>/]/)
  const insertAt =
    pPrClose > -1 && pPrClose < pClose && (nextP < 0 || pPrClose < after + nextP) ? pPrClose + "</w:pPr>".length : after
  return xml.slice(0, insertAt) + run + xml.slice(insertAt)
}

export async function stampDocx(bytes: ArrayBuffer, placements: Placement[], images: Map<string, StampImage>, lastPage: number) {
  const JSZip = (await import("jszip")).default
  const zip = await JSZip.loadAsync(bytes)
  let xml = await zip.file("word/document.xml")!.async("string")
  const relsPath = "word/_rels/document.xml.rels"
  let rels =
    (await zip.file(relsPath)?.async("string")) ??
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`
  let ct = await zip.file("[Content_Types].xml")!.async("string")
  if (!/Extension="png"/i.test(ct)) {
    ct = ct.replace("</Types>", `<Default Extension="png" ContentType="image/png"/></Types>`)
  }
  // Namespaces the anchor needs on the root element.
  xml = xml.replace(/<w:document\b([^>]*)>/, (full, attrs: string) => {
    let a = attrs
    if (!/xmlns:wp=/.test(a)) a += ` xmlns:wp="${NS_WP}"`
    if (!/xmlns:r=/.test(a)) a += ` xmlns:r="${NS_R}"`
    return `<w:document${a}>`
  })

  const sizes = sectSizes(xml)
  const mediaFor = new Map<string, string>()
  let n = 0
  for (const [stampId, img] of images) {
    n++
    const name = `estamp-${Date.now().toString(36)}-${n}.png`
    zip.file(`word/media/${name}`, img.bytes)
    const rid = `rIdEstamp${Date.now().toString(36)}${n}`
    rels = rels.replace("</Relationships>", `<Relationship Id="${rid}" Type="${NS_R}/image" Target="media/${name}"/></Relationships>`)
    mediaFor.set(stampId, rid)
  }

  let i = 0
  for (const pl of placements) {
    const img = images.get(pl.stampId)
    const rid = mediaFor.get(pl.stampId)
    if (!img || !rid) continue
    i++
    // DOCX pages are decided by Word, so a stamp lives on the first or the last page.
    const isLast = lastPage > 0 && pl.page > 0
    const size = isLast ? sizes[sizes.length - 1] : sizes[0]
    const EMU = 635 // per twip
    const cx = pl.w * size.w * EMU
    const cy = cx * (img.h / img.w)
    const x = pl.x * size.w * EMU - cx / 2
    const y = pl.y * size.h * EMU - cy / 2
    xml = insertRun(xml, anchorXml({ rid, id: i, x, y, cx, cy, rot: pl.rot }), isLast ? "last" : "first")
  }

  zip.file("word/document.xml", xml)
  zip.file(relsPath, rels)
  zip.file("[Content_Types].xml", ct)
  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" })
}

/* ---------------------------------------------------------------- misc */

type DownloadsNs = { save: (r: { filename: string; data: Blob }) => Promise<{ status: string }> }
type ClaudeHost = { use: (name: string) => Promise<unknown> }

/**
 * Save a generated file. Inside a claude.ai artifact the host's `downloads`
 * capability is used (the viewer confirms); everywhere else a normal download.
 * Resolves false when the viewer declines.
 */
export async function download(bytes: Uint8Array, name: string, mime: string): Promise<boolean> {
  const blob = new Blob([bytes as BlobPart], { type: mime })
  const host = (window as unknown as { claude?: ClaudeHost }).claude
  if (host?.use) {
    const ns = (await host.use("downloads").catch(() => null)) as DownloadsNs | null
    if (ns) {
      try {
        await ns.save({ filename: name, data: blob })
        return true
      } catch (e) {
        if ((e as { code?: string })?.code === "declined") return false
        /* fall through to a normal download */
      }
    }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
  return true
}

export function stampedName(name: string, ext: string) {
  const base = name.replace(/\.[^.]+$/, "")
  return `${base}-stamped.${ext}`
}
