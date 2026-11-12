import { FileText, FileType2, ImageIcon } from "lucide-react"
import type { DocKind } from "@/lib/types"
import { cn } from "@/lib/utils"

const KIND = {
  pdf: { icon: FileText, label: "PDF", cls: "text-[#f0817a] bg-[#f0817a]/10 border-[#f0817a]/15" },
  docx: { icon: FileType2, label: "Word", cls: "text-[#8fb0ff] bg-[#8fb0ff]/10 border-[#8fb0ff]/15" },
  image: { icon: ImageIcon, label: "Image", cls: "text-[#7fd6a6] bg-[#7fd6a6]/10 border-[#7fd6a6]/15" },
} as const

export function DocIcon({ kind, className }: { kind: DocKind; className?: string }) {
  const k = KIND[kind]
  return (
    <span className={cn("grid size-9 shrink-0 place-items-center rounded-lg border", k.cls, className)}>
      <k.icon className="size-4" />
    </span>
  )
}

export function kindLabel(kind: DocKind) {
  return KIND[kind].label
}

export function Fade({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("animate-in fade-in-0 duration-200", className)}>{children}</div>
}
