import { NextRequest, NextResponse } from 'next/server'
import fs from 'node:fs/promises'
import path from 'node:path'

type Row = {
  section?: string
  category?: string
  title?: string
  date?: string
  date_iso?: string
  year?: number | string
  month?: number | string
  url?: string
  summary?: string
}

type JsonPayload = {
  items?: Row[]
}

function toYmLabel(r: Row): string {
  const di = (r.date_iso || '').trim()
  if (di) {
    const [y, m] = di.split('-')
    if (y && m) return `${y}-${m}`
  }
  const y = String(r.year || '').trim()
  const m = String(r.month || '').trim()
  if (/^\d+$/.test(y) && /^\d+$/.test(m)) {
    const yi = parseInt(y, 10)
    const mi = parseInt(m, 10)
    return `${yi.toString().padStart(4, '0')}-${mi.toString().padStart(2, '0')}`
  }
  return 'Unknown'
}

function sortYmLabels(labels: string[]): string[] {
  return Array.from(new Set(labels)).sort((a, b) => {
    const ka = a === 'Unknown' ? 0 : parseInt(a.replace('-', ''), 10)
    const kb = b === 'Unknown' ? 0 : parseInt(b.replace('-', ''), 10)
    return ka - kb
  })
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const csvParam = url.searchParams.get('csv') || ''
  // Resolve JSON path: query > env > public fallback > repo root default
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

  let usedPaths: string[] = []
  let rowsMerged: Row[] = []

  async function tryRead(pathStr: string): Promise<Row[] | null> {
    try {
      const raw = await fs.readFile(pathStr, 'utf-8')
      const parsed: JsonPayload = JSON.parse(raw)
      const arr = Array.isArray(parsed.items) ? parsed.items : []
      if (arr.length > 0) return arr
      return []
    } catch {
      return null
    }
  }

  if (csvParam) {
    const arr = await tryRead(csvParam)
    if (arr) {
      usedPaths.push(csvParam)
      rowsMerged = rowsMerged.concat(arr)
    }
  } else if (envJson) {
    const arr = await tryRead(envJson)
    if (arr) {
      usedPaths.push(envJson)
      rowsMerged = rowsMerged.concat(arr)
    }
  } else {
    for (const p of defaultPublicPaths) {
      const arr = await tryRead(p)
      if (arr) {
        usedPaths.push(p)
        rowsMerged = rowsMerged.concat(arr)
      }
    }
  }

  if (rowsMerged.length === 0) {
    return NextResponse.json({
      csv_path: usedPaths.join(', '),
      total: 0,
      by_category: [],
      by_section: [],
      by_year_month: { labels: [], counts: [] },
      monthly_by_section: { labels: [], series: {} },
      facets: { sections: [], categories: [] },
    })
  }
  const rows = rowsMerged

  // Filters
  let fSection = (url.searchParams.get('section') || '').trim().toLowerCase()
  let fCategory = (url.searchParams.get('category') || '').trim().toLowerCase()
  const fQ = (url.searchParams.get('q') || '').trim().toLowerCase()
  const fStart = (url.searchParams.get('startYm') || '').trim()
  const fEnd = (url.searchParams.get('endYm') || '').trim()

  if (fSection === 'all') fSection = ''
  if (fCategory === 'all') fCategory = ''

  const allSections = Array.from(new Set(rows.map(r => (r.section || '').trim()).filter(Boolean))).sort()
  const allCategories = Array.from(new Set(rows.map(r => (r.category || '').trim()).filter(Boolean))).sort()

  function withinYmRange(lbl: string): boolean {
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
      const blob = `${r.title || ''} ${r.summary || ''}`.toLowerCase()
      if (!blob.includes(fQ)) return false
    }
    const ym = toYmLabel(r)
    if (!withinYmRange(ym)) return false
    return true
  })

  const byCategory = new Map<string, number>()
  const bySection = new Map<string, number>()
  const ymList: string[] = []

  for (const r of filtered) {
    const cat = (r.category || 'Uncategorized').trim() || 'Uncategorized'
    byCategory.set(cat, (byCategory.get(cat) || 0) + 1)
    const sec = (r.section || 'unknown').trim() || 'unknown'
    bySection.set(sec, (bySection.get(sec) || 0) + 1)
    ymList.push(toYmLabel(r))
  }

  const ymCounts = new Map<string, number>()
  for (const l of ymList) ymCounts.set(l, (ymCounts.get(l) || 0) + 1)
  const ymLabels = sortYmLabels(Array.from(ymCounts.keys()))

  // Monthly by section series (stacked)
  const sectionKeys = Array.from(bySection.keys()).sort()
  const series: Record<string, number[]> = {}
  for (const s of sectionKeys) series[s] = ymLabels.map(() => 0)
  for (const r of filtered) {
    const sec = (r.section || 'unknown').trim() || 'unknown'
    const ym = toYmLabel(r)
    const idx = ymLabels.indexOf(ym)
    if (idx >= 0) series[sec][idx] = (series[sec][idx] || 0) + 1
  }

  return NextResponse.json({
    csv_path: usedPaths.join(', '),
    total: filtered.length,
    by_category: Array.from(byCategory.entries()).sort((a, b) => b[1] - a[1]).map(([label, count]) => ({ label, count })),
    by_section: Array.from(bySection.entries()).sort((a, b) => b[1] - a[1]).map(([label, count]) => ({ label, count })),
    by_year_month: { labels: ymLabels, counts: ymLabels.map(l => ymCounts.get(l) || 0) },
    monthly_by_section: { labels: ymLabels, series },
    facets: { sections: allSections, categories: allCategories },
  })
}


