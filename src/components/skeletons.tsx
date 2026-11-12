import { Skeleton } from "@/components/ui/skeleton"
import { Page } from "@/components/page-header"
import { cn } from "@/lib/utils"

export function HeaderSkeleton({ actions = 2 }: { actions?: number }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-3">
        <Skeleton className="h-8 w-64 rounded-lg" />
        <Skeleton className="h-4 w-80 max-w-[80vw]" />
      </div>
      <div className="flex gap-2">
        {Array.from({ length: actions }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-32 rounded-[10px]" />
        ))}
      </div>
    </div>
  )
}

function PanelSkeleton({ className, children }: { className?: string; children?: React.ReactNode }) {
  return <div className={cn("rounded-2xl border border-white/[0.06] bg-card", className)}>{children}</div>
}

export function RowsSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="divide-y divide-white/[0.05]">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-5 py-3.5">
          <Skeleton className="size-9 shrink-0 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5" style={{ width: `${46 - (i % 3) * 8}%` }} />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="hidden h-3.5 w-20 sm:block" />
          <Skeleton className="hidden h-3.5 w-16 md:block" />
        </div>
      ))}
    </div>
  )
}

export function FolderSkeleton() {
  return (
    <div className="flex flex-col items-center gap-3 p-2">
      <Skeleton className="aspect-[1.18] w-full rounded-[14px]" />
      <Skeleton className="h-3.5 w-20" />
      <Skeleton className="h-3 w-16" />
    </div>
  )
}

export function DashboardSkeleton() {
  return (
    <Page>
      <HeaderSkeleton />
      <div className="mt-8 grid gap-4 lg:grid-cols-3">
        <PanelSkeleton className="h-[300px] p-2 lg:col-span-2">
          <Skeleton className="h-full rounded-xl" />
        </PanelSkeleton>
        <PanelSkeleton className="space-y-5 p-5">
          <Skeleton className="h-4 w-28" />
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex justify-between">
              <Skeleton className="h-3.5 w-32" />
              <Skeleton className="h-3.5 w-10" />
            </div>
          ))}
        </PanelSkeleton>
      </div>
      <Skeleton className="mt-10 mb-4 h-5 w-32" />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <FolderSkeleton key={i} />
        ))}
      </div>
      <PanelSkeleton className="mt-10">
        <div className="px-5 pt-5 pb-2">
          <Skeleton className="h-4 w-40" />
        </div>
        <RowsSkeleton rows={4} />
      </PanelSkeleton>
    </Page>
  )
}

export function StampCardSkeleton() {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-card p-2">
      <Skeleton className="aspect-[4/3] rounded-[10px]" />
      <div className="space-y-2 px-2 pt-3 pb-2">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-3 w-40" />
      </div>
    </div>
  )
}

export function LibrarySkeleton() {
  return (
    <Page>
      <HeaderSkeleton actions={1} />
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <StampCardSkeleton key={i} />
        ))}
      </div>
    </Page>
  )
}

export function DocumentsSkeleton() {
  return (
    <Page>
      <HeaderSkeleton actions={1} />
      <div className="mt-8 flex gap-2">
        <Skeleton className="h-9 w-72 rounded-[10px]" />
        <Skeleton className="h-9 w-48 rounded-[10px]" />
      </div>
      <PanelSkeleton className="mt-4">
        <RowsSkeleton rows={7} />
      </PanelSkeleton>
    </Page>
  )
}

export function DesignerSkeleton() {
  return (
    <Page className="max-w-[1320px]">
      <HeaderSkeleton actions={2} />
      <div className="mt-8 grid gap-4 lg:grid-cols-[1fr_400px]">
        <PanelSkeleton className="min-h-[520px] p-3">
          <Skeleton className="h-full min-h-[500px] rounded-xl" />
        </PanelSkeleton>
        <PanelSkeleton className="space-y-5 p-5">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-9 w-full rounded-[10px]" />
            </div>
          ))}
        </PanelSkeleton>
      </div>
    </Page>
  )
}

export function WorkspaceSkeleton() {
  return (
    <Page className="max-w-[1400px]">
      <HeaderSkeleton actions={1} />
      <div className="mt-8 grid gap-4 lg:grid-cols-[1fr_340px]">
        <PanelSkeleton className="p-2">
          <Skeleton className="h-[300px] rounded-xl" />
        </PanelSkeleton>
        <PanelSkeleton className="space-y-3 p-4">
          <Skeleton className="h-4 w-24" />
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </PanelSkeleton>
      </div>
    </Page>
  )
}

/** Page skeleton while a PDF page renders. */
export function PageRenderSkeleton({ ratio }: { ratio: number }) {
  return (
    <div className="relative w-full overflow-hidden rounded-[6px] bg-[oklch(0.93_0.005_85)]" style={{ aspectRatio: ratio }}>
      <div className="skeleton-sheen absolute inset-0 [--sheen:rgba(0,0,0,0.04)]" />
      <div className="absolute inset-x-[10%] top-[9%] space-y-[3.2%]">
        <div className="h-[1.6%] min-h-1.5 w-[45%] rounded-full bg-black/[0.07]" />
        {[92, 88, 95, 70, 90, 84, 60].map((w, i) => (
          <div key={i} className="h-[1.1%] min-h-1 rounded-full bg-black/[0.05]" style={{ width: `${w}%` }} />
        ))}
      </div>
    </div>
  )
}

export function FormSkeleton() {
  return (
    <Page className="max-w-[860px]">
      <HeaderSkeleton actions={0} />
      <PanelSkeleton className="mt-8 space-y-6 p-6">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="h-10 w-full rounded-[10px]" />
          </div>
        ))}
      </PanelSkeleton>
    </Page>
  )
}

/** Register and approvals: header, search, list. */
export function ListSkeleton() {
  return (
    <Page className="max-w-[1100px]">
      <HeaderSkeleton actions={2} />
      <Skeleton className="mt-8 h-9 w-72 max-w-full rounded-[10px]" />
      <PanelSkeleton className="mt-4">
        <RowsSkeleton rows={6} />
      </PanelSkeleton>
    </Page>
  )
}
