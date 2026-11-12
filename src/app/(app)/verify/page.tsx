import type { Metadata } from "next"
import { Suspense } from "react"
import { Verify } from "@/components/views/verify"
import { FormSkeleton } from "@/components/skeletons"

export const metadata: Metadata = { title: "Verify a stamp" }

export default function Page() {
  return (
    <Suspense fallback={<FormSkeleton />}>
      <Verify />
    </Suspense>
  )
}
