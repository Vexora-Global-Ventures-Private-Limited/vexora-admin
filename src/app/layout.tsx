import type { Metadata } from "next"
import { Geist, Geist_Mono, Inter, JetBrains_Mono, Playfair_Display, Space_Grotesk } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import { AdminSessionHydrator } from "@/components/admin/session-hydrator"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  style: ["normal", "italic"],
})

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
})

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
})

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
})

// Admin portal: no anonymous surface, no SEO — see caveman/docs/07-Frontend.md §2.2.
export const metadata: Metadata = {
  title: "VXA — Vexora Admin",
  description: "Vexora operations console — approve, verify, publish, monitor.",
  robots: { index: false, follow: false, nocache: true },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className={`${geistSans.variable} ${geistMono.variable} ${playfair.variable} ${inter.variable} ${jetbrainsMono.variable} ${spaceGrotesk.variable} antialiased bg-brand-tertiary text-brand-secondary min-h-screen font-sans`}
      >
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
          <AdminSessionHydrator />
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  )
}
