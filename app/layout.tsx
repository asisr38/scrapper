import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'FAO Gender Dashboard',
  description: 'Visualize FAO Gender scraped data',
}

export default function RootLayout({ 
  children 
}: { 
  children: React.ReactNode 
}) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900">{children}</body>
    </html>
  )
}


