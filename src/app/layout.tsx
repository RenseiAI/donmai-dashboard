import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'AgentFactory',
  description: 'Multi-agent fleet management for coding agents',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased">{children}</body>
    </html>
  )
}
