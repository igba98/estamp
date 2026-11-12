"use client"

import { useRef, useState } from "react"
import { FileText, FileType2, ImageIcon, Lock, Upload } from "lucide-react"
import { toast } from "sonner"
import { ACCEPT, MAX_BYTES, detectKind, formatBytes } from "@/lib/documents"
import { cn } from "@/lib/utils"

export function DropZone({
  onFile,
  className,
  size = "lg",
}: {
  onFile: (f: File) => void
  className?: string
  size?: "lg" | "md"
}) {
  const input = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)

  function take(files: FileList | null) {
    const f = files?.[0]
    if (!f) return
    if (!detectKind(f)) {
      toast.error("That file type can't be stamped", {
        description: "Use a PDF, a Word document (.docx), or a PNG, JPG or WebP image. Older .doc files: save as .docx first.",
      })
      return
    }
    if (f.size > MAX_BYTES) {
      toast.error("That file is too large", { description: `${formatBytes(f.size)} — the free version handles files up to ${formatBytes(MAX_BYTES)}.` })
      return
    }
    onFile(f)
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(false)
      }}
      onDrop={(e) => {
        e.preventDefault()
        setOver(false)
        take(e.dataTransfer.files)
      }}
      className={cn(
        "relative flex flex-col items-center justify-center overflow-hidden rounded-2xl border border-dashed text-center",
        "transition-[background-color,border-color] duration-200",
        over ? "border-ink/70 bg-ink/[0.07]" : "border-white/[0.14] bg-card hover:border-white/25",
        size === "lg" ? "min-h-[260px] px-6 py-10" : "min-h-[200px] px-5 py-8",
        className,
      )}
    >
      <div className="bg-dots pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]" />
      <div className="relative flex items-end gap-1.5" aria-hidden>
        <FileIcon tone="red" className="-rotate-6 translate-y-1"><FileText className="size-4" /></FileIcon>
        <FileIcon tone="blue" className="z-10 size-14"><FileType2 className="size-5" /></FileIcon>
        <FileIcon tone="green" className="rotate-6 translate-y-1"><ImageIcon className="size-4" /></FileIcon>
      </div>
      <p className="relative mt-5 text-[17px] font-semibold tracking-[-0.01em]">
        {over ? "Drop to start stamping" : "Drop a document here to stamp it"}
      </p>
      <p className="relative mt-1.5 text-[14px] text-muted-foreground">PDF, Word (.docx), PNG, JPG or WebP · up to 40 MB</p>
      <button
        type="button"
        onClick={() => input.current?.click()}
        className="press relative mt-5 inline-flex h-10 items-center gap-2 rounded-[10px] bg-primary px-4 text-[14px] font-semibold text-primary-foreground shadow-[0_1px_0_rgba(255,255,255,0.4)_inset] hover:bg-primary/88"
      >
        <Upload className="size-4" /> Choose a file
      </button>
      <p className="relative mt-4 flex items-center gap-1.5 text-[12.5px] text-faint">
        <Lock className="size-3.5" /> Stamped in your browser. Only the finished file is saved to your account.
      </p>
      <input
        ref={input}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          take(e.target.files)
          e.target.value = ""
        }}
      />
    </div>
  )
}

function FileIcon({ children, tone, className }: { children: React.ReactNode; tone: "red" | "blue" | "green"; className?: string }) {
  const c = { red: "text-[#f0817a]", blue: "text-[#8fb0ff]", green: "text-[#7fd6a6]" }[tone]
  return (
    <span
      className={cn(
        "grid size-11 place-items-center rounded-xl border border-white/10 bg-gradient-to-b from-[oklch(0.3_0.004_270)] to-[oklch(0.22_0.004_270)] shadow-[0_8px_20px_-6px_rgba(0,0,0,0.6)]",
        c,
        className,
      )}
    >
      {children}
    </span>
  )
}
