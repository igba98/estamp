import type { Metadata } from "next"
import { Suspense } from "react"
import { Approvals } from "@/components/views/approvals"
import { ListSkeleton } from "@/components/skeletons"

export const metadata: Metadata = { title: "Approvals" }

export default function Page() {
  return (
    <Suspense fallback={<ListSkeleton />}>
      <Approvals />
    </Suspense>
  )
}
