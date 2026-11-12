import { cn } from "@/lib/utils"

export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="min-w-0">
        <h1 className="tracking-display text-[26px] leading-[1.15] font-semibold sm:text-[30px]">{title}</h1>
        {description && <p className="mt-1.5 max-w-[62ch] text-[14.5px] leading-relaxed text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function Page({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("mx-auto w-full max-w-[1240px] px-4 pt-6 pb-16 sm:px-8 sm:pt-10", className)}>{children}</div>
}

export function Panel({ children, className, ...props }: React.ComponentProps<"section">) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-white/[0.07] bg-card shadow-[0_1px_0_rgba(255,255,255,0.03)_inset,0_10px_30px_-12px_rgba(0,0,0,0.6)]",
        className,
      )}
      {...props}
    >
      {children}
    </section>
  )
}

export function PanelHeader({ title, action, className }: { title: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-center justify-between gap-3 px-5 pt-4 pb-3", className)}>
      <h2 className="text-[15px] font-semibold">{title}</h2>
      {action}
    </div>
  )
}
