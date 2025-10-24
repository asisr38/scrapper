import fs from 'node:fs/promises'
import path from 'node:path'

function guessKeywords(title, summary) {
  const text = `${title || ''} ${summary || ''}`.toLowerCase()
  const picks = []
  const add = (w) => { if (!picks.includes(w)) picks.push(w) }
  const dict = ['women', 'agrifood systems', 'value chains', 'gender', 'employment', 'finance', 'climate', 'land', 'data', 'policy']
  for (const k of dict) { if (text.includes(k.split(' ')[0])) add(k) }
  return picks.slice(0, 12)
}

function seedCategoryMatches(category, title, summary) {
  const c = String(category || '').trim()
  const t = String(title || '')
  const s = String(summary || '')
  const text = `${t} ${s}`.toLowerCase()
  const matches = {}
  const add = (k, term) => {
    if (!matches[k]) matches[k] = []
    matches[k].push(term)
  }
  if (c) add(c, 'category')
  if (text.includes('data')) add('Gender statistics and sex-disaggregated data', 'data')
  if (text.includes('value')) add('Gender and inclusive food systems and value chains', 'value')
  if (text.includes('employment')) add('Gender and decent rural employment and child labour', 'employment')
  if (text.includes('policy')) add('Gender-responsive policy making and budgeting', 'policy')
  if (text.includes('climate')) add('Gender and climate change, agroecology and biodiversity', 'climate')
  return matches
}

async function main() {
  const repoRoot = process.cwd()
  const inPath = path.join(repoRoot, 'public', 'publications.json')
  const outPath = path.join(repoRoot, 'public', 'publications_v2.json')

  const raw = await fs.readFile(inPath, 'utf-8')
  const parsed = JSON.parse(raw)
  const items = Array.isArray(parsed.items) ? parsed.items : []

  const v2Docs = items.map((it) => {
    const title = String(it.title || '').trim()
    const url = String(it.url || '').trim()
    const baseSummary = String(it.article_summary || it.summary || '').trim()
    const summary = baseSummary || title
    const primaryCat = String(it.category || '').trim()
    const categories = primaryCat ? { primary: [primaryCat], secondary: [] } : undefined
    const keywords = guessKeywords(title, summary)
    const category_keywords_matched = seedCategoryMatches(it.category, it.title, it.summary)
    const type = 'Publication / Gender and agrifood systems'
    return {
      title,
      url,
      summary,
      categories,
      keywords,
      category_keywords_matched,
      type,
      date: it.date,
      date_iso: it.date_iso,
    }
  })

  const output = { generated_at: new Date().toISOString(), count: v2Docs.length, items: v2Docs }
  await fs.writeFile(outPath, JSON.stringify(output, null, 2), 'utf-8')
  console.log(`Wrote ${v2Docs.length} items to ${outPath}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})


