import type { Metadata } from "next"
import { ContactForm } from "@/components/views/contact"

export const metadata: Metadata = {
  title: "Contact",
  description: "Send the eStamp team a message.",
}

export default function Page() {
  return <ContactForm />
}
