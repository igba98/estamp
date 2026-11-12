import { supabase } from "./supabase"

/**
 * Verification. New stamps carry a short record id (/v?id=…) that is looked up
 * in Supabase (verify_stamp), which also holds the stamped file's fingerprint.
 * Older stamps carried their details inside the QR link (/v?d=…); those still decode.
 */
export type VerifyPayload = {
  v: 1
  /** reference number */
  r: string
  /** organisation */
  o: string
  /** stamp label */
  l: string
  /** stamped at (ISO) */
  t: string
  /** original file name */
  f: string
  /** first 12 hex chars of SHA-256 of the original file */
  h: string
  /** page count */
  p: number
  /** stamped by (optional) */
  b?: string
}

function fromB64Url(s: string) {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)
  const bin = atob(b64)
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

/*
 * Compact format keeps the QR small enough to scan at stamp size:
 * 2~ref~org~label~time(base36 seconds)~hash~pages~file~by
 * Fields are URI-encoded with spaces as "+", so the query string stays short.
 */
const SEP = "~"
const enc = (v: string) => encodeURIComponent(v).replace(/%20/g, "+").replace(/~/g, "%7E")

export function encodePayload(p: VerifyPayload) {
  const file = p.f.length > 40 ? p.f.slice(0, 28) + "…" + p.f.slice(-10) : p.f
  return [
    "2",
    p.r,
    p.o,
    p.l,
    Math.floor(new Date(p.t).getTime() / 1000).toString(36),
    p.h.slice(0, 12),
    String(p.p),
    file,
    p.b ?? "",
  ]
    .map(enc)
    .join(SEP)
    .replace(/~+$/, "")
}

/** Accepts the value of the `d` parameter after URL decoding. */
export function decodePayload(s: string): VerifyPayload | null {
  const raw = s.trim()
  try {
    if (raw.startsWith("2" + SEP)) {
      const f = raw.split(SEP)
      if (f.length < 7) return null
      const secs = parseInt(f[4], 36)
      if (!Number.isFinite(secs)) return null
      const p: VerifyPayload = {
        v: 1,
        r: f[1],
        o: f[2],
        l: f[3],
        t: new Date(secs * 1000).toISOString(),
        h: f[5],
        p: Number(f[6]) || 1,
        f: f[7] ?? "",
        ...(f[8] ? { b: f[8] } : {}),
      }
      return p.r ? p : null
    }
    const p = JSON.parse(fromB64Url(raw))
    if (p && p.v === 1 && typeof p.r === "string" && typeof p.t === "string") return p as VerifyPayload
    return null
  } catch {
    return null
  }
}

/** Supports hosting under a sub-path. */
function basePath() {
  if (typeof document === "undefined") return ""
  const meta = document.querySelector<HTMLMetaElement>('meta[name="estamp-base"]')
  return meta?.content ?? ""
}

export function verifyUrlFor(id: string) {
  const origin = typeof window !== "undefined" ? window.location.origin + basePath() : ""
  return `${origin}/v?id=${encodeURIComponent(id)}`
}

/** One shape for both kinds of stamp, for the verify screens. */
export type StampRecord = {
  id?: string
  ref: string
  org: string
  label: string
  stampedAt: string
  file: string
  pages: number
  by?: string
  originalHash: string
  /** Fingerprint of the stamped file (server records only). */
  outputHash?: string
  revokedAt?: string
  revokeReason?: string
  /** Looked up in the database, rather than read from the QR. */
  server: boolean
}

export function recordFromPayload(p: VerifyPayload): StampRecord {
  return { ref: p.r, org: p.o, label: p.l, stampedAt: p.t, file: p.f, pages: p.p, by: p.b, originalHash: p.h, server: false }
}

const ID_RE = /^[A-Za-z0-9_-]{8,40}$/

/** Fetch a server record by id. null = no such stamp. Throws on network errors. */
export async function fetchRecord(id: string): Promise<StampRecord | null> {
  if (!ID_RE.test(id)) return null
  const { data, error } = await supabase.rpc("verify_stamp", { p_id: id })
  if (error) throw error
  if (!data) return null
  const r = data as Record<string, string | number | null>
  return {
    id: String(r.id),
    ref: String(r.ref),
    org: String(r.org_name),
    label: String(r.labels),
    stampedAt: String(r.stamped_at),
    file: String(r.file_name),
    pages: Number(r.pages),
    by: r.stamped_by ? String(r.stamped_by) : undefined,
    originalHash: String(r.original_hash),
    outputHash: r.output_hash ? String(r.output_hash) : undefined,
    revokedAt: r.revoked_at ? String(r.revoked_at) : undefined,
    revokeReason: r.revoke_reason ? String(r.revoke_reason) : undefined,
    server: true,
  }
}

/** What a pasted link or code points at: a server record id, or an older self-contained payload. */
export function extractTarget(input: string): { id: string } | { payload: VerifyPayload } | null {
  const s = input.trim()
  if (!s) return null
  try {
    if (/^https?:\/\//.test(s)) {
      const u = new URL(s)
      const id = u.searchParams.get("id")
      if (id) return ID_RE.test(id) ? { id } : null
      const d = u.searchParams.get("d")
      const payload = d ? decodePayload(d) : null
      return payload ? { payload } : null
    }
  } catch {
    return null
  }
  if (ID_RE.test(s)) return { id: s }
  const payload = decodePayload(s)
  return payload ? { payload } : null
}

export async function sha256Hex(buf: ArrayBuffer) {
  const h = await crypto.subtle.digest("SHA-256", buf)
  return Array.from(new Uint8Array(h))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}
