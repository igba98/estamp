import type { Metadata } from "next"
import { Library } from "@/components/views/library"

export const metadata: Metadata = { title: "Stamp library" }

export default function Page() {
  return <Library />
}
