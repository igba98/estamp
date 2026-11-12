import type { Metadata } from "next"
import { MailRegister } from "@/components/views/register"

export const metadata: Metadata = { title: "Mail register" }

export default function Page() {
  return <MailRegister />
}
