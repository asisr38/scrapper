import { NextRequest, NextResponse } from 'next/server'
import fs from 'node:fs/promises'
import path from 'node:path'

type Row = {
  section?: string
  category?: string
  title?: string
  date?: string
  date_iso?: string
  url?: string
  summary?: string
}

type JsonPayload = {
  items?: Row[]
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
  const csvParam = url.searchParams.get('csv') || ''
  const limit = Math.max(1, Math.min(500, parseInt(url.searchParams.get('limit') || '20', 10)))
  const offset = Math.max(0, parseInt(url.searchParams.get('offset') || '0', 10))
  const envJson = process.env.JSON_PATH || ''
  const root = path.resolve(process.cwd(), '..')
  const defaultJson = path.join(root, 'fao_gender_output.json')
  const publicDir = path.join(process.cwd(), 'public')
  // Default set of known public datasets we can merge if present
  const defaultPublicPaths = [
    path.join(publicDir, 'news.json'),
    path.join(publicDir, 'insights.json'),
    path.join(publicDir, 'success-stories.json'),
    path.join(publicDir, 'e-learning.json'),
    path.join(publicDir, 'publications.json'),
    path.join(publicDir, 'output', 'news.json'),
  ]

  let rows: Row[] = []
  async function tryRead(pathStr: string): Promise<Row[] | null> {
    try {
      if (/^https?:\/\//i.test(pathStr)) {
        const res = await fetch(pathStr)
        if (!res.ok) return null
        const parsed: JsonPayload = await res.json()
        const arr = Array.isArray(parsed.items) ? parsed.items : []
        return arr
      } else {
        const raw = await fs.readFile(pathStr, 'utf-8')
        const parsed: JsonPayload = JSON.parse(raw)
        const arr = Array.isArray(parsed.items) ? parsed.items : []
        return arr
      }
    } catch {
      return null
    }
  }

  if (csvParam) {
    const arr = await tryRead(csvParam)
    if (arr) rows = rows.concat(arr)
  } else if (envJson) {
    const arr = await tryRead(envJson)
    if (arr) rows = rows.concat(arr)
  } else {
    for (const p of defaultPublicPaths) {
      const arr = await tryRead(p)
      if (arr) rows = rows.concat(arr)
    }
  }

  if (rows.length === 0) return NextResponse.json({ total: 0, items: [] })

  // Filters
  let fSection = (url.searchParams.get('section') || '').trim().toLowerCase()
  let fCategory = (url.searchParams.get('category') || '').trim().toLowerCase()
  const fQ = (url.searchParams.get('q') || '').trim().toLowerCase()
  const fStart = (url.searchParams.get('startYm') || '').trim()
  const fEnd = (url.searchParams.get('endYm') || '').trim()

  if (fSection === 'all') fSection = ''
  if (fCategory === 'all') fCategory = ''

  function withinYmRange(dateIso: string): boolean {
    const lbl = (dateIso || '').slice(0, 7) || 'Unknown'
    if (!fStart && !fEnd) return true
    if (lbl === 'Unknown') return false
    const key = (s: string) => s.replace('-', '')
    if (fStart && key(lbl) < key(fStart)) return false
    if (fEnd && key(lbl) > key(fEnd)) return false
    return true
  }

  const filtered = rows.filter(r => {
    if (fSection && (r.section || '').trim().toLowerCase() !== fSection) return false
    if (fCategory && (r.category || '').trim().toLowerCase() !== fCategory) return false
    if (fQ) {
      const blob = `${r.title || ''}`.toLowerCase()
      if (!blob.includes(fQ)) return false
    }
    if (!withinYmRange(String((r as any).date_iso || ''))) return false
    return true
  })

  const sorted = filtered.sort((a, b) => {
    const ai = (a.date_iso || '').replace(/-/g, '')
    const bi = (b.date_iso || '').replace(/-/g, '')
    const an = parseInt(ai || '0', 10)
    const bn = parseInt(bi || '0', 10)
    if (an !== bn) return bn - an
    const at = (a.title || '').toLowerCase()
    const bt = (b.title || '').toLowerCase()
    return at.localeCompare(bt)
  }).slice(offset, offset + limit)

  function makeShortSummary(s: string): string {
    const text = (s || '').trim()
    if (!text) return ''
    const limit = 240
    if (text.length <= limit) return text
    return text.slice(0, limit - 1).trimEnd() + '…'
  }

  const compact = sorted.map(r => {
    const summary = String((r as any).summary || '')
    return {
      section: String((r as any).section || ''),
      category: String((r as any).category || ''),
      title: String((r as any).title || ''),
      date: String((r as any).date || ''),
      url: String((r as any).url || ''),
      summary,
      shortSummary: makeShortSummary(summary || String((r as any).title || '')),
    }
  })

  return NextResponse.json({ total: filtered.length, items: compact })
  } catch (error) {
    console.error('Error in items API:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
        total: 0,
        items: []
      },
      { status: 500 }
    )
  }
}


