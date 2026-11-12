"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { Ban, BadgeCheck, CircleAlert, CircleCheck, Info, ScanLine, Upload } from "lucide-react"
import { Page, PageHeader, Panel } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Fade } from "@/components/docs/doc-bits"
import { FormSkeleton } from "@/components/skeletons"
import { useAppState } from "@/lib/store"
import { decodePayload, encodePayload, extractTarget, fetchRecord, recordFromPayload, sha256Hex, type StampRecord } from "@/lib/verify"
import { formatBytes } from "@/lib/documents"
import { cn } from "@/lib/utils"

export type Lookup =
  | { s: "none" }
  | { s: "loading" }
  | { s: "found"; record: StampRecord }
  | { s: "missing" }
  | { s: "damaged" }
  | { s: "offline" }

/** Resolve ?id= (server record) or ?d= (older self-contained QR) from the URL. */
export function useLookup(): Lookup {
  const params = useSearchParams()
  const id = params.get("id")
  const d = params.get("d")
  const [fetched, setFetched] = useState<{ id: string; result: Lookup } | null>(null)

  useEffect(() => {
    if (!id) return
    let live = true
    fetchRecord(id).then(
      (record) => live && setFetched({ id, result: record ? { s: "found", record } : { s: "missing" } }),
      () => live && setFetched({ id, result: { s: "offline" } }),
    )
    return () => {
      live = false
    }
  }, [id])

  if (id) return fetched?.id === id ? fetched.result : { s: "loading" }
  if (d) {
    const p = decodePayload(d)
    return p ? { s: "found", record: recordFromPayload(p) } : { s: "damaged" }
  }
  return { s: "none" }
}

export function Verify() {
  const router = useRouter()
  const ready = useAppState((s) => s.ready)
  const lookup = useLookup()
  const [input, setInput] = useState("")
  const [error, setError] = useState<string | null>(null)

  if (!ready) return <FormSkeleton />

  function check(e: React.FormEvent) {
    e.preventDefault()
    const target = extractTarget(input)
    if (!target) {
      setError("That doesn't look like an eStamp verify link. Paste the full link from the QR code.")
      return
    }
    setError(null)
    router.push("id" in target ? `/verify?id=${encodeURIComponent(target.id)}` : `/verify?d=${encodePayload(target.payload)}`)
  }

  return (
    <Fade>
      <Page className="max-w-[860px]">
        <PageHeader
          title="Verify a stamp"
          description="Scan the QR code on a stamped document with your phone camera, or paste its link here."
        />

        {lookup.s === "none" ? (
          <Panel className="mt-8 p-5 sm:p-6">
            <form onSubmit={check} className="space-y-3">
              <label htmlFor="vf" className="text-[14px] font-semibold">
                Verify link
              </label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  id="vf"
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value)
                    setError(null)
                  }}
                  placeholder="https://…/v?id=…"
                  aria-invalid={!!error}
                  aria-describedby={error ? "vf-err" : undefined}
                  autoComplete="off"
                  spellCheck={false}
                />
                <Button type="submit" size="lg" disabled={!input.trim()}>
                  Check stamp
                </Button>
              </div>
              {error && (
                <p id="vf-err" className="text-[13px] text-destructive">
                  {error}
                </p>
              )}
            </form>
            <div className="mt-6 flex items-start gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 text-[13.5px] leading-relaxed text-muted-foreground">
              <ScanLine className="mt-0.5 size-5 shrink-0 text-faint" />
              <p>
                Every eStamp has a QR code beside it marked <span className="font-semibold text-foreground">Scan to verify</span>. Point your phone camera at it and the verify page opens with the stamp&apos;s record.
              </p>
            </div>
          </Panel>
        ) : (
          <LookupView lookup={lookup} inApp />
        )}
      </Page>
    </Fade>
  )
}

/** Shared by the in-app and public verify pages. */
export function LookupView({ lookup, inApp }: { lookup: Lookup; inApp?: boolean }) {
  const docs = useAppState((s) => s.docs)
  if (lookup.s === "loading") return <ResultSkeleton />
  if (lookup.s === "found") {
    const r = lookup.record
    const mine = inApp && docs.some((d) => (r.id ? d.id === r.id : d.ref === r.ref))
    return <Result r={r} mine={mine} />
  }
  if (lookup.s === "none") return null
  const copy = {
    missing: ["Stamp not found", "There's no record of this stamp. It may have been deleted by its organisation, or the QR code isn't a real eStamp. Treat the document with caution."],
    damaged: ["This verify link is damaged", "Part of the link may be missing. Scan the QR code on the document again."],
    offline: ["Couldn't check the stamp", "The verify service didn't respond. Check your internet connection and reload the page."],
  }[lookup.s]
  return (
    <div role="alert" className="mt-8 flex items-start gap-3 rounded-2xl border border-destructive/25 bg-destructive/10 p-5">
      <CircleAlert className="mt-0.5 size-5 shrink-0 text-destructive" />
      <div>
        <p className="text-[15px] font-semibold">{copy[0]}</p>
        <p className="mt-1 max-w-[60ch] text-[14px] text-muted-foreground">{copy[1]}</p>
      </div>
    </div>
  )
}

function ResultSkeleton() {
  return (
    <Panel className="mt-8 overflow-hidden" aria-busy="true" aria-label="Checking stamp">
      <div className="flex items-start gap-4 border-b border-white/[0.06] p-5 sm:p-6">
        <Skeleton className="size-12 rounded-2xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
      </div>
      <div className="grid gap-px sm:grid-cols-2">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="space-y-2 px-5 py-4 sm:px-6">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-4 w-36" />
          </div>
        ))}
      </div>
    </Panel>
  )
}

export function Result({ r, mine }: { r: StampRecord; mine?: boolean }) {
  const stampedAt = new Date(r.stampedAt)
  const revoked = !!r.revokedAt
  const title = revoked ? "This stamp was revoked" : r.server ? "Genuine stamp" : "Stamp details found"

  return (
    <div className="mt-8 space-y-4">
      <Panel className="overflow-hidden">
        <div className="flex items-start gap-4 border-b border-white/[0.06] p-5 sm:p-6">
          <span
            className={cn(
              "grid size-12 shrink-0 place-items-center rounded-2xl",
              revoked ? "bg-destructive/12 text-destructive" : "bg-ok/12 text-ok",
            )}
          >
            {revoked ? <Ban className="size-6" /> : <BadgeCheck className="size-6" />}
          </span>
          <div className="min-w-0">
            <p className="text-[18px] font-semibold tracking-[-0.01em]">{title}</p>
            <p className="mt-1 max-w-[60ch] text-[13.5px] leading-relaxed text-muted-foreground">
              {revoked ? (
                <>
                  <span className="font-semibold text-foreground">{r.org}</span> revoked this stamp on{" "}
                  {new Date(r.revokedAt!).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}. Don&apos;t accept the document as valid.
                  {r.revokeReason && <span className="mt-1 block">Reason: {r.revokeReason}</span>}
                </>
              ) : (
                <>
                  {r.server ? "Matches the record kept by eStamp: stamped by " : "This document was stamped by "}
                  <span className="font-semibold text-foreground">{r.org}</span> on{" "}
                  {stampedAt.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}.
                </>
              )}
            </p>
            {mine && (
              <p className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-ok/25 bg-ok/10 px-2.5 py-1 text-[12px] font-semibold text-ok">
                <CircleCheck className="size-3.5" /> In your organisation&apos;s records
              </p>
            )}
          </div>
        </div>
        <dl className="grid gap-px bg-white/[0.06] sm:grid-cols-2">
          <Cell label="Reference" value={<span className="tnum">{r.ref}</span>} />
          <Cell label="Stamp" value={r.label} />
          <Cell label="Organisation" value={r.org} />
          <Cell
            label="Stamped on"
            value={stampedAt.toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
          />
          <Cell label="Document" value={<span className="break-all">{r.file}</span>} />
          <Cell label="Pages" value={<span className="tnum">{r.pages}</span>} />
          {r.by && <Cell label="Stamped by" value={r.by} />}
          <Cell label="Original fingerprint" value={<span className="font-mono text-[12.5px] break-all">{r.originalHash.slice(0, 16)}</span>} />
        </dl>
      </Panel>

      <CompareFile r={r} />

      {!r.server && (
        <div className="flex items-start gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 text-[13px] leading-relaxed text-muted-foreground">
          <Info className="mt-0.5 size-4 shrink-0 text-faint" />
          <p className="max-w-[62ch]">
            <span className="font-semibold text-foreground">Older stamp:</span> these details are carried inside the QR code itself, so they show what was stamped but can&apos;t by themselves prove a copy wasn&apos;t altered. Stamps made now are checked against a secure record.
          </p>
        </div>
      )}
    </div>
  )
}

function Cell({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="bg-card px-5 py-4 sm:px-6">
      <dt className="text-[12.5px] text-faint">{label}</dt>
      <dd className="mt-1 text-[14.5px] font-semibold">{value}</dd>
    </div>
  )
}

type Match = "stamped" | "original" | "none"

function CompareFile({ r }: { r: StampRecord }) {
  const input = useRef<HTMLInputElement>(null)
  const [state, setState] = useState<{ s: "idle" } | { s: "busy" } | { s: "done"; match: Match; name: string; size: number }>({ s: "idle" })

  async function take(f?: File) {
    if (!f) return
    setState({ s: "busy" })
    const h = await sha256Hex(await f.arrayBuffer())
    // Older QR codes only carry the first characters of the original's fingerprint.
    const match: Match =
      r.outputHash && h === r.outputHash ? "stamped" : h.startsWith(r.originalHash) ? "original" : "none"
    setState({ s: "done", match, name: f.name, size: f.size })
  }

  const message = state.s === "done" && {
    stamped: ["Exact copy.", `${state.name} is exactly the stamped file that was issued. It hasn't been changed.`],
    original: ["Original file.", `${state.name} is the document as it was before stamping.`],
    none: [
      "Different file.",
      r.outputHash
        ? `${state.name} (${formatBytes(state.size)}) doesn't match the issued file. It may have been edited, re-saved or printed and scanned. Ask the sender for the original.`
        : `${state.name} (${formatBytes(state.size)}) doesn't match. It may be another version, or the stamped copy rather than the original.`,
    ],
  }[state.match]

  return (
    <Panel className="p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold">Check the file you received</p>
          <p className="mt-1 max-w-[60ch] text-[13.5px] text-muted-foreground">
            {r.outputHash
              ? "Choose the stamped file to confirm it's the exact copy that was issued. The file stays on your device."
              : "Have the original, unstamped file? Check it against the fingerprint recorded when it was stamped. The file stays on your device."}
          </p>
        </div>
        <Button variant="outline" onClick={() => input.current?.click()} disabled={state.s === "busy"}>
          <Upload /> {state.s === "busy" ? "Checking…" : "Choose file"}
        </Button>
        <input ref={input} type="file" className="sr-only" tabIndex={-1} onChange={(e) => { void take(e.target.files?.[0]); e.target.value = "" }} />
      </div>
      {state.s === "done" && message && (
        <div
          role="status"
          className={cn(
            "mt-4 flex items-start gap-3 rounded-xl border p-3.5 text-[13.5px]",
            state.match !== "none" ? "border-ok/25 bg-ok/10" : "border-warn/25 bg-warn/10",
          )}
        >
          {state.match !== "none" ? <CircleCheck className="mt-0.5 size-4 shrink-0 text-ok" /> : <CircleAlert className="mt-0.5 size-4 shrink-0 text-warn" />}
          <p>
            <span className="font-semibold">{message[0]}</span> <span className="text-muted-foreground">{message[1]}</span>
          </p>
        </div>
      )}
    </Panel>
  )
}
