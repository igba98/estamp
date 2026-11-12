import type { Metadata } from "next"
import { Suspense } from "react"
import { PublicVerify } from "@/components/views/public-verify"

export const metadata: Metadata = {
  title: "Stamp verification",
  description: "Details of an electronic stamp made with eStamp.",
  robots: { index: false },
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <PublicVerify />
    </Suspense>
  )
}
