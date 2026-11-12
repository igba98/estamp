import type { Metadata } from "next"
import { Suspense } from "react"
import { Designer } from "@/components/designer/designer"
import { DesignerSkeleton } from "@/components/skeletons"

export const metadata: Metadata = { title: "Edit stamp" }

export default function Page() {
  return (
    <Suspense fallback={<DesignerSkeleton />}>
      <Designer mode="edit" />
    </Suspense>
  )
}
