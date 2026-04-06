import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Merkur',
  description: 'Your knowledge, remembered.',
  icons: { icon: '/favicon.svg' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-stone-50 text-stone-900 antialiased">{children}</body>
    </html>
  )
}
