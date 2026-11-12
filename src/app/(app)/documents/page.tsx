import type { Metadata } from "next"
import { Suspense } from "react"
import { Documents } from "@/components/views/documents"
import { DocumentsSkeleton } from "@/components/skeletons"

export const metadata: Metadata = { title: "Stamped documents" }

export default function Page() {
  return (
    <Suspense fallback={<DocumentsSkeleton />}>
      <Documents />
    </Suspense>
  )
}
