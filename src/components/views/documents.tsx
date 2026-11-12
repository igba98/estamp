"use client"

import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useMemo, useState } from "react"
import { Ban, Download, ExternalLink, Link2, Search, Stamp, Trash2, X, LayoutGrid, List } from "lucide-react"
import { toast } from "sonner"
import { Page, PageHeader, Panel } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { DocumentsSkeleton } from "@/components/skeletons"
import { Segmented } from "@/components/designer/segmented"
import { DocIcon, Fade, kindLabel } from "@/components/docs/doc-bits"
import { InkDot } from "@/components/stamp/stamp-tiles"
import { clearDocs, deleteDoc, downloadStored, isAdmin, revokeDoc, useAppState } from "@/lib/store"
import { download, formatBytes } from "@/lib/documents"
import { friendlyError } from "@/lib/supabase"
import { formatDateTime, timeAgo } from "@/lib/format"
import type { DocKind, StampedDoc } from "@/lib/types"
import { cn } from "@/lib/utils"
import { useMedia } from "@/hooks/use-media"

type KindFilter = "all" | DocKind

export function Documents() {
  const router = useRouter()
  const params = useSearchParams()
  const ready = useAppState((s) => s.ready)
  const docs = useAppState((s) => s.docs)
  const admin = useAppState(isAdmin)
  const [q, setQ] = useState("")
  const [kind, setKind] = useState<KindFilter>("all")
  const [view, setView] = useState<"list" | "grid">("list")
  const [confirmClear, setConfirmClear] = useState(false)
  const wide = useMedia("(min-width: 1280px)")
  const openId = params.get("open")
  const open = docs.find((d) => d.id === openId) ?? null

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase()
    return docs
      .filter((d) => kind === "all" || d.kind === kind)
      .filter((d) => !t || `${d.fileName} ${d.ref} ${d.stampNames.join(" ")}`.toLowerCase().includes(t))
  }, [docs, q, kind])

  function select(id: string | null) {
    router.replace(id ? `/documents?open=${id}` : "/documents", { scroll: false })
  }

  if (!ready) return <DocumentsSkeleton />

  return (
    <Fade>
      <Page className="max-w-[1320px]">
        <PageHeader
          title="Stamped documents"
          description="Everything your organisation has stamped: reference numbers, stamps used, verify links and the stamped files."
          actions={
            <>
              {admin && docs.length > 0 && (
                <Button variant="ghost" onClick={() => setConfirmClear(true)}>
                  Clear history
                </Button>
              )}
              <Button nativeButton={false} render={<Link href="/stamp" />}>
                <Stamp /> Stamp a document
              </Button>
            </>
          }
        />

        {docs.length === 0 ? (
          <div className="mt-8 flex flex-col items-center rounded-2xl border border-dashed border-white/10 px-6 py-20 text-center">
            <p className="text-[17px] font-semibold">No stamped documents yet</p>
            <p className="mt-1.5 max-w-[46ch] text-[14px] text-muted-foreground">
              When you stamp a PDF, Word file or image, its reference number and verify link are recorded here.
            </p>
            <Button className="mt-5" nativeButton={false} render={<Link href="/stamp" />}>
              <Stamp /> Stamp your first document
            </Button>
          </div>
        ) : (
          <>
            <div className="mt-8 flex flex-col gap-3 md:flex-row md:items-center">
              <div className="relative w-full md:max-w-[320px]">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" />
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, reference or stamp" className="pl-9" aria-label="Search documents" />
                {q && (
                  <button type="button" onClick={() => setQ("")} className="press absolute top-1/2 right-1.5 grid size-7 -translate-y-1/2 place-items-center rounded-md text-faint hover:text-foreground" aria-label="Clear search">
                    <X className="size-3.5" />
                  </button>
                )}
              </div>
              <Segmented
                label="Filter by type"
                className="w-full md:w-[320px]"
                value={kind}
                onChange={setKind}
                options={[
                  { value: "all", label: "All" },
                  { value: "pdf", label: "PDF" },
                  { value: "docx", label: "Word" },
                  { value: "image", label: "Image" },
                ]}
              />
              <div className="flex items-center gap-3 md:ml-auto">
                <p className="tnum text-[13px] text-faint">
                  {shown.length} of {docs.length}
                </p>
                <Segmented
                  label="Layout"
                  className="w-[96px]"
                  value={view}
                  onChange={setView}
                  options={[
                    { value: "list", label: "List view", icon: <List className="size-4" />, iconOnly: true },
                    { value: "grid", label: "Grid view", icon: <LayoutGrid className="size-4" />, iconOnly: true },
                  ]}
                />
              </div>
            </div>

            <div className="mt-4 grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
              {shown.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/10 px-6 py-14 text-center">
                  <p className="text-[15px] font-semibold">Nothing matches “{q || kind}”</p>
                  <button type="button" onClick={() => { setQ(""); setKind("all") }} className="press mt-2 rounded-md text-[13.5px] font-semibold text-ink hover:underline">
                    Clear filters
                  </button>
                </div>
              ) : view === "list" ? (
                <Panel className="overflow-hidden">
                  <div className="hidden grid-cols-[minmax(0,1fr)_150px_110px_120px] gap-4 border-b border-white/[0.06] px-5 py-3 text-[12.5px] font-medium text-faint md:grid">
                    <span>Name</span>
                    <span>Reference</span>
                    <span>Size</span>
                    <span className="text-right">Stamped</span>
                  </div>
                  <ul className="divide-y divide-white/[0.05]">
                    {shown.map((d) => (
                      <li key={d.id}>
                        <button
                          type="button"
                          onClick={() => select(d.id)}
                          className={cn(
                            "grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-5 py-3 text-left transition-colors duration-150 md:grid-cols-[minmax(0,1fr)_150px_110px_120px]",
                            openId === d.id ? "bg-ink/[0.08]" : "hover:bg-white/[0.025]",
                          )}
                        >
                          <span className="flex min-w-0 items-center gap-3">
                            <DocIcon kind={d.kind} />
                            <span className="min-w-0">
                              <span className="block truncate text-[14px] font-semibold">{d.fileName}</span>
                              <span className="mt-0.5 flex items-center gap-1.5 truncate text-[12.5px] text-faint">
                                <InkDot ink={d.ink} className="size-2 ring-0" />
                                {d.stampNames.join(", ")} · {d.pages} {d.pages === 1 ? "page" : "pages"}
                              </span>
                            </span>
                          </span>
                          <span className="tnum hidden text-[13px] font-semibold text-muted-foreground md:block">{d.ref}</span>
                          <span className="tnum hidden text-[13px] text-muted-foreground md:block">{formatBytes(d.outputBytes)}</span>
                          <span className="tnum text-right text-[12.5px] text-faint">{timeAgo(d.stampedAt)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </Panel>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-3">
                  {shown.map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => select(d.id)}
                      className={cn(
                        "press rounded-2xl border bg-card p-2 text-left transition-colors duration-150",
                        openId === d.id ? "border-ink/60" : "border-white/[0.07] hover:border-white/15",
                      )}
                    >
                      <Thumb doc={d} className="aspect-[4/5]" />
                      <span className="block truncate px-1.5 pt-2.5 text-[13.5px] font-semibold">{d.fileName}</span>
                      <span className="tnum block truncate px-1.5 pb-1 text-[12px] text-faint">
                        {d.ref} · {timeAgo(d.stampedAt)}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* Desktop details */}
              <div className="hidden xl:sticky xl:top-6 xl:block">
                {open ? (
                  <Details doc={open} onClose={() => select(null)} />
                ) : (
                  <Panel className="flex flex-col items-center px-6 py-14 text-center">
                    <p className="text-[14.5px] font-semibold">Select a document</p>
                    <p className="mt-1 text-[13px] text-muted-foreground">Its reference, stamps and verify link appear here.</p>
                  </Panel>
                )}
              </div>
            </div>

            {/* Mobile / tablet details */}
            <Sheet open={!!open && !wide} onOpenChange={(o) => !o && select(null)}>
              <SheetContent side="right" className="w-[400px] max-w-[92vw] overflow-y-auto border-border bg-sidebar p-0">
                <SheetTitle className="sr-only">Document details</SheetTitle>
                {open && <Details doc={open} onClose={() => select(null)} bare />}
              </SheetContent>
            </Sheet>
          </>
        )}

        <AlertDialog open={confirmClear} onOpenChange={setConfirmClear}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Clear the whole history?</AlertDialogTitle>
              <AlertDialogDescription>
                This deletes {docs.length} {docs.length === 1 ? "record" : "records"} and the saved files for your whole organisation. Their QR codes will show &ldquo;stamp not found&rdquo;. Downloaded copies are not affected.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={() => {
                  clearDocs()
                  setConfirmClear(false)
                  select(null)
                  toast.success("History cleared")
                }}
              >
                Clear history
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </Page>
    </Fade>
  )
}

function Thumb({ doc, className }: { doc: StampedDoc; className?: string }) {
  return (
    <div className={cn("relative grid place-items-center overflow-hidden rounded-[10px] bg-[oklch(0.22_0.004_270)]", className)}>
      {doc.thumb ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={doc.thumb} alt={`First stamped page of ${doc.fileName}`} className="absolute inset-0 size-full object-contain object-top" />
      ) : (
        <DocIcon kind={doc.kind} className="size-12 rounded-xl [&_svg]:size-5" />
      )}
    </div>
  )
}

function Details({ doc, onClose, bare }: { doc: StampedDoc; onClose: () => void; bare?: boolean }) {
  const [confirm, setConfirm] = useState(false)
  const [revoking, setRevoking] = useState(false)
  const [reason, setReason] = useState("")
  const [busy, setBusy] = useState(false)
  const admin = useAppState(isAdmin)
  const body = (
    <>
      <div className="flex items-start justify-between gap-3 p-5 pb-4">
        <div className="min-w-0">
          <p className="text-[12.5px] font-medium text-faint">File details</p>
          <h2 className="mt-1 text-[16px] leading-snug font-semibold break-words">{doc.fileName}</h2>
        </div>
        {!bare && (
          <button type="button" onClick={onClose} className="press grid size-8 shrink-0 place-items-center rounded-lg text-faint hover:bg-white/5 hover:text-foreground" aria-label="Close details">
            <X className="size-4" />
          </button>
        )}
      </div>
      <div className="px-5">
        <Thumb doc={doc} className="aspect-[4/3] bg-[oklch(0.2_0.004_270)]" />
      </div>
      <dl className="space-y-3 p-5 text-[13.5px]">
        {doc.revokedAt && (
          <Row
            label="Status"
            value={
              <span className="font-semibold text-destructive">
                Revoked {formatDateTime(doc.revokedAt)}
                {doc.revokeReason ? <span className="block font-normal text-muted-foreground">{doc.revokeReason}</span> : null}
              </span>
            }
          />
        )}
        <Row label="Reference" value={<span className="tnum font-semibold">{doc.ref}</span>} />
        {doc.stampedBy && <Row label="Stamped by" value={doc.stampedBy} />}
        <Row label="Stamped" value={formatDateTime(doc.stampedAt)} />
        <Row label="Stamps" value={doc.stampNames.join(", ")} />
        <Row label="Original" value={`${kindLabel(doc.kind)} · ${doc.pages} ${doc.pages === 1 ? "page" : "pages"} · ${formatBytes(doc.sizeBytes)}`} />
        <Row label="Saved as" value={<span className="break-all">{doc.outputName}</span>} />
        <Row label="Fingerprint" value={<span className="font-mono text-[12px] tracking-tight break-all">{doc.originalHash}</span>} />
      </dl>
      <div className="grid gap-2 px-5 pb-5">
        {doc.outputPath && (
          <Button
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              try {
                const blob = await downloadStored(doc)
                await download(new Uint8Array(await blob.arrayBuffer()), doc.outputName, blob.type)
              } catch (e) {
                toast.error("Couldn't download the file", { description: friendlyError(e) })
              } finally {
                setBusy(false)
              }
            }}
          >
            <Download /> {busy ? "Downloading…" : "Download stamped file"}
          </Button>
        )}
        <Button
          variant="outline"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(doc.verifyUrl)
              toast.success("Verify link copied")
            } catch {
              toast.error("Couldn't copy the link")
            }
          }}
        >
          <Link2 /> Copy verify link
        </Button>
        <Button variant="outline" nativeButton={false} render={<a href={doc.verifyUrl} target="_blank" rel="noreferrer" />}>
          <ExternalLink /> Open verify page
        </Button>
        {admin && !doc.revokedAt && (
          <Button variant="ghost" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => setRevoking(true)}>
            <Ban /> Revoke stamp
          </Button>
        )}
        {admin && (
          <Button variant="ghost" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => setConfirm(true)}>
            <Trash2 /> Delete record
          </Button>
        )}
      </div>
      <AlertDialog open={revoking} onOpenChange={setRevoking}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke this stamp?</AlertDialogTitle>
            <AlertDialogDescription>
              Anyone who scans its QR code will see that {doc.ref} was revoked. Use this when a document was stamped by mistake or is no longer valid. It can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <label htmlFor="rv-reason" className="text-[13.5px] font-medium">
              Reason <span className="font-normal text-faint">(shown on the verify page)</span>
            </label>
            <Input id="rv-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} placeholder="e.g. Issued in error" />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                void revokeDoc(doc.id, reason.trim())
                setRevoking(false)
              }}
            >
              Revoke stamp
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this record?</AlertDialogTitle>
            <AlertDialogDescription>
              The saved file is deleted too, and its QR code will show &ldquo;stamp not found&rdquo;. To keep it checkable but mark it invalid, revoke it instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                deleteDoc(doc.id)
                setConfirm(false)
                onClose()
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
  if (bare) return <div className="pt-8">{body}</div>
  return <Panel>{body}</Panel>
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-3">
      <dt className="text-faint">{label}</dt>
      <dd className="min-w-0 text-foreground/90">{value}</dd>
    </div>
  )
}
