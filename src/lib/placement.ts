import type { PageInfo, Placement } from "./documents"

export type Corner = "br" | "bl" | "tr" | "tl"

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/**
 * A stamp in a page corner, the same way the stamping screen places a first stamp:
 * real size on documents (its width in mm), a share of the width on images.
 */
export function cornerPlacement(o: {
  id: string
  stampId: string
  page: number
  info: PageInfo
  widthMm: number
  /** Stamp width / height. */
  aspect: number
  image: boolean
  showQR: boolean
  corner: Corner
}): Placement {
  const pageMm = (o.info.widthPt / 72) * 25.4
  const w = o.image ? (o.showQR ? 0.4 : 0.28) : clamp(o.widthMm / pageMm, 0.08, 0.75)
  const h = (w / o.aspect) * (o.info.widthPt / o.info.heightPt)
  const x = o.corner.endsWith("r") ? 1 - w / 2 - 0.07 : w / 2 + 0.07
  const y = o.corner.startsWith("b") ? 1 - h / 2 - 0.08 : h / 2 + 0.08
  return {
    id: o.id,
    stampId: o.stampId,
    page: o.page,
    x: clamp(x, w / 2, 1 - w / 2),
    y: clamp(y, Math.min(0.5, h / 2), Math.max(0.5, 1 - h / 2)),
    w,
    rot: 0,
  }
}
