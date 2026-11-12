"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { ClipboardCheck, FileUp, Plus, Stamp } from "lucide-react"
import { Page, PageHeader, Panel, PanelHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Fade } from "@/components/docs/doc-bits"
import { ListSkeleton } from "@/components/skeletons"
import { InkDot } from "@/components/stamp/stamp-tiles"
import {
  cancelApproval,
  decideApproval,
  downloadApprovalFile,
  isAdmin,
  requestApproval,
  setPendingFile,
  takePendingFile,
  useAppState,
} from "@/lib/store"
import { ACCEPT, MAX_BYTES, download, formatBytes } from "@/lib/documents"
import { friendlyError } from "@/lib/supabase"
import { timeAgo } from "@/lib/format"
import type { Approval, ApprovalStatus } from "@/lib/types"
import { cn } from "@/lib/utils"

const STATUS: Record<ApprovalStatus, { label: string; cls: string }> = {
  pending: { label: "Waiting", cls: "border-warn/25 bg-warn/10 text-warn" },
  approved: { label: "Approved", cls: "border-ok/25 bg-ok/10 text-ok" },
  rejected: { label: "Rejected", cls: "border-destructive/25 bg-destructive/10 text-destructive" },
  used: { label: "Stamped", cls: "border-white/10 bg-white/[0.04] text-muted-foreground" },
}

export function Approvals() {
  const params = useSearchParams()
  const router = useRouter()
  const ready = useAppState((s) => s.ready)
  const admin = useAppState(isAdmin)
  const me = useAppState((s) => s.user?.id)
  const approvals = useAppState((s) => s.approvals)
  const gated = useAppState((s) => s.stamps).filter((s) => s.requiresApproval)
  const requestFor = params.get("request")
  const [requesting, setRequesting] = useState<{ stampId: string | null; file: File | null } | null>(null)
  const [deciding, setDeciding] = useState<{ a: Approval; approve: boolean } | null>(null)

  // Arriving from the stamping screen: the file and stamp are handed over.
  useEffect(() => {
    if (!requestFor) return
    const file = takePendingFile()
    queueMicrotask(() => setRequesting({ stampId: requestFor, file }))
    router.replace("/approvals")
  }, [requestFor, router])

  if (!ready) return <ListSkeleton />

  const mine = approvals.filter((a) => a.requestedBy === me)
  const pending = admin ? approvals.filter((a) => a.status === "pending") : []
  const others = admin ? approvals.filter((a) => a.status !== "pending") : mine

  return (
    <Fade>
      <Page className="max-w-[1100px]">
        <PageHeader
          title="Approvals"
          description={
            admin
              ? "Requests from your team to use stamps that need approval. Open the file, then approve or reject it."
              : "Some stamps need an admin's approval for each file. Request it here; once it's approved you can stamp that file."
          }
          actions={
            !admin &&
            gated.length > 0 && (
              <Button onClick={() => setRequesting({ stampId: null, file: null })}>
                <Plus /> Request approval
              </Button>
            )
          }
        />

        {admin && (
          <Panel className="mt-8 overflow-hidden">
            <PanelHeader title={`Waiting for you${pending.length ? ` · ${pending.length}` : ""}`} />
            {pending.length ? (
              <ul className="divide-y divide-white/[0.05] border-t border-white/[0.05]">
                {pending.map((a) => (
                  <Row key={a.id} a={a} admin onDecide={(approve) => setDeciding({ a, approve })} />
                ))}
              </ul>
            ) : (
              <p className="border-t border-white/[0.05] px-5 py-10 text-center text-[14px] text-muted-foreground">
                Nothing to approve.{" "}
                {gated.length === 0 && "Turn on “Needs approval” for a stamp in the library to start using approvals."}
              </p>
            )}
          </Panel>
        )}

        {others.length > 0 ? (
          <Panel className="mt-6 overflow-hidden">
            <PanelHeader title={admin ? "Decided" : "Your requests"} />
            <ul className="divide-y divide-white/[0.05] border-t border-white/[0.05]">
              {others.map((a) => (
                <Row key={a.id} a={a} admin={admin} own={a.requestedBy === me} />
              ))}
            </ul>
          </Panel>
        ) : (
          !admin && (
            <div className="mt-8 flex flex-col items-center rounded-2xl border border-dashed border-white/10 px-6 py-16 text-center">
              <span className="grid size-11 place-items-center rounded-xl border border-white/[0.08] bg-white/[0.03]">
                <ClipboardCheck className="size-5 text-muted-foreground" />
              </span>
              <p className="mt-4 text-[17px] font-semibold">No requests yet</p>
              <p className="mt-1.5 max-w-[46ch] text-[14px] text-muted-foreground">
                {gated.length
                  ? `${gated.map((s) => s.name).join(", ")} ${gated.length === 1 ? "needs" : "need"} approval before you can use ${gated.length === 1 ? "it" : "them"}.`
                  : "None of your organisation's stamps need approval right now."}
              </p>
            </div>
          )
        )}

        <RequestDialog state={requesting} onClose={() => setRequesting(null)} />
        <DecideDialog state={deciding} onClose={() => setDeciding(null)} />
      </Page>
    </Fade>
  )
}

function Row({ a, admin, own, onDecide }: { a: Approval; admin: boolean; own?: boolean; onDecide?: (approve: boolean) => void }) {
  const router = useRouter()
  const stamp = useAppState((s) => s.stamps.find((x) => x.id === a.stampId))
  const [busy, setBusy] = useState(false)

  async function fetchFile() {
    setBusy(true)
    try {
      const blob = await downloadApprovalFile(a)
      return new File([blob], a.fileName, { type: blob.type })
    } catch (e) {
      toast.error("Couldn't open the file", { description: friendlyError(e) })
      return null
    } finally {
      setBusy(false)
    }
  }

  return (
    <li className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          {stamp && <InkDot ink={stamp.ink} />}
          <span className="text-[14px] font-semibold">{stamp?.name ?? "Deleted stamp"}</span>
          <span className="text-faint">on</span>
          <span className="min-w-0 truncate text-[14px] font-medium">{a.fileName}</span>
          <span className={cn("rounded-full border px-2 py-px text-[11.5px] font-semibold", STATUS[a.status].cls)}>{STATUS[a.status].label}</span>
        </div>
        <p className="mt-1 text-[12.5px] text-faint">
          {admin && `${a.requesterName || "Someone"} · `}
          {timeAgo(a.createdAt)} · {formatBytes(a.sizeBytes)}
        </p>
        {a.note && <p className="mt-1.5 max-w-[70ch] text-[13px] text-muted-foreground">&ldquo;{a.note}&rdquo;</p>}
        {a.decidedAt && (
          <p className="mt-1.5 text-[12.5px] text-faint">
            {a.status === "rejected" ? "Rejected" : "Approved"} by {a.deciderName || "an admin"} {timeAgo(a.decidedAt)}
            {a.decisionNote && <span className="text-muted-foreground">: {a.decisionNote}</span>}
          </p>
        )}
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        {a.filePath && (admin || a.status !== "used") && (
          <Button
            variant="ghost"
            disabled={busy}
            onClick={async () => {
              const f = await fetchFile()
              if (f) await download(new Uint8Array(await f.arrayBuffer()), f.name, f.type)
            }}
          >
            Open file
          </Button>
        )}
        {onDecide && (
          <>
            <Button variant="outline" onClick={() => onDecide(false)}>
              Reject
            </Button>
            <Button onClick={() => onDecide(true)}>Approve</Button>
          </>
        )}
        {own && a.status === "approved" && (
          <Button
            disabled={busy}
            onClick={async () => {
              const f = await fetchFile()
              if (!f) return
              setPendingFile(f)
              router.push(`/stamp?with=${a.stampId}`)
            }}
          >
            <Stamp /> {busy ? "Opening…" : "Stamp now"}
          </Button>
        )}
        {own && a.status === "pending" && (
          <Button variant="ghost" onClick={() => void cancelApproval(a)}>
            Cancel request
          </Button>
        )}
      </div>
    </li>
  )
}

function RequestDialog({ state, onClose }: { state: { stampId: string | null; file: File | null } | null; onClose: () => void }) {
  return (
    <Dialog open={!!state} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[480px]">{state && <RequestForm initial={state} onClose={onClose} />}</DialogContent>
    </Dialog>
  )
}

function RequestForm({ initial, onClose }: { initial: { stampId: string | null; file: File | null }; onClose: () => void }) {
  const gated = useAppState((s) => s.stamps).filter((s) => s.requiresApproval)
  const [stampId, setStampId] = useState(initial.stampId ?? gated[0]?.id ?? null)
  const [file, setFile] = useState<File | null>(initial.file)
  const [note, setNote] = useState("")
  const [busy, setBusy] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!stampId || !file) return
    setBusy(true)
    const ok = await requestApproval(stampId, file, note.trim())
    setBusy(false)
    if (ok) {
      toast.success("Request sent. You'll see it here once an admin decides.")
      onClose()
    }
  }

  return (
    <form onSubmit={submit}>
      <DialogHeader>
        <DialogTitle>Request approval</DialogTitle>
        <DialogDescription>An admin sees the file and your note, then approves or rejects it.</DialogDescription>
      </DialogHeader>
      <div className="mt-5 space-y-4">
        <fieldset className="space-y-2">
          <legend className="mb-2 text-[13.5px] font-medium">Stamp</legend>
          <div className="grid gap-2">
            {gated.map((s) => (
              <button
                key={s.id}
                type="button"
                aria-pressed={stampId === s.id}
                onClick={() => setStampId(s.id)}
                className={cn(
                  "press flex items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left text-[14px] transition-[background-color,border-color] duration-150",
                  stampId === s.id ? "border-white/25 bg-white/[0.06]" : "border-white/[0.07] hover:bg-white/[0.03]",
                )}
              >
                <InkDot ink={s.ink} />
                <span className="font-medium">{s.name}</span>
                <span className="ml-auto text-[12.5px] text-faint">{s.label}</span>
              </button>
            ))}
          </div>
        </fieldset>
        <div className="space-y-2">
          <p className="text-[13.5px] font-medium">Document</p>
          <button
            type="button"
            onClick={() => input.current?.click()}
            className="press flex w-full items-center gap-3 rounded-xl border border-dashed border-white/15 px-3.5 py-3 text-left hover:bg-white/[0.03]"
          >
            <FileUp className="size-5 shrink-0 text-faint" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14px] font-medium">{file ? file.name : "Choose the file to be stamped"}</span>
              <span className="block text-[12.5px] text-faint">{file ? formatBytes(file.size) : "PDF, Word or image"}</span>
            </span>
          </button>
          <input
            ref={input}
            type="file"
            accept={ACCEPT}
            className="sr-only"
            tabIndex={-1}
            onChange={(e) => {
              const f = e.target.files?.[0]
              e.target.value = ""
              if (!f) return
              if (f.size > MAX_BYTES) return void toast.error(`That file is over ${formatBytes(MAX_BYTES)}.`)
              setFile(f)
            }}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ap-note">
            Note for the admin <span className="font-normal text-faint">(optional)</span>
          </Label>
          <Textarea id="ap-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} rows={2} placeholder="e.g. Invoice for the Arusha delivery, already checked by finance" />
        </div>
      </div>
      <DialogFooter className="mt-6 gap-2">
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={busy || !stampId || !file}>
          {busy ? "Sending…" : "Send request"}
        </Button>
      </DialogFooter>
    </form>
  )
}

function DecideDialog({ state, onClose }: { state: { a: Approval; approve: boolean } | null; onClose: () => void }) {
  const [note, setNote] = useState("")
  return (
    <Dialog
      open={!!state}
      onOpenChange={(o) => {
        if (!o) {
          setNote("")
          onClose()
        }
      }}
    >
      <DialogContent className="sm:max-w-[440px]">
        {state && (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void decideApproval(state.a.id, state.approve, note.trim())
              setNote("")
              onClose()
            }}
          >
            <DialogHeader>
              <DialogTitle>{state.approve ? "Approve this request?" : "Reject this request?"}</DialogTitle>
              <DialogDescription>
                {state.approve
                  ? `${state.a.requesterName || "They"} can then stamp ${state.a.fileName} once. A different or edited file needs a new request.`
                  : `${state.a.requesterName || "They"} will see your reason.`}
              </DialogDescription>
            </DialogHeader>
            <div className="mt-5 space-y-2">
              <Label htmlFor="dc-note">
                {state.approve ? "Note" : "Reason"} <span className="font-normal text-faint">(optional)</span>
              </Label>
              <Textarea id="dc-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} rows={2} />
            </div>
            <DialogFooter className="mt-6 gap-2">
              <Button type="button" variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" variant={state.approve ? "default" : "destructive"}>
                {state.approve ? "Approve" : "Reject"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
