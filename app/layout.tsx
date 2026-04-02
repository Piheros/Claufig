import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Spec → Figma · Polaris DS',
  description: 'Claude Code × Figma MCP — spec to mockup in seconds',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  )
}
