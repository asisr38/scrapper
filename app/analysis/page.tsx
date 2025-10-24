"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ResponsiveContainer as RResponsiveContainer, BarChart as RBarChart, Bar as RBar, CartesianGrid as RCartesianGrid, XAxis as RXAxis, YAxis as RYAxis, Tooltip as RTooltip, LabelList as RLabelList } from 'recharts';

type UpdatedDoc = {
  title: string;
  url: string;
  region?: string;
  summary: string;
  vibe_feel?: { tone?: string[]; mood?: string; style?: string };
  keywords?: string[];
  categories?: { primary?: string[]; secondary?: string[] };
  category_keywords_matched?: Record<string, string[]>;
  type?: string;
  sentiment?: { overall?: string; emotional_intensity?: string; themes?: string[] };
};

const exampleJson = `{
  "title": "The status of women in agrifood systems",
  "url": "https://openknowledge.fao.org/server/api/core/bitstreams/25d966ab-6cc0-4ea7-8340-1ecaa4293c79/content",
  "region": "Global (with emphasis on sub-Saharan Africa)",
  "summary": "This report examines the role of women across agrifood systems globally — including production, processing, distribution, trade and consumption — with particular emphasis on sub-Saharan Africa...",
  "vibe_feel": {
    "tone": ["analytical", "evidence-based", "urgent", "advocacy-oriented"],
    "mood": "serious yet hopeful – acknowledging entrenched structural barriers while charting pathways forward",
    "style": "formal global report with strong policy framing, data-driven narrative and call to action"
  },
  "keywords": ["women", "agrifood systems", "sub-Saharan Africa", "value chains"],
  "categories": {
    "primary": [
      "Gender and inclusive food systems and value chains",
      "Gender equality and women's empowerment",
      "Gender statistics and sex-disaggregated data"
    ],
    "secondary": ["Gender and decent rural employment and child labour"]
  },
  "category_keywords_matched": {
    "Gender and inclusive food systems and value chains": ["agrifood systems", "value chain", "processing", "trade", "distribution"],
    "Gender equality and women's empowerment": ["women", "gender gap", "empowerment", "participation"],
    "Gender statistics and sex-disaggregated data": ["data", "sex-disaggregated", "indicator", "survey"],
    "Gender and decent rural employment and child labour": ["employment", "informal", "vulnerable work", "rural"]
  },
  "type": "Global policy report / Gender and food systems / Development study",
  "sentiment": {
    "overall": "cautiously optimistic",
    "emotional_intensity": "high-moderate",
    "themes": ["gender inequality", "economic empowerment", "structural reform", "policy action", "data-driven change"]
  }
}`;

export default function AnalysisPage() {
  const [src, setSrc] = useState<string>('');
  const [raw, setRaw] = useState<string>('');
  const [doc, setDoc] = useState<UpdatedDoc | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [autoParse, setAutoParse] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);
  const [showEditor, setShowEditor] = useState<boolean>(false);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    const url = new URL(window.location.href);
    const s = url.searchParams.get('src') || '';
    if (s) {
      setSrc(s);
      handleFetch(s);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFetch = async (inputUrl: string) => {
    const u = (inputUrl || src || '').trim();
    if (!u) return;
    setLoading(true);
    setError(null);
    setDoc(null);
    try {
      const res = await fetch(u);
      if (!res.ok) throw new Error(`Failed to fetch (${res.status})`);
      const data = await res.json();
      setDoc(data as UpdatedDoc);
      setRaw(JSON.stringify(data, null, 2));
      setShowEditor(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load JSON');
    } finally {
      setLoading(false);
    }
  };

  const handleParse = () => {
    try {
      const parsed = JSON.parse(raw) as UpdatedDoc;
      setDoc(parsed);
      setError(null);
    } catch (e) {
      setError('Invalid JSON');
    }
  };

  useEffect(() => {
    if (!autoParse) return;
    if (!raw.trim()) {
      setError(null);
      return;
    }
    try {
      const parsed = JSON.parse(raw) as UpdatedDoc;
      setDoc(parsed);
      setError(null);
    } catch {
      setError('Invalid JSON');
    }
  }, [raw, autoParse]);

  const handleCopyRaw = useCallback(async () => {
    if (!raw) return;
    try {
      await navigator.clipboard.writeText(raw);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch (e) {
      setError('Unable to copy to clipboard');
    }
  }, [raw]);

  const handleDownloadRaw = useCallback(() => {
    if (!raw) return;
    const blob = new Blob([raw], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'analysis.json';
    a.click();
    URL.revokeObjectURL(url);
  }, [raw]);

  const handleFileChange = useCallback((file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : '';
      setRaw(text);
      setShowEditor(true);
    };
    reader.onerror = () => setError('Failed to read file');
    reader.readAsText(file);
  }, []);

  const catBarData = useMemo(() => {
    const mapping = doc?.category_keywords_matched || {};
    const entries = Object.entries(mapping).map(([label, arr]) => ({ label, value: Array.isArray(arr) ? arr.length : 0 }));
    const sorted = [...entries].sort((a, b) => sortDir === 'desc' ? b.value - a.value : a.value - b.value);
    return sorted;
  }, [doc, sortDir]);

  const maxBarValue = useMemo(() => {
    return catBarData.reduce((m, d) => Math.max(m, d.value), 0);
  }, [catBarData]);

  const formatCategoryTick = useCallback((value: string) => {
    if (!value) return '';
    return value.length > 36 ? value.slice(0, 33) + '…' : value;
  }, []);

  const overallToScore = useCallback((overall?: string) => {
    if (!overall) return 50;
    const o = overall.toLowerCase();
    if (o.includes('strongly') && o.includes('positive')) return 90;
    if (o.includes('very') && o.includes('positive')) return 85;
    if (o.includes('positive') || o.includes('optimistic')) return o.includes('cautious') ? 62 : 75;
    if (o.includes('neutral') || o.includes('mixed')) return 50;
    if (o.includes('pessim')) return 35;
    if (o.includes('negative')) return 25;
    return 55;
  }, []);

  const intensityToBadge = useCallback((intensity?: string) => {
    if (!intensity) return { label: '—', cls: 'bg-muted text-muted-foreground' };
    const s = intensity.toLowerCase();
    if (s.includes('very') || s.includes('extreme')) return { label: intensity, cls: 'bg-rose-100 text-rose-800' };
    if (s.includes('high')) return { label: intensity, cls: 'bg-amber-100 text-amber-800' };
    if (s.includes('moderate')) return { label: intensity, cls: 'bg-sky-100 text-sky-800' };
    return { label: intensity, cls: 'bg-zinc-100 text-zinc-700' };
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-xl sm:text-2xl">Analysis</CardTitle>
            <CardDescription>Load updated JSON and visualize insights</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
              <div className="lg:col-span-8">
                <Label htmlFor="json-url" className="text-[13px] sm:text-sm font-medium">JSON URL</Label>
                <div className="mt-1 flex gap-2">
                  <Input
                    id="json-url"
                    value={src}
                    onChange={(e)=>setSrc(e.target.value)}
                    onKeyDown={(e)=>{ if (e.key === 'Enter') handleFetch(src); }}
                    placeholder="https://example.com/data.json"
                    aria-label="JSON URL"
                  />
                  <Button onClick={()=>handleFetch(src)} disabled={loading} aria-label="Fetch JSON">{loading ? 'Loading…' : 'Fetch'}</Button>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Paste a direct link to a JSON file. We will parse and visualize it.</p>
              </div>
              <div className="lg:col-span-4">
                <Label htmlFor="quickload" className="text-[13px] sm:text-sm font-medium">Quick actions</Label>
                <div className="mt-1 flex flex-wrap gap-2">
                  <Button variant="outline" onClick={()=>{ setRaw(exampleJson); setShowEditor(true); }} aria-label="Load example">Load example</Button>
                  <label className="inline-flex">
                    <input
                      type="file"
                      accept="application/json,.json"
                      className="sr-only"
                      onChange={(e)=>handleFileChange(e.target.files?.[0] || null)}
                      aria-label="Upload JSON file"
                    />
                    <span
                      role="button"
                      tabIndex={0}
                      className="inline-flex items-center justify-center whitespace-nowrap rounded-md border border-input bg-background px-3 py-2 text-sm font-medium shadow-sm hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 cursor-pointer"
                      onKeyDown={(e)=>{ if (e.key === 'Enter' || e.key === ' ') (e.currentTarget.previousSibling as HTMLInputElement)?.click(); }}
                      onClick={(e)=>{ (e.currentTarget.previousSibling as HTMLInputElement)?.click(); }}
                      aria-label="Upload JSON file"
                    >Upload</span>
                  </label>
                </div>
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert" aria-live="polite">
                <span className="mt-0.5">{error}</span>
              </div>
            )}

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-input"
                    checked={autoParse}
                    onChange={(e)=>setAutoParse(e.target.checked)}
                    aria-label="Auto-parse JSON"
                  />
                  <span>Auto-parse</span>
                </label>
                <Button variant="ghost" onClick={()=>setShowEditor((v)=>!v)} aria-label="Toggle JSON editor">
                  {showEditor ? 'Hide editor' : 'Show editor'}
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={handleCopyRaw} disabled={!raw} aria-label="Copy JSON">
                  {copied ? 'Copied' : 'Copy JSON'}
                </Button>
                <Button variant="outline" onClick={handleDownloadRaw} disabled={!raw} aria-label="Download JSON">Download</Button>
                {src && (
                  <Button
                    variant="outline"
                    onClick={async ()=>{
                      try {
                        const url = new URL(window.location.href);
                        url.searchParams.set('src', src);
                        await navigator.clipboard.writeText(url.toString());
                        setCopied(true);
                        window.setTimeout(()=>setCopied(false), 1200);
                      } catch {
                        setError('Unable to copy shareable link');
                      }
                    }}
                    aria-label="Copy shareable link"
                  >Share link</Button>
                )}
              </div>
            </div>

            {showEditor && (
              <div>
                <Label htmlFor="json-raw" className="text-[13px] sm:text-sm font-medium">Raw JSON</Label>
                <textarea
                  id="json-raw"
                  className="mt-1 w-full h-56 rounded-md border border-input bg-background p-3 font-mono text-xs"
                  value={raw}
                  onChange={(e)=>setRaw(e.target.value)}
                  aria-label="Raw JSON"
                />
                {!autoParse && (
                  <div className="mt-2">
                    <Button variant="outline" onClick={handleParse} aria-label="Parse JSON">Parse</Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {loading && (
          <div className="space-y-6" aria-busy>
            <Card>
              <CardHeader>
                <div className="h-5 w-2/3 rounded-md bg-muted animate-pulse" />
                <div className="mt-2 h-4 w-1/3 rounded-md bg-muted animate-pulse" />
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="h-3 w-full rounded-md bg-muted animate-pulse" />
                  <div className="h-3 w-11/12 rounded-md bg-muted animate-pulse" />
                  <div className="h-3 w-10/12 rounded-md bg-muted animate-pulse" />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <span key={i} className="h-5 w-16 rounded-full bg-muted animate-pulse" />
                  ))}
                </div>
              </CardContent>
            </Card>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {Array.from({ length: 2 }).map((_, i) => (
                <Card key={i}>
                  <CardHeader className="pb-2">
                    <div className="h-4 w-40 rounded-md bg-muted animate-pulse" />
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {Array.from({ length: 6 }).map((_, j) => (
                        <span key={j} className="h-5 w-24 rounded-full bg-muted animate-pulse" />
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            <Card>
              <CardHeader className="pb-2">
                <div className="h-4 w-56 rounded-md bg-muted animate-pulse" />
              </CardHeader>
              <CardContent>
                <div className="h-[16rem] rounded-md bg-muted animate-pulse" />
              </CardContent>
            </Card>
          </div>
        )}

        {!loading && !doc && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Get started</CardTitle>
              <CardDescription>Fetch a JSON URL, upload a file, or paste raw JSON to see insights here.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground">No data loaded yet.</div>
            </CardContent>
          </Card>
        )}

        {!loading && doc && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-xl font-semibold">{doc.title}</CardTitle>
                <CardDescription>
                  <a href={doc.url} target="_blank" rel="noreferrer noopener" className="underline underline-offset-4 hover:text-primary" aria-label="Open source document">Open source</a>
                  {doc.region && <span className="ml-2 text-muted-foreground">• {doc.region}</span>}
                  {doc.type && <span className="ml-2 text-muted-foreground">• {doc.type}</span>}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{doc.summary}</p>
                {Array.isArray(doc.keywords) && doc.keywords.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {doc.keywords.map((k, i) => (
                      <span key={i} className="px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-700 text-xs">{k}</span>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold">Primary Categories</CardTitle>
                </CardHeader>
                <CardContent>
                  {Array.isArray(doc.categories?.primary) && doc.categories!.primary!.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {doc.categories!.primary!.map((c, i)=> (
                        <span key={i} className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs">{c}</span>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">No primary categories.</div>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold">Secondary Categories</CardTitle>
                </CardHeader>
                <CardContent>
                  {Array.isArray(doc.categories?.secondary) && doc.categories!.secondary!.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {doc.categories!.secondary!.map((c, i)=> (
                        <span key={i} className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-xs">{c}</span>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">No secondary categories.</div>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="text-base font-semibold">Category keyword matches</CardTitle>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      aria-label="Toggle sort direction"
                      onClick={()=> setSortDir((d)=> d === 'desc' ? 'asc' : 'desc')}
                    >{sortDir === 'desc' ? 'Sort: High→Low' : 'Sort: Low→High'}</Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {catBarData.length > 0 ? (
                  <div className="h-[16rem]">
                    <RResponsiveContainer width="100%" height="100%">
                      <RBarChart data={catBarData} layout="vertical" margin={{ left: 12, right: 16 }}>
                        <defs>
                          <linearGradient id="barGradient" x1="0" x2="1" y1="0" y2="0">
                            <stop offset="0%" stopColor="#60a5fa" />
                            <stop offset="50%" stopColor="#34d399" />
                            <stop offset="100%" stopColor="#f59e0b" />
                          </linearGradient>
                        </defs>
                        <RCartesianGrid horizontal={false} />
                        <RYAxis dataKey="label" type="category" tickLine={false} tickMargin={10} axisLine={false} width={160} tickFormatter={formatCategoryTick} />
                        <RXAxis dataKey="value" type="number" allowDecimals={false} domain={[0, Math.max(1, maxBarValue)]} />
                        <RTooltip formatter={(v: any)=>[String(v), 'Matches']} />
                        <RBar dataKey="value" radius={4} fill="url(#barGradient)">
                          <RLabelList dataKey="value" position="right" />
                        </RBar>
                      </RBarChart>
                    </RResponsiveContainer>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">No category keyword matches found.</div>
                )}
              </CardContent>
            </Card>

            {(doc.vibe_feel || doc.sentiment) && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold">Tone and Sentiment</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 gap-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="md:col-span-2">
                        <div className="text-sm text-muted-foreground">Overall sentiment</div>
                        <div className="mt-2 rounded-md border border-input p-3">
                          {(() => {
                            const score = overallToScore(doc.sentiment?.overall);
                            const label = doc.sentiment?.overall || '—';
                            return (
                              <div className="relative">
                                <div className="h-3 w-full rounded-full bg-muted" aria-hidden />
                                <div
                                  className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-rose-400 via-amber-400 to-emerald-500"
                                  style={{ width: `${score}%` }}
                                  role="meter"
                                  aria-valuenow={score}
                                  aria-valuemin={0}
                                  aria-valuemax={100}
                                  aria-label="Sentiment score"
                                />
                                <div className="mt-3 text-sm">
                                  <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700">{label}</span>
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                        <div className="mt-3 text-xs text-muted-foreground">Left = negative, middle = neutral, right = positive</div>
                      </div>
                      <div className="md:col-span-1">
                        <div className="text-sm text-muted-foreground">Emotional intensity</div>
                        <div className="mt-2">
                          {(() => {
                            const b = intensityToBadge(doc.sentiment?.emotional_intensity);
                            return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs ${b.cls}`}>{b.label}</span>;
                          })()}
                        </div>
                        <div className="mt-4 text-sm text-muted-foreground">Mood</div>
                        <div className="mt-1 text-sm">{doc.vibe_feel?.mood || '—'}</div>
                        <div className="mt-4 text-sm text-muted-foreground">Style</div>
                        <div className="mt-1 text-sm">{doc.vibe_feel?.style || '—'}</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div>
                        <div className="text-muted-foreground">Tone</div>
                        <div className="mt-1 flex flex-wrap gap-2">
                          {(doc.vibe_feel?.tone || []).map((t, i)=>(
                            <span key={i} className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 text-xs">{t}</span>
                          ))}
                        </div>
                      </div>
                      <div className="md:col-span-2">
                        <div className="text-muted-foreground">Themes</div>
                        <div className="mt-1 flex flex-wrap gap-2">
                          {(doc.sentiment?.themes || []).map((t, i)=>(
                            <span key={i} className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-xs">{t}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}


