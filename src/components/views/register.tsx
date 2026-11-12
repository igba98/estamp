"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { Download, FileText, Inbox, Plus, Search } from "lucide-react"
import { Page, PageHeader, Panel } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Fade } from "@/components/docs/doc-bits"
import { ListSkeleton } from "@/components/skeletons"
import { addRegisterEntry, deleteRegisterEntry, isAdmin, updateRegisterEntry, useAppState } from "@/lib/store"
import { download } from "@/lib/documents"
import { formatDateTime } from "@/lib/format"
import { toCsv } from "@/lib/csv"
import type { RegisterEntry } from "@/lib/types"

type Editing = { mode: "new" } | { mode: "edit"; entry: RegisterEntry } | null

export function MailRegister() {
  const ready = useAppState((s) => s.ready)
  const entries = useAppState((s) => s.register)
  const [q, setQ] = useState("")
  const [editing, setEditing] = useState<Editing>(null)

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase()
    if (!t) return entries
    return entries.filter((e) => `${e.regNo} ${e.sender} ${e.subject} ${e.notes} ${e.receivedByName}`.toLowerCase().includes(t))
  }, [entries, q])

  if (!ready) return <ListSkeleton />

  return (
    <Fade>
      <Page className="max-w-[1100px]">
        <PageHeader
          title="Mail register"
          description="Incoming mail, numbered in order. Stamps with “Log in mail register” turned on add entries automatically; add paper mail by hand."
          actions={
            <>
              {entries.length > 0 && (
                <Button variant="ghost" onClick={() => exportCsv(shown)}>
                  <Download /> Export CSV
                </Button>
              )}
              <Button onClick={() => setEditing({ mode: "new" })}>
                <Plus /> Add entry
              </Button>
            </>
          }
        />

        {entries.length === 0 ? (
          <div className="mt-8 flex flex-col items-center rounded-2xl border border-dashed border-white/10 px-6 py-16 text-center">
            <span className="grid size-11 place-items-center rounded-xl border border-white/[0.08] bg-white/[0.03]">
              <Inbox className="size-5 text-muted-foreground" />
            </span>
            <p className="mt-4 text-[17px] font-semibold">No mail registered yet</p>
            <p className="mt-1.5 max-w-[48ch] text-[14px] text-muted-foreground">
              Stamp a letter with your Received stamp and it gets the next number here, e.g. IN/{new Date().getFullYear()}/0001.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <Button nativeButton={false} render={<Link href="/stamp" />}>
                Stamp a letter
              </Button>
              <Button variant="outline" onClick={() => setEditing({ mode: "new" })}>
                Add paper mail
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="relative mt-8 w-full sm:max-w-[320px]">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search number, sender, subject"
                className="pl-9"
                aria-label="Search the register"
              />
            </div>
            <Panel className="mt-4 overflow-hidden">
              {shown.length === 0 ? (
                <p className="px-5 py-12 text-center text-[14px] text-muted-foreground">Nothing matches &ldquo;{q}&rdquo;.</p>
              ) : (
                <ul className="divide-y divide-white/[0.05]">
                  {shown.map((e) => (
                    <li key={e.id}>
                      <button
                        type="button"
                        onClick={() => setEditing({ mode: "edit", entry: e })}
                        className="grid w-full gap-x-4 gap-y-1 px-5 py-3.5 text-left transition-[background-color] duration-150 hover:bg-white/[0.03] sm:grid-cols-[120px_minmax(0,1.2fr)_minmax(0,1fr)_150px] sm:items-center"
                      >
                        <span className="tnum text-[13.5px] font-semibold">{e.regNo}</span>
                        <span className="min-w-0">
                          <span className="block truncate text-[14px] font-medium">{e.subject || <span className="text-faint">No subject</span>}</span>
                          {e.documentId && (
                            <span className="mt-0.5 flex items-center gap-1 text-[12px] text-faint">
                              <FileText className="size-3" /> Stamped document
                            </span>
                          )}
                        </span>
                        <span className="truncate text-[13.5px] text-muted-foreground">
                          {e.sender || <span className="text-faint">Sender not filled in</span>}
                        </span>
                        <span className="tnum text-[12.5px] text-faint sm:text-right">
                          {formatDateTime(e.receivedAt)}
                          {e.receivedByName && <span className="block truncate">{e.receivedByName}</span>}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </>
        )}

        <EntryDialog editing={editing} onClose={() => setEditing(null)} />
      </Page>
    </Fade>
  )
}

function EntryDialog({ editing, onClose }: { editing: Editing; onClose: () => void }) {
  return (
    <Dialog open={!!editing} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[480px]">
        {editing && <EntryForm key={editing.mode === "edit" ? editing.entry.id : "new"} editing={editing} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  )
}

function EntryForm({ editing, onClose }: { editing: NonNullable<Editing>; onClose: () => void }) {
  const entry = editing.mode === "edit" ? editing.entry : null
  const admin = useAppState(isAdmin)
  const [sender, setSender] = useState(entry?.sender ?? "")
  const [subject, setSubject] = useState(entry?.subject ?? "")
  const [notes, setNotes] = useState(entry?.notes ?? "")
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    const patch = { sender: sender.trim(), subject: subject.trim(), notes: notes.trim() }
    if (entry) {
      void updateRegisterEntry(entry.id, patch)
      onClose()
      return
    }
    setBusy(true)
    const added = await addRegisterEntry(patch)
    setBusy(false)
    if (added) onClose()
  }

  return (
    <form onSubmit={save}>
      <DialogHeader>
        <DialogTitle>{entry ? entry.regNo : "Add incoming mail"}</DialogTitle>
        <DialogDescription>
          {entry
            ? `Received ${formatDateTime(entry.receivedAt)}${entry.receivedByName ? ` by ${entry.receivedByName}` : ""}.`
            : "It gets the next register number when you save."}
        </DialogDescription>
      </DialogHeader>
      <div className="mt-5 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="re-from">From</Label>
          <Input id="re-from" value={sender} onChange={(e) => setSender(e.target.value)} maxLength={200} placeholder="e.g. Tanzania Revenue Authority" autoComplete="off" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="re-subject">Subject</Label>
          <Input id="re-subject" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={300} placeholder="e.g. Notice of assessment 2026" autoComplete="off" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="re-notes">
            Notes <span className="font-normal text-faint">(optional)</span>
          </Label>
          <Textarea id="re-notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} rows={3} placeholder="Forwarded to finance, reply due…" />
        </div>
      </div>
      <DialogFooter className="mt-6 gap-2">
        {entry && admin && (
          <Button
            type="button"
            variant="ghost"
            className="text-destructive hover:bg-destructive/10 hover:text-destructive sm:mr-auto"
            onClick={() => {
              if (!confirmDelete) return setConfirmDelete(true)
              void deleteRegisterEntry(entry.id)
              onClose()
            }}
          >
            {confirmDelete ? "Tap again to delete" : "Delete entry"}
          </Button>
        )}
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : entry ? "Save" : "Add to register"}
        </Button>
      </DialogFooter>
    </form>
  )
}

function exportCsv(entries: RegisterEntry[]) {
  const csv = toCsv([
    ["Number", "Received", "From", "Subject", "Notes", "Received by"],
    ...entries.map((e) => [e.regNo, new Date(e.receivedAt).toISOString(), e.sender, e.subject, e.notes, e.receivedByName]),
  ])
  // BOM so Excel opens UTF-8 (Swahili names, emoji) correctly.
  void download(new TextEncoder().encode("﻿" + csv), `mail-register-${new Date().toISOString().slice(0, 10)}.csv`, "text/csv")
}
