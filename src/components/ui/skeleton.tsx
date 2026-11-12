import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden
      className={cn("skeleton-sheen rounded-md bg-white/[0.045]", className)}
      {...props}
    />
  )
}

export { Skeleton }
