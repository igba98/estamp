import QRCode from "qrcode"
import { INKS, type StampDesign } from "./types"

export type StampContext = {
  date?: Date
  ref?: string
  /** URL encoded into the QR. Omit for a preview pattern. */
  qrText?: string
  /** Unique suffix for SVG ids when several stamps share one DOM. */
  uid?: string
  /** Seed for the ink grain so each impression looks a little different. */
  seed?: number
}

export type StampSvg = {
  svg: string
  /** viewBox width / height */
  width: number
  height: number
  /** Physical width of the whole impression (seal + QR panel) in mm. */
  widthMm: number
  heightMm: number
}

const FONT = "Arial, Helvetica, 'Liberation Sans', sans-serif"
const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]

export function formatStampDate(d: Date) {
  return `${String(d.getDate()).padStart(2, "0")} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

function esc(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

/** Approximate advance width of bold caps in our font stack, per 1px of font size. */
const CAP_W = 0.7

function fitSize(text: string, maxWidth: number, maxSize: number, minSize = 6) {
  const len = Math.max(1, text.length)
  return Math.max(minSize, Math.min(maxSize, maxWidth / (len * CAP_W)))
}

/** Text along an arc: spread short text with letter spacing, compress long text to fit. */
function arcText(pathId: string, text: string, arcLen: number, size: number, fill: string) {
  const t = text.toUpperCase().trim()
  if (!t) return ""
  size = Math.max(8.5, Math.min(size, (arcLen * 0.86) / (t.length * CAP_W)))
  const natural = t.length * size * CAP_W
  const target = Math.min(arcLen * 0.86, Math.max(natural, arcLen * 0.5))
  return `<text font-family="${FONT}" font-weight="700" font-size="${size}" fill="${fill}" text-anchor="middle"><textPath href="#${pathId}" startOffset="50%" textLength="${target.toFixed(1)}" lengthAdjust="${natural > target ? "spacingAndGlyphs" : "spacing"}">${esc(t)}</textPath></text>`
}

function line(x1: number, y1: number, x2: number, y2: number, c: string, w: number) {
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${c}" stroke-width="${w}" stroke-linecap="round"/>`
}

function star(cx: number, cy: number, r: number, c: string) {
  const pts: string[] = []
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5
    const rr = i % 2 === 0 ? r : r * 0.45
    pts.push(`${(cx + rr * Math.cos(a)).toFixed(2)},${(cy + rr * Math.sin(a)).toFixed(2)}`)
  }
  return `<polygon points="${pts.join(" ")}" fill="${c}"/>`
}

function centeredText(x: number, y: number, text: string, size: number, c: string, maxW: number, weight = 700, spacing = 0) {
  const t = text.trim()
  if (!t) return ""
  const natural = t.length * size * CAP_W + spacing * t.length
  const squeeze = natural > maxW ? ` textLength="${maxW.toFixed(1)}" lengthAdjust="spacingAndGlyphs"` : ""
  return `<text x="${x}" y="${y}" font-family="${FONT}" font-weight="${weight}" font-size="${size.toFixed(2)}" fill="${c}" text-anchor="middle" letter-spacing="${spacing}"${squeeze}>${esc(t)}</text>`
}

function inkFilter(id: string, seed: number) {
  return `<filter id="${id}" x="-4%" y="-4%" width="108%" height="108%" color-interpolation-filters="sRGB">
<feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="${seed}" result="n"/>
<feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -3.2 0 0 0 2.35" result="speck"/>
<feComposite in="SourceGraphic" in2="speck" operator="in" result="inked"/>
<feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="${seed + 7}" result="w"/>
<feDisplacementMap in="inked" in2="w" scale="2.4" xChannelSelector="R" yChannelSelector="G"/>
</filter>`
}

function qrPath(text: string, x: number, y: number, size: number) {
  const qr = QRCode.create(text, { errorCorrectionLevel: "M" })
  const n = qr.modules.size
  const cell = size / (n + 2) // one-module quiet zone each side inside the box
  let d = ""
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (qr.modules.get(r, c)) {
        const px = x + (c + 1) * cell
        const py = y + (r + 1) * cell
        d += `M${px.toFixed(2)} ${py.toFixed(2)}h${cell.toFixed(2)}v${cell.toFixed(2)}h-${cell.toFixed(2)}z`
      }
    }
  }
  return d
}


/** Long centre labels break onto two balanced lines. */
function splitLabel(label: string): string[] {
  if (label.length <= 11 || !label.includes(" ")) return [label]
  const words = label.split(/\s+/)
  let best = [label]
  let bestDiff = Infinity
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(" ")
    const b = words.slice(i).join(" ")
    const d = Math.abs(a.length - b.length)
    if (d < bestDiff) {
      bestDiff = d
      best = [a, b]
    }
  }
  return best
}

/** Centre band: two rules with the label between them. Returns svg and the band bottom. */
function labelBand(cx: number, top: number, half: number, label: string, c: string, maxSize: number) {
  const lines = splitLabel(label)
  const inner = half * 2 - 8
  const longest = lines.reduce((a, b) => (b.length > a.length ? b : a), "")
  const size = lines.length === 1 ? fitSize(longest, inner - 4, maxSize) : fitSize(longest, inner - 4, maxSize * 0.78)
  const h = lines.length === 1 ? 31 : size * 2.15 + 10
  let out = line(cx - half, top, cx + half, top, c, 1.6) + line(cx - half, top + h, cx + half, top + h, c, 1.6)
  if (lines.length === 1) out += centeredText(cx, top + h / 2 + size * 0.36, lines[0], size, c, inner)
  else {
    out += centeredText(cx, top + 5 + size * 0.95, lines[0], size, c, inner)
    out += centeredText(cx, top + 5 + size * 2.0, lines[1], size, c, inner)
  }
  return { svg: out, bottom: top + h }
}

/* ------------------------------------------------------------------ */

type Seal = { body: string; w: number; h: number }

function roundSeal(d: StampDesign, c: string, uid: string, date: string, ref: string): Seal {
  const W = 200
  const cx = 100
  const cy = 100
  const top = `top-${uid}`
  const bot = `bot-${uid}`
  const rTop = 73
  const rBot = 84
  const hasBottom = d.subText.trim().length > 0
  let b = ""
  b += `<circle cx="${cx}" cy="${cy}" r="96" fill="none" stroke="${c}" stroke-width="4.5"/>`
  b += `<circle cx="${cx}" cy="${cy}" r="88.5" fill="none" stroke="${c}" stroke-width="1.6"/>`
  b += `<defs><path id="${top}" d="M ${cx - rTop} ${cy} A ${rTop} ${rTop} 0 0 1 ${cx + rTop} ${cy}"/><path id="${bot}" d="M ${cx - rBot} ${cy} A ${rBot} ${rBot} 0 0 0 ${cx + rBot} ${cy}"/></defs>`
  b += arcText(top, d.orgName, Math.PI * rTop, 13.5, c)
  if (hasBottom) b += arcText(bot, d.subText, Math.PI * rBot * 0.62, 11, c)
  b += star(cx - 80, cy + 3, 4.6, c) + star(cx + 80, cy + 3, 4.6, c)

  // centre block
  const label = d.label.toUpperCase().trim()
  const twoLines = splitLabel(label).length > 1
  const bandTop = (d.showDate || d.showRef ? 74 : 80) - (twoLines ? 6 : 0)
  const band = labelBand(cx, bandTop, 60, label, c, 21)
  b += band.svg
  let y = band.bottom + 15
  if (d.showDate) {
    b += centeredText(cx, y, date, 12, c, 100)
    y += 13
  }
  if (d.showRef) {
    b += centeredText(cx, y, ref, 8.6, c, 92, 700, 0.3)
  }
  if (d.showSignature) {
    b += centeredText(cx - 30, bandTop - 9, "SIGN", 7, c, 30)
    b += line(cx - 16, bandTop - 9, cx + 42, bandTop - 9, c, 1)
  }
  return { body: b, w: W, h: W }
}

function ovalSeal(d: StampDesign, c: string, uid: string, date: string, ref: string): Seal {
  const W = 270
  const H = 176
  const cx = W / 2
  const cy = H / 2
  const top = `top-${uid}`
  const bot = `bot-${uid}`
  const tx = 104
  const ty = 60
  const bx = 112
  const by = 68
  let b = ""
  b += `<ellipse cx="${cx}" cy="${cy}" rx="130" ry="84" fill="none" stroke="${c}" stroke-width="4.5"/>`
  b += `<ellipse cx="${cx}" cy="${cy}" rx="122" ry="76.5" fill="none" stroke="${c}" stroke-width="1.6"/>`
  b += `<defs><path id="${top}" d="M ${cx - tx} ${cy} A ${tx} ${ty} 0 0 1 ${cx + tx} ${cy}"/><path id="${bot}" d="M ${cx - bx} ${cy} A ${bx} ${by} 0 0 0 ${cx + bx} ${cy}"/></defs>`
  const topLen = Math.PI * Math.sqrt((tx * tx + ty * ty) / 2)
  const botLen = Math.PI * Math.sqrt((bx * bx + by * by) / 2)
  b += arcText(top, d.orgName, topLen, 13.5, c)
  if (d.subText.trim()) b += arcText(bot, d.subText, botLen * 0.55, 11, c)
  b += star(cx - 112, cy + 2, 4.6, c) + star(cx + 112, cy + 2, 4.6, c)
  const label = d.label.toUpperCase().trim()
  const twoLines = splitLabel(label).length > 1
  const bandTop = (d.showDate || d.showRef ? 58 : 66) - (twoLines ? 6 : 0)
  const band = labelBand(cx, bandTop, 82, label, c, 22)
  b += band.svg
  let y = band.bottom + 15
  if (d.showDate) {
    b += centeredText(cx, y, date, 12, c, 120)
    y += 13
  }
  if (d.showRef) b += centeredText(cx, y, ref, 8.6, c, 110, 700, 0.3)
  if (d.showSignature) {
    b += centeredText(cx - 38, bandTop - 9, "SIGN", 7, c, 30)
    b += line(cx - 24, bandTop - 9, cx + 50, bandTop - 9, c, 1)
  }
  return { body: b, w: W, h: H }
}

function rectSeal(d: StampDesign, c: string, _uid: string, date: string, ref: string): Seal {
  const W = 270
  const inner = W - 40
  let y = 0
  let b = ""
  const org = d.orgName.toUpperCase().trim()
  const sub = d.subText.toUpperCase().trim()
  y = 34
  b += centeredText(W / 2, y, org, fitSize(org, inner, 15, 7), c, inner)
  if (sub) {
    y += 15
    b += centeredText(W / 2, y, sub, 9.5, c, inner, 700, 1.2)
  }
  y += 11
  b += line(20, y, W - 20, y, c, 1.6)
  const label = d.label.toUpperCase().trim()
  const ls = fitSize(label, inner, 34, 10)
  y += ls + 10
  b += centeredText(W / 2, y, label, ls, c, inner, 800, 1)
  y += 11
  b += line(20, y, W - 20, y, c, 1.6)
  const rows: string[] = []
  if (d.showDate) rows.push("date")
  if (d.showRef) rows.push("ref")
  if (d.showSignature) rows.push("sign")
  for (const r of rows) {
    y += 19
    if (r === "date") {
      b += `<text x="22" y="${y}" font-family="${FONT}" font-weight="700" font-size="9" fill="${c}" letter-spacing="1">DATE</text>`
      b += `<text x="${W - 22}" y="${y}" font-family="${FONT}" font-weight="700" font-size="13" fill="${c}" text-anchor="end">${esc(date)}</text>`
    } else if (r === "ref") {
      b += `<text x="22" y="${y}" font-family="${FONT}" font-weight="700" font-size="9" fill="${c}" letter-spacing="1">REF</text>`
      b += `<text x="${W - 22}" y="${y}" font-family="${FONT}" font-weight="700" font-size="11" fill="${c}" text-anchor="end" letter-spacing="0.4">${esc(ref)}</text>`
    } else {
      b += `<text x="22" y="${y}" font-family="${FONT}" font-weight="700" font-size="9" fill="${c}" letter-spacing="1">SIGN</text>`
      b += line(64, y + 1, W - 22, y + 1, c, 1.1)
    }
  }
  const H = y + 22
  b =
    `<rect x="4" y="4" width="${W - 8}" height="${H - 8}" rx="9" fill="none" stroke="${c}" stroke-width="4.5"/>` +
    `<rect x="11" y="11" width="${W - 22}" height="${H - 22}" rx="4" fill="none" stroke="${c}" stroke-width="1.6"/>` +
    b
  return { body: b, w: W, h: H }
}

/* ------------------------------------------------------------------ */

export function buildStampSvg(d: StampDesign, ctx: StampContext = {}): StampSvg {
  const c = INKS[d.ink].hex
  const uid = ctx.uid ?? d.id
  const date = formatStampDate(ctx.date ?? new Date())
  const ref = ctx.ref ?? "ES-0000-0000"
  const seal =
    d.shape === "round"
      ? roundSeal(d, c, uid, date, ref)
      : d.shape === "oval"
        ? ovalSeal(d, c, uid, date, ref)
        : rectSeal(d, c, uid, date, ref)

  const pad = 6
  let width = seal.w + pad * 2
  const height = seal.h + pad * 2
  let qr = ""
  if (d.showQR) {
    const panelW = Math.min(118, Math.max(96, seal.h * 0.62))
    const gap = 10
    const px = seal.w + pad + gap
    const qrSize = panelW - 16
    const panelH = qrSize + 40
    const py = pad + (seal.h - panelH) / 2
    const qx = px + 8
    const qy = py + 8
    const text = ctx.qrText ?? "https://estamp.app/verify?preview=1"
    qr += `<rect x="${px}" y="${py}" width="${panelW}" height="${panelH}" rx="8" fill="none" stroke="${c}" stroke-width="2"/>`
    qr += `<path d="${qrPath(text, qx, qy, qrSize)}" fill="${c}"/>`
    qr += centeredText(px + panelW / 2, qy + qrSize + 13, "SCAN TO VERIFY", 7.6, c, panelW - 14, 700, 0.8)
    qr += centeredText(px + panelW / 2, qy + qrSize + 24, "eSTAMP", 6.4, c, panelW - 14, 700, 1.6)
    width = px + panelW + pad
  }

  const fid = `ink-${uid}`
  const grain = d.texture
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">` +
    (grain ? `<defs>${inkFilter(fid, ctx.seed ?? 3)}</defs>` : "") +
    `<g transform="translate(${pad} ${pad})"${grain ? ` filter="url(#${fid})"` : ""} opacity="0.94">${seal.body}</g>` +
    qr +
    `</svg>`

  const mmPerUnit = d.sizeMm / seal.w
  return {
    svg,
    width,
    height,
    widthMm: width * mmPerUnit,
    heightMm: height * mmPerUnit,
  }
}

/** Rasterise a stamp SVG to a transparent PNG. Runs in the browser. */
export async function stampToPng(s: StampSvg, pxWidth = 1100): Promise<{ blob: Blob; bytes: Uint8Array; w: number; h: number }> {
  const scale = pxWidth / s.width
  const w = Math.round(s.width * scale)
  const h = Math.round(s.height * scale)
  const sized = s.svg.replace(/width="[\d.]+" height="[\d.]+"/, `width="${w}" height="${h}"`)
  const url = URL.createObjectURL(new Blob([sized], { type: "image/svg+xml" }))
  try {
    const img = new Image()
    img.decoding = "async"
    img.src = url
    await img.decode()
    const canvas = document.createElement("canvas")
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext("2d")!
    ctx.drawImage(img, 0, 0, w, h)
    const blob = await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("PNG export failed"))), "image/png"))
    const bytes = new Uint8Array(await blob.arrayBuffer())
    return { blob, bytes, w, h }
  } finally {
    URL.revokeObjectURL(url)
  }
}
