"use client"

import Link from "next/link"
import { Copy, MoreHorizontal, Pencil, Stamp, Trash2 } from "lucide-react"
import { PaperSheet, StampView } from "./stamp-view"
import { INKS, type StampDesign } from "@/lib/types"
import { cn } from "@/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const SHAPE_NAME = { round: "Round", oval: "Oval", rect: "Rectangle" } as const

export function InkDot({ ink, className }: { ink: StampDesign["ink"]; className?: string }) {
  return (
    <span
      className={cn("inline-block size-2.5 shrink-0 rounded-full ring-2 ring-white/10", className)}
      style={{ background: INKS[ink].hex }}
      aria-hidden
    />
  )
}

/** Folder holding a stamped sheet, used for quick-stamp shortcuts. */
export function StampFolder({ design, href }: { design: StampDesign; href: string }) {
  return (
    <Link
      href={href}
      className="group press flex flex-col items-center gap-3 rounded-2xl p-2 outline-offset-4"
      aria-label={`Stamp a document with ${design.name}`}
    >
      <div className="relative aspect-[1.18] w-full">
        {/* back of folder with tab */}
        <div className="absolute inset-x-0 top-[6%] bottom-0 rounded-[14px] bg-[oklch(0.26_0.004_270)]" />
        <div className="absolute top-0 left-0 h-[16%] w-[42%] rounded-t-[12px] bg-[oklch(0.26_0.004_270)]" />
        {/* sheet */}
        <div className="absolute inset-x-[10%] top-[12%] h-[78%] transition-transform duration-300 ease-(--ease-out) [@media(hover:hover)]:group-hover:-translate-y-[9%]">
          <PaperSheet className="h-full" lines>
            <div className="flex h-full items-start justify-center px-[8%] pt-[22%]">
              <StampView design={{ ...design, showQR: false }} className="w-[78%] -rotate-[4deg] mix-blend-multiply" ctx={{ ref: "ES-2026-0001" }} />
            </div>
          </PaperSheet>
        </div>
        {/* front flap */}
        <div className="absolute inset-x-0 bottom-0 h-[44%] rounded-[14px] border-t border-white/[0.12] bg-gradient-to-b from-[oklch(0.31_0.004_270)] to-[oklch(0.25_0.004_270)] shadow-[0_-10px_24px_-8px_rgba(0,0,0,0.55)]">
          <div className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full border border-white/10 bg-black/35 px-2 py-1 text-[11px] font-semibold text-white/80">
            <InkDot ink={design.ink} className="size-2 ring-0" />
            {design.label}
          </div>
        </div>
      </div>
      <div className="text-center">
        <p className="text-[14px] font-semibold leading-tight">{design.name}</p>
        <p className="tnum mt-0.5 text-[12.5px] text-faint">
          {design.uses === 0 ? "Not used yet" : `Used ${design.uses} ${design.uses === 1 ? "time" : "times"}`}
        </p>
      </div>
    </Link>
  )
}

/** Library card: the stamp on paper, with its details and actions. */
export function StampCard({
  design,
  onDuplicate,
  onDelete,
  canEdit = true,
}: {
  design: StampDesign
  onDuplicate: () => void
  onDelete: () => void
  /** Only admins edit stamps; members open the stamping screen instead. */
  canEdit?: boolean
}) {
  return (
    <article className="group relative flex flex-col rounded-2xl border border-white/[0.07] bg-card p-2 shadow-[0_1px_0_rgba(255,255,255,0.03)_inset]">
      <Link
        href={canEdit ? `/stamps/edit?id=${design.id}` : `/stamp?with=${design.id}`}
        className="block rounded-[12px] outline-offset-2"
        aria-label={canEdit ? `Edit ${design.name}` : `Stamp a document with ${design.name}`}
      >
        <PaperSheet className="aspect-[4/3]">
          <div className="flex aspect-[4/3] items-center justify-center p-[9%]">
            <StampView
              design={design}
              ctx={{ ref: "ES-2026-0001" }}
              className="max-h-full w-full mix-blend-multiply transition-transform duration-300 ease-(--ease-out) [@media(hover:hover)]:group-hover:scale-[1.03]"
            />
          </div>
        </PaperSheet>
      </Link>
      <div className="flex items-start gap-2 px-2 pt-3 pb-1.5">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[15px] font-semibold">{design.name}</h3>
          <p className="mt-1 flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
            <InkDot ink={design.ink} />
            <span>{INKS[design.ink].name}</span>
            <span className="text-white/20">·</span>
            <span>{SHAPE_NAME[design.shape]}</span>
            <span className="text-white/20">·</span>
            <span className="tnum">{design.sizeMm} mm</span>
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger
            className="press grid size-8 place-items-center rounded-lg text-faint hover:bg-white/5 hover:text-foreground"
            aria-label={`Actions for ${design.name}`}
          >
            <MoreHorizontal className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem render={<Link href={`/stamp?with=${design.id}`} />}>
              <Stamp /> Stamp a document
            </DropdownMenuItem>
            {canEdit && (
              <>
                <DropdownMenuItem render={<Link href={`/stamps/edit?id=${design.id}`} />}>
                  <Pencil /> Edit
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onDuplicate}>
                  <Copy /> Duplicate
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={onDelete}>
                  <Trash2 /> Delete
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </article>
  )
}
