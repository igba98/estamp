import type { Metadata } from "next"
import { Suspense } from "react"
import { Workspace } from "@/components/workspace/workspace"
import { WorkspaceSkeleton } from "@/components/skeletons"

export const metadata: Metadata = { title: "Stamp a document" }

export default function Page() {
  return (
    <Suspense fallback={<WorkspaceSkeleton />}>
      <Workspace />
    </Suspense>
  )
}
