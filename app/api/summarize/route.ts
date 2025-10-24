import { NextRequest, NextResponse } from 'next/server'
export const runtime = 'nodejs'
import * as cheerio from 'cheerio'

type SummarizeRequest = {
  url?: string
  agent?: boolean
}

type SummarizeResponse = {
  title: string
  url: string
  summary: string
  category: string
  method: 'heuristic' | 'agent'
}

const normalizeSpace = (text: string): string => {
  const s = String(text || '')
  if (!s.trim()) return ''
  return s.replace(/\s+/g, ' ').trim()
}

const extractMainText = (html: string): string => {
  const $ = cheerio.load(html)
  $('script, style, nav, header, footer, aside, form, noscript, div.share, div.social, ul.share-buttons').remove()

  const candidateSelectors = [
    'article', 'main article', 'main .article', 'div.article', 'div.article-content',
    'div.entry-content', 'div#content', 'main', 'section.content', 'div.content',
    'div.text', 'div#main-content',
  ]

  let best = ''
  let bestLen = 0
  for (const sel of candidateSelectors) {
    const node = $(sel).first()
    if (!node || node.length === 0) continue
    const parts: string[] = []
    node.find('p, li').each((_i: number, el: any) => {
      const t = $(el).text()
      if (t && t.trim()) parts.push(normalizeSpace(t))
    })
    const text = parts.join('\n')
    if (text.length > bestLen) {
      best = text
      bestLen = text.length
    }
  }
  if (!best) {
    const parts: string[] = []
    $('p').each((_i: number, el: any) => {
      const t = $(el).text()
      if (t && t.trim()) parts.push(normalizeSpace(t))
    })
    best = parts.join('\n')
  }
  return normalizeSpace(best)
}

const summarizeExtractive = (text: string, maxSentences = 5): string => {
  const body = normalizeSpace(text)
  if (!body) return ''
  const sentences = body.split(/(?<=[\.!?])\s+/).map(s => s.trim()).filter(Boolean)
  if (sentences.length <= maxSentences) return sentences.join(' ')
  const stop = new Set(
    `a an the and or but if while of for on in at to from by with as is are was were be been being this that those these it its they them their we our you your he she his her not no yes do does did`.split(/\s+/)
  )
  const words = (body.toLowerCase().match(/[a-z']+/g) || [])
  const freq: Record<string, number> = {}
  for (const w of words) {
    if (stop.has(w) || w.length <= 2) continue
    freq[w] = (freq[w] || 0) + 1
  }
  const scored = sentences.map((s, i) => {
    const score = (s.toLowerCase().match(/[a-z']+/g) || []).reduce((a, w) => a + (freq[w] || 0), 0)
    return { i, score }
  })
  scored.sort((a, b) => b.score - a.score)
  const top = scored.slice(0, maxSentences).map(x => x.i).sort((a, b) => a - b)
  return top.map(i => sentences[i]).join(' ')
}

const categorize = (title: string, summary: string): string => {
  const text = `${title} ${summary}`.toLowerCase()
  const areas: Array<[string, Array<[string, number]>]> = [
    ['Gender in fisheries and aquaculture', [
      ['fisheries', 3], ['aquaculture', 3], ['fisher', 2], ['fishing', 2],
      ['fish value chain', 4], ['marine', 2], ['coastal', 2], ['seafood', 2],
    ]],
    ['Gender in forestry and agroforestry', [
      ['forestry', 3], ['forest', 2], ['agroforestry', 3], ['woodlot', 3],
      ['non-timber forest', 4], ['ntfp', 3], ['timber', 2], ['deforestation', 2],
    ]],
    ['Gender and livestock', [
      ['livestock', 3], ['pastoral', 3], ['pastoralist', 3], ['herd', 2],
      ['animal health', 4], ['small ruminant', 4], ['cattle', 2], ['goat', 2],
      ['sheep', 2], ['poultry', 2], ['dairy', 2],
    ]],
    ['Gender and plant production and protection', [
      ['plant production', 4], ['crop', 2], ['crop production', 4],
      ['plant protection', 4], ['ipm', 3], ['integrated pest', 4],
      ['seed', 2], ['agronomy', 3], ['plant health', 4], ['pesticide', 2],
    ]],
    ['Gender and innovative and labour-saving technologies', [
      ['innovation', 2], ['innovative', 2], ['technology', 2], ['technologies', 2],
      ['labour-saving', 4], ['labor-saving', 4], ['mechanization', 3],
      ['mechanisation', 3], ['tools', 2], ['equipment', 2], ['digital', 2],
      ['ict', 3], ['mobile', 2], ['app', 2],
    ]],
    ['Gender and land and water', [
      ['land tenure', 4], ['land rights', 4], ['land', 2], ['water', 2],
      ['irrigation', 3], ['watershed', 3], ['water management', 4],
      ['land governance', 4], ['tenure', 3], ['property rights', 3],
    ]],
    ['Gender and climate change, agroecology and biodiversity', [
      ['climate', 2], ['climate change', 4], ['agroecology', 4],
      ['biodiversity', 3], ['mitigation', 3], ['adaptation', 3],
      ['emissions', 3], ['ecosystem', 3], ['nature-based', 4],
      ['carbon', 2], ['greenhouse', 2], ['sustainability', 2],
    ]],
    ['Gender and emergencies and resilience building', [
      ['emergency', 3], ['humanitarian', 3], ['crisis', 3], ['conflict', 3],
      ['resilience', 3], ['shock', 3], ['disaster', 3], ['drm', 4],
      ['risk management', 4], ['recovery', 2], ['relief', 2],
    ]],
    ['Gender-based violence and protection from sexual exploitation and abuse', [
      ['gender-based violence', 4], ['gbv', 4], ['violence', 3],
      ['protection from sexual exploitation and abuse', 5], ['psea', 4],
      ['harassment', 3], ['safeguarding', 3], ['abuse', 3],
    ]],
    ['Gender and rural financial services', [
      ['finance', 2], ['financial services', 4], ['microfinance', 4],
      ['credit', 3], ['loans', 3], ['savings', 3], ['remittances', 3],
      ['banking', 2], ['financial inclusion', 4],
    ]],
    ['Gender and decent rural employment and child labour', [
      ['decent work', 4], ['decent employment', 4], ['rural employment', 4],
      ['child labour', 4], ['child labor', 4], ['occupational safety', 4],
      ['oshea', 4], ['youth employment', 4], ['job', 2], ['workplace', 2],
    ]],
    ['Gender and investment in sustainable agrifood systems', [
      ['investment', 3], ['invest', 3], ['sustainable agrifood', 4],
      ['infrastructure', 3], ['capital', 3], ['financing', 3],
      ['public investment', 4], ['private investment', 4], ['funding', 2],
    ]],
    ['Gender and rural advisory services', [
      ['extension', 3], ['advisory services', 4], ['rural advisory', 4],
      ['farmer field school', 4], ['ffs', 4], ['capacity development', 4],
      ['training', 2], ['education', 2], ['knowledge transfer', 3],
    ]],
    ['Gender-sensitive social protection', [
      ['social protection', 4], ['cash transfer', 4], ['safety net', 4],
      ['social assistance', 4], ['insurance', 3], ['public works', 3],
      ['welfare', 2], ['benefits', 2],
    ]],
    ['Gender-responsive policy making and budgeting', [
      ['policy', 2], ['policies', 2], ['policy-making', 4], ['policy making', 4],
      ['budget', 3], ['budgeting', 3], ['gender-responsive budget', 5],
      ['grb', 4], ['governance', 2], ['regulation', 2], ['legislation', 2],
      ['law', 2], ['legal', 2],
    ]],
    ['Gender statistics and sex-disaggregated data', [
      ['sex-disaggregated', 4], ['sex disaggregated', 4], ['gender statistics', 4],
      ['disaggregated data', 4], ['indicator', 3], ['survey', 3],
      ['census', 3], ['data collection', 4], ['gender data', 4],
      ['statistics', 2], ['metrics', 2],
    ]],
    ['Gender and food security and nutrition', [
      ['food security', 4], ['nutrition', 3], ['malnutrition', 4],
      ['diet', 2], ['food systems', 3], ['household food', 4],
      ['nutritious', 2], ['hunger', 2], ['stunting', 3], ['wasting', 3],
    ]],
    ['Gender and inclusive food systems and value chains', [
      ['inclusive', 2], ['value chain', 4], ['market access', 4],
      ['agrifood', 3], ['food system', 3], ['processing', 3],
      ['marketing', 3], ['inclusive business', 4], ['trade', 2],
      ['supply chain', 3], ['distribution', 2],
    ]],
    ['Gender analysis, gender mainstreaming and the project cycle', [
      ['gender analysis', 4], ['gender mainstreaming', 4], ['mainstreaming', 3],
      ['project cycle', 4], ['logframe', 3], ['logical framework', 4],
      ['design phase', 4], ['implementation phase', 4],
      ['monitoring and evaluation', 4], ['m&e', 3], ['assessment', 2],
    ]],
    ["Gender equality and women's empowerment", [
      ['gender equality', 3], ['women', 1], ['girls', 1], ['empower', 2],
      ['empowerment', 2], ['leadership', 2], ['equity', 2], ['inclusion', 2],
      ['rights', 2], ['equal', 1], ['female', 1],
    ]],
  ]

  let best = "Gender equality and women's empowerment"
  let bestScore = 0
  for (const [label, pairs] of areas) {
    let score = 0
    for (const [kw, w] of pairs) {
      if (text.includes(kw)) {
        score += w
        if (kw.includes(' ')) score += 1
      }
    }
    if (score > bestScore) {
      bestScore = score
      best = label
    }
  }
  if (bestScore < 2) return "Gender equality and women's empowerment"
  return best
}

async function summarizeWithAgent(url: string, title: string, content: string): Promise<{ summary: string; category: string } | null> {
  const apiKey = process.env.OPENAI_API_KEY || ''
  if (!apiKey) return null
  try {
    const body = {
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are an analyst. Read an article and produce an in-depth, neutral, concise summary (150-250 words) and classify it into one FAO Gender thematic area. Respond as a compact JSON object with keys summary and category only.' },
        { role: 'user', content: `URL: ${url}\nTitle: ${title}\n\nContent:\n${content.slice(0, 12000)}` },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.2,
      max_tokens: 600,
    }
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    })
    if (!resp.ok) return null
    const data = await resp.json()
    const raw = data?.choices?.[0]?.message?.content || '{}'
    const parsed = JSON.parse(raw)
    const summary = normalizeSpace(parsed.summary || '')
    const category = normalizeSpace(parsed.category || '')
    if (!summary) return null
    return { summary, category: category || categorize(title, summary) }
  } catch {
    return null
  }
}

export async function POST(req: NextRequest) {
  try {
    const body: SummarizeRequest = await req.json().catch(() => ({}))
    const targetUrl = String(body.url || '').trim()
    const agent = Boolean(body.agent)
    if (!targetUrl || !/^https?:\/\//i.test(targetUrl)) {
      return NextResponse.json({ error: 'Invalid url' }, { status: 400 })
    }

    const res = await fetch(targetUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SummarizerBot/1.0)' } })
    if (!res.ok) {
      return NextResponse.json({ error: `Fetch failed: ${res.status}` }, { status: 502 })
    }
    const html = await res.text()
    const $ = cheerio.load(html)
    const title = normalizeSpace($('title').first().text()) || normalizeSpace($('h1').first().text()) || targetUrl
    const content = extractMainText(html)

    let summary = summarizeExtractive(content, 5)
    let category = categorize(title, summary || content)
    let method: SummarizeResponse['method'] = 'heuristic'

    if (agent) {
      const ai = await summarizeWithAgent(targetUrl, title, content)
      if (ai && ai.summary) {
        summary = ai.summary
        category = ai.category || category
        method = 'agent'
      }
    }

    const payload: SummarizeResponse = { title, url: targetUrl, summary, category, method }
    return NextResponse.json(payload)
  } catch (error) {
    console.error('Error in summarize API:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    )
  }
}


