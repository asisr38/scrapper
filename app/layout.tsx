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
      <body className="bg-gray-50 text-gray-900">
        <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
            <a href="/" className="flex items-center gap-2" aria-label="Go to Home">
              <span className="inline-block w-8 h-8 rounded bg-primary/10" />
              <span className="font-semibold">FAO Gender Dashboard</span>
            </a>
            <nav className="flex items-center gap-4" aria-label="Main navigation">
              <a href="/" className="text-sm text-muted-foreground hover:text-foreground" aria-label="Home">Home</a>
              <a href="/analysis" className="text-sm text-muted-foreground hover:text-foreground" aria-label="Analysis">Analysis</a>
            </nav>
          </div>
        </header>
        {children}
      </body>
    </html>
  )
}


