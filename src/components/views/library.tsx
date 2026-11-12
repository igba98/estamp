"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { Plus, Search, X } from "lucide-react"
import { toast } from "sonner"
import { Page, PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
import { LibrarySkeleton } from "@/components/skeletons"
import { StampCard } from "@/components/stamp/stamp-tiles"
import { Segmented } from "@/components/designer/segmented"
import { Fade } from "@/components/docs/doc-bits"
import { deleteStamp, duplicateStamp, isAdmin, useAppState } from "@/lib/store"
import type { StampDesign } from "@/lib/types"

type Filter = "all" | StampDesign["shape"]

export function Library() {
  const ready = useAppState((s) => s.ready)
  const stamps = useAppState((s) => s.stamps)
  const canEdit = useAppState(isAdmin)
  const [q, setQ] = useState("")
  const [filter, setFilter] = useState<Filter>("all")
  const [pendingDelete, setPendingDelete] = useState<StampDesign | null>(null)

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase()
    return stamps
      .filter((s) => filter === "all" || s.shape === filter)
      .filter((s) => !t || `${s.name} ${s.label} ${s.orgName} ${s.subText}`.toLowerCase().includes(t))
      .sort((a, b) => b.updatedAt - a.updatedAt)
  }, [stamps, q, filter])

  if (!ready) return <LibrarySkeleton />

  return (
    <Fade>
      <Page>
        <PageHeader
          title="Stamp library"
          description={
            canEdit
              ? "Design a stamp once and everyone in your organisation can use it on any document."
              : "Your organisation's stamps. Ask an admin to add or change one."
          }
          actions={
            canEdit && (
              <Button nativeButton={false} render={<Link href="/stamps/new" />}>
                <Plus /> New stamp
              </Button>
            )
          }
        />

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative w-full sm:max-w-[320px]">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search stamps" className="pl-9" aria-label="Search stamps" />
            {q && (
              <button
                type="button"
                onClick={() => setQ("")}
                className="press absolute top-1/2 right-1.5 grid size-7 -translate-y-1/2 place-items-center rounded-md text-faint hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
          <Segmented
            label="Filter by shape"
            className="w-full sm:w-[340px]"
            value={filter}
            onChange={setFilter}
            options={[
              { value: "all", label: "All" },
              { value: "round", label: "Round" },
              { value: "oval", label: "Oval" },
              { value: "rect", label: "Box" },
            ]}
          />
          <p className="tnum text-[13px] text-faint sm:ml-auto">
            {shown.length} of {stamps.length} {stamps.length === 1 ? "stamp" : "stamps"}
          </p>
        </div>

        {stamps.length === 0 ? (
          <EmptyLibrary />
        ) : shown.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-white/10 px-6 py-14 text-center">
            <p className="text-[15px] font-semibold">No stamps match “{q || filter}”</p>
            <button
              type="button"
              onClick={() => {
                setQ("")
                setFilter("all")
              }}
              className="press mt-2 rounded-md text-[13.5px] font-semibold text-ink hover:underline"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {shown.map((s) => (
              <StampCard
                key={s.id}
                design={s}
                canEdit={canEdit}
                onDuplicate={() => {
                  const c = duplicateStamp(s.id)
                  if (c) toast.success(`Duplicated as “${c.name}”`)
                }}
                onDelete={() => setPendingDelete(s)}
              />
            ))}
          </div>
        )}

        <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete “{pendingDelete?.name}”?</AlertDialogTitle>
              <AlertDialogDescription>Documents already stamped keep their stamp. This only removes it from your library.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep it</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={() => {
                  if (pendingDelete) deleteStamp(pendingDelete.id)
                  toast.success("Stamp deleted")
                  setPendingDelete(null)
                }}
              >
                Delete stamp
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </Page>
    </Fade>
  )
}

function EmptyLibrary() {
  return (
    <div className="mt-6 flex flex-col items-center rounded-2xl border border-dashed border-white/10 px-6 py-16 text-center">
      <p className="text-[17px] font-semibold">Your library is empty</p>
      <p className="mt-1.5 max-w-[42ch] text-[14px] text-muted-foreground">
        Create a Received, Approved or Paid stamp, or your company seal. It takes about a minute.
      </p>
      <Button className="mt-5" nativeButton={false} render={<Link href="/stamps/new" />}>
        <Plus /> Design your first stamp
      </Button>
    </div>
  )
}
