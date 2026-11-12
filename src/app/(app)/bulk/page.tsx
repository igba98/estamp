import type { Metadata } from "next"
import { Bulk } from "@/components/views/bulk"

export const metadata: Metadata = { title: "Bulk stamping" }

export default function Page() {
  return <Bulk />
}
