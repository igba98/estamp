import type { Metadata, Viewport } from "next"
import "./globals.css"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Toaster } from "@/components/ui/sonner"

export const metadata: Metadata = {
  title: { default: "eStamp", template: "%s · eStamp" },
  description: "Create electronic stamps and stamp PDF, Word and image documents in seconds. Server-verified QR codes, a mail register and team approvals.",
}

export const viewport: Viewport = {
  themeColor: "#0f0f11",
  colorScheme: "dark",
  viewportFit: "cover",
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="dark h-full antialiased">
      <body className="min-h-full">
        <TooltipProvider delay={350}>
          {children}
          <Toaster position="bottom-right" />
        </TooltipProvider>
      </body>
    </html>
  )
}
