"use client";

import { useEffect, useMemo, useState } from 'react';
import { Pie, PieChart as RPieChart, Label as RechartsLabel, Bar as RBar, BarChart as RBarChart, CartesianGrid as RCartesianGrid, XAxis as RXAxis, YAxis as RYAxis, LineChart as RLineChart, Line as RLine, Tooltip as RTooltip, ResponsiveContainer as RResponsiveContainer, Cell as RCell } from 'recharts';
import { ChartContainer } from '@/components/ui/chart';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ChevronDownIcon } from 'lucide-react';
import { type DateRange } from 'react-day-picker';
import { Label } from '@/components/ui/label';
import { Filter, BarChart3, PieChart, TrendingUp, FileText, Clock, Database, Search, X } from 'lucide-react';
import { formatDateRange } from 'little-date';

 

type Aggregations = {
  csv_path: string;
  total: number;
  by_category: { label: string; count: number }[];
  by_section: { label: string; count: number }[];
  by_year_month: { labels: string[]; counts: number[] };
  monthly_by_section?: { labels: string[]; series: Record<string, number[]> };
  facets?: { sections: string[]; categories: string[] };
};

type ItemsResp = {
  total: number;
  items: { section: string; category: string; title: string; date: string; url: string; summary?: string; shortSummary?: string }[];
};

const palette = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#06b6d4', '#f97316', '#84cc16', '#ec4899', '#6366f1',
];

 

export default function Page() {
  const [csvPath, setCsvPath] = useState<string>('');
  const [agg, setAgg] = useState<Aggregations | null>(null);
  const [items, setItems] = useState<ItemsResp | null>(null);
  const [filters, setFilters] = useState<{ section: string; category: string; q: string; startYm: string; endYm: string }>({ section: '', category: '', q: '', startYm: '', endYm: '' });
  const [pagination, setPagination] = useState<{ limit: number; offset: number }>({ limit: 20, offset: 0 });
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [urlInput, setUrlInput] = useState<string>('');
  const [useAgent, setUseAgent] = useState<boolean>(false);
  const [isSummarizing, setIsSummarizing] = useState<boolean>(false);
  const [summarizeError, setSummarizeError] = useState<string | null>(null);
  const [summaryResult, setSummaryResult] = useState<{
    title: string;
    url: string;
    summary: string;
    category: string;
    method: 'heuristic' | 'agent';
  } | null>(null);
  const dataYears = useMemo(() => {
    const labels = agg?.by_year_month?.labels || [];
    const years = labels.map(l => Number(String(l).slice(0,4))).filter(n => !Number.isNaN(n));
    const minY = years.length ? Math.min(...years) : new Date().getFullYear() - 5;
    const maxY = years.length ? Math.max(...years) : new Date().getFullYear();
    return { minY, maxY };
  }, [agg]);

  const getStableColor = (label: string) => {
    const key = (label || '').toLowerCase();
    const stableSections = Array.from(new Set([...(agg?.facets?.sections || []), 'news', 'insights', 'success-stories', 'publications']
      .filter(Boolean)
      .map((s) => String(s).toLowerCase())));
    const idx = stableSections.indexOf(key);
    if (idx >= 0) return palette[idx % palette.length];
    const hash = Array.from(key).reduce((a, c) => a + c.charCodeAt(0), 0);
    return palette[hash % palette.length];
  };

 

  const formatSectionLabel = (val: string) => {
    const v = (val || '').toLowerCase();
    if (!v) return '';
    return v.split('-').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
  };

  const handleSummarize = async () => {
    const u = (urlInput || '').trim();
    if (!u) {
      setSummarizeError('Please enter a valid URL.');
      return;
    }
    setIsSummarizing(true);
    setSummarizeError(null);
    setSummaryResult(null);
    try {
      const res = await fetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: u, agent: useAgent })
      });
      if (!res.ok) {
        const msg = await res.json().catch(() => ({} as any));
        throw new Error(msg?.error || `Request failed (${res.status})`);
      }
      const data = await res.json();
      setSummaryResult(data);
    } catch (e) {
      setSummarizeError(e instanceof Error ? e.message : 'Failed to summarize URL');
    } finally {
      setIsSummarizing(false);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
    const url = new URL(window.location.href);
    const csv = url.searchParams.get('csv') || '';
    setCsvPath(csv);
    const baseParams = new URLSearchParams();
    if (csv) baseParams.set('csv', csv);
    if (filters.section) baseParams.set('section', filters.section);
    if (filters.category) baseParams.set('category', filters.category);
    if (filters.q) baseParams.set('q', filters.q);
    if (filters.startYm) baseParams.set('startYm', filters.startYm);
    if (filters.endYm) baseParams.set('endYm', filters.endYm);
    const aggUrl = baseParams.toString() ? `/api/aggregations?${baseParams.toString()}` : '/api/aggregations';
    const itemParams = new URLSearchParams(baseParams);
    itemParams.set('limit', String(pagination.limit));
    itemParams.set('offset', String(pagination.offset));
    const itemsUrl = `/api/items?${itemParams.toString()}`;

        const [aggResponse, itemsResponse] = await Promise.all([
      fetch(aggUrl),
      fetch(itemsUrl),
        ]);

        if (!aggResponse.ok || !itemsResponse.ok) {
          throw new Error(`API request failed: ${aggResponse.status} ${itemsResponse.status}`);
        }

        const [aggData, itemsData] = await Promise.all([
          aggResponse.json(),
          itemsResponse.json(),
        ]);

        setAgg(aggData);
        setItems(itemsData);
      } catch (error) {
        console.error('Error fetching data:', error);
        setError(error instanceof Error ? error.message : 'Failed to load data');
        // Set empty data on error to prevent UI crashes
        setAgg({
          csv_path: '',
          total: 0,
          by_category: [],
          by_section: [],
          by_year_month: { labels: [], counts: [] },
          monthly_by_section: { labels: [], series: {} },
          facets: { sections: [], categories: [] },
        });
        setItems({ total: 0, items: [] });
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [filters, pagination]);

 

  const LoadingSpinner = () => (
    <div className="flex items-center justify-center p-8">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>
  );

  const ErrorMessage = ({ message }: { message: string }) => (
    <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
      <div className="flex items-center">
        <svg className="w-5 h-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span className="text-red-800 font-medium">Error loading data</span>
      </div>
      <p className="text-red-700 text-sm mt-1">{message}</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        {/* Combined Header & Filters */}
        <Card className="mb-6">
          <CardHeader className="pb-4">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              {/* Header Section */}
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-gradient-to-br from-primary to-primary/80 rounded-lg flex items-center justify-center">
                  <BarChart3 className="w-5 h-5 text-primary-foreground" />
                </div>
                <div>
                  <CardTitle className="text-xl sm:text-2xl font-bold">FAO Gender Dashboard</CardTitle>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Database className="w-3 h-3" />
                    <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded">{csvPath || 'default dataset'}</span>
                    {isLoading && (
                      <div className="flex items-center gap-1 text-primary">
                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-primary"></div>
                        <span className="text-xs">Loading...</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

        {/* Mobile Filter Toggle */}
              <div className="lg:hidden">
                <Button
                  variant="outline"
            onClick={() => setMobileFiltersOpen(!mobileFiltersOpen)}
                  className="w-full justify-between"
                  aria-expanded={mobileFiltersOpen}
                  aria-controls="mobile-filters"
          >
            <span className="flex items-center gap-2">
                    <Filter className="w-4 h-4" />
                    <span>Filters</span>
            </span>
                  <svg className={`w-4 h-4 transition-transform duration-200 ${mobileFiltersOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
                </Button>
              </div>
        </div>
          </CardHeader>

        {/* URL Summarizer + Filters Section */}
          <CardContent id="mobile-filters" className={`pt-0 ${mobileFiltersOpen ? 'block' : 'hidden'} lg:block`}>
            <div className="space-y-3 sm:space-y-4">
              {/* URL Summarizer Row */}
              <div className="grid grid-cols-1 lg:grid-cols-6 gap-2 sm:gap-3 pb-3 border-b">
                <div className="lg:col-span-6">
                  <Label htmlFor="summarize-url" className="text-[13px] sm:text-sm font-medium">Summarize an article URL</Label>
                  <div className="mt-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <Input
                      id="summarize-url"
                      className="flex-1 h-10 text-[15px]"
                      placeholder="https://example.com/article"
                      value={urlInput}
                      onChange={(e) => setUrlInput(e.target.value)}
                      aria-label="Article URL"
                    />
                    <label className="inline-flex items-center gap-2 text-sm text-muted-foreground select-none px-2">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-input text-primary"
                        checked={useAgent}
                        onChange={(e) => setUseAgent(e.target.checked)}
                        aria-label="Use AI Agent"
                      />
                      <span>Use AI Agent</span>
                    </label>
                    <Button
                      variant="default"
                      onClick={handleSummarize}
                      disabled={isSummarizing}
                      aria-label="Summarize URL"
                    >
                      {isSummarizing ? 'Summarizing…' : 'Summarize'}
                    </Button>
                  </div>
                  {summarizeError && (
                    <div className="mt-2 text-sm text-red-600" role="alert">{summarizeError}</div>
                  )}
                  {summaryResult && (
                    <div className="mt-3 p-3 rounded-md border bg-background">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm text-muted-foreground mb-1">{summaryResult.method === 'agent' ? 'AI Agent Summary' : 'Heuristic Summary'}</div>
                          <div className="font-semibold truncate" title={summaryResult.title}>{summaryResult.title}</div>
                        </div>
                        <span className="flex-shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800" title={summaryResult.category}>
                          {summaryResult.category}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-foreground leading-relaxed whitespace-pre-wrap">{summaryResult.summary}</p>
                      <a
                        href={summaryResult.url}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 mt-2"
                        aria-label="Open original article"
                      >
                        Open article
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                    </div>
                  )}
                </div>
              </div>

              {/* Main Filters Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2 sm:gap-3">
            <div>
                  <Label htmlFor="section" className="text-[13px] sm:text-sm font-medium">Section</Label>
                  <select 
                    id="section"
                    className="w-full mt-1 border border-input rounded-md px-3 py-2 text-[15px] sm:text-base focus:ring-2 focus:ring-ring focus:border-ring transition-colors bg-background" 
                    value={filters.section} 
                    onChange={e => setFilters(s => ({ ...s, section: e.target.value }))}
                    aria-label="Filter by section"
                  >
                    <option value="">All Sections</option>
                {Array.from(new Set([...(agg?.facets?.sections || []), 'news', 'insights', 'success-stories', 'publications']
                  .filter(Boolean)
                  .map((s) => String(s).toLowerCase())))
                  .filter((s) => s !== 'e-learning')
                  .map((s) => (
                    <option key={s} value={s}>{formatSectionLabel(s)}</option>
                ))}
              </select>
            </div>
            <div>
                  <Label htmlFor="category" className="text-[13px] sm:text-sm font-medium">Category</Label>
                  <select 
                    id="category"
                    className="w-full mt-1 border border-input rounded-md px-3 py-2 text-[15px] sm:text-base focus:ring-2 focus:ring-ring focus:border-ring transition-colors bg-background" 
                    value={filters.category} 
                    onChange={e => setFilters(s => ({ ...s, category: e.target.value }))}
                    aria-label="Filter by category"
                  >
                    <option value="">All Categories</option>
                {agg?.facets?.categories?.map((c) => (<option key={c} value={c.toLowerCase()}>{c}</option>))}
              </select>
            </div>
                <div className="sm:col-span-2 lg:col-span-2">
                  <Label htmlFor="search" className="text-[13px] sm:text-sm font-medium">Search</Label>
                  <div className="relative mt-1">
                    <Input 
                      id="search"
                      className="pl-9 h-10 text-[15px]" 
                      placeholder="Search content..." 
                      value={filters.q} 
                      onChange={e => setFilters(s => ({ ...s, q: e.target.value }))}
                      aria-label="Search content"
                    />
                    <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  </div>
            </div>
                <div className="lg:col-span-2">
                  <Label htmlFor="dates" className="text-[13px] sm:text-sm font-medium">Date Range</Label>
                  <div className="mt-1">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          id="dates"
                          className="w-full justify-between font-normal h-10 text-[15px]"
                        >
                          {dateRange?.from && dateRange?.to
                            ? formatDateRange(dateRange.from, dateRange.to, { includeTime: false })
                            : "Select date"}
                          <ChevronDownIcon className="w-4 h-4" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto overflow-hidden p-0" align="start">
                        <Calendar
                          mode="range"
                          selected={dateRange}
                          captionLayout="dropdown"
                          numberOfMonths={1}
                          fromYear={dataYears.minY}
                          toYear={dataYears.maxY}
                          onSelect={(range: DateRange | undefined) => {
                            setDateRange(range)
                            if (!range?.from || !range?.to) {
                              setFilters((s)=>({ ...s, startYm: '', endYm: '' }))
                              return
                            }
                            const startYm = `${range.from.getFullYear()}-${String(range.from.getMonth()+1).padStart(2,'0')}`
                            const endYm = `${range.to.getFullYear()}-${String(range.to.getMonth()+1).padStart(2,'0')}`
                            setFilters((s)=>({ ...s, startYm, endYm }))
                          }}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
          </div>
              
              {/* Quick Presets & Clear */}
              <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3 pt-3 border-t">
                <div className="flex flex-wrap gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => {
                      const now = new Date();
                      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                      const startYm = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}`;
                      const endYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
                      setFilters(s => ({ ...s, startYm, endYm }));
                    }}
                  >
                    Last Month
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => {
                      const now = new Date();
                      const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
                      const startYm = `${threeMonthsAgo.getFullYear()}-${String(threeMonthsAgo.getMonth() + 1).padStart(2, '0')}`;
                      const endYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
                      setFilters(s => ({ ...s, startYm, endYm }));
                    }}
                  >
                    Last 3M
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => {
                      const now = new Date();
                      const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1);
                      const startYm = `${sixMonthsAgo.getFullYear()}-${String(sixMonthsAgo.getMonth() + 1).padStart(2, '0')}`;
                      const endYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
                      setFilters(s => ({ ...s, startYm, endYm }));
                    }}
                  >
                    Last 6M
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => {
                      const now = new Date();
                      const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), 1);
                      const startYm = `${oneYearAgo.getFullYear()}-${String(oneYearAgo.getMonth() + 1).padStart(2, '0')}`;
                      const endYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
                      setFilters(s => ({ ...s, startYm, endYm }));
                    }}
                  >
                    Last Year
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => {
                      const now = new Date();
                      const startYm = `${now.getFullYear()}-01`;
                      const endYm = `${now.getFullYear()}-12`;
                      setFilters(s => ({ ...s, startYm, endYm }));
                    }}
                  >
                    This Year
                  </Button>
                </div>
                {(filters.section || filters.category || filters.q || filters.startYm || filters.endYm) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { setFilters({ section: '', category: '', q: '', startYm: '', endYm: '' }); setPagination(p => ({ ...p, offset: 0 })); setMobileFiltersOpen(false); }}
                    className="text-destructive hover:text-destructive h-7 px-2 text-xs"
                  >
                    <X className="w-3 h-3 mr-1" />
                    Clear
                  </Button>
                )}
              </div>

              {/* Active filter chips (sticky on mobile) */}
              {(filters.section || filters.category || filters.q || filters.startYm || filters.endYm) && (
                <div className="md:static md:bg-transparent md:shadow-none md:backdrop-blur-0 md:py-0 md:mt-3 sticky top-0 z-30 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 py-2 mt-3 -mx-4 px-4 sm:m-0 sm:p-0 flex flex-wrap gap-2">
                  {filters.section && (
                    <button
                      className="px-2 py-1 rounded-full bg-blue-50 text-blue-700 text-xs flex items-center gap-1"
                      onClick={() => setFilters((s)=>({ ...s, section: '' }))}
                      aria-label="Clear section filter"
                    >
                      Section: {formatSectionLabel(filters.section)}
                      <X className="w-3 h-3" />
                    </button>
                  )}
                  {filters.category && (
                    <button
                      className="px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs flex items-center gap-1"
                      onClick={() => setFilters((s)=>({ ...s, category: '' }))}
                      aria-label="Clear category filter"
                    >
                      Category: {filters.category}
                      <X className="w-3 h-3" />
                    </button>
                  )}
                  {filters.q && (
                    <button
                      className="px-2 py-1 rounded-full bg-zinc-100 text-zinc-700 text-xs flex items-center gap-1"
                      onClick={() => setFilters((s)=>({ ...s, q: '' }))}
                      aria-label="Clear search filter"
                    >
                      Search: {filters.q}
                      <X className="w-3 h-3" />
                    </button>
                  )}
                  {(filters.startYm || filters.endYm) && (
                    <button
                      className="px-2 py-1 rounded-full bg-purple-50 text-purple-700 text-xs flex items-center gap-1"
                      onClick={() => setFilters((s)=>({ ...s, startYm: '', endYm: '' }))}
                      aria-label="Clear date range filter"
                    >
                      {filters.startYm || '…'} – {filters.endYm || '…'}
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {error && <ErrorMessage message={error} />}

        {/* Enhanced Stats Cards */}
        <div className="mb-6 grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
          <Card className="hover:shadow-lg transition-shadow duration-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm sm:text-base text-muted-foreground mb-2 font-medium">Total Items</p>
                  <p className="text-2xl sm:text-3xl font-bold">{agg?.total ?? 0}</p>
                </div>
                <div className="w-12 h-12 sm:w-16 sm:h-16 bg-primary/10 rounded-xl flex items-center justify-center">
                  <FileText className="w-6 h-6 sm:w-8 sm:h-8 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="hover:shadow-lg transition-shadow duration-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm sm:text-base text-muted-foreground mb-2 font-medium">Sections</p>
                  <p className="text-2xl sm:text-3xl font-bold">{agg?.facets?.sections?.length ?? 0}</p>
                </div>
                <div className="w-12 h-12 sm:w-16 sm:h-16 bg-green-500/10 rounded-xl flex items-center justify-center">
                  <BarChart3 className="w-6 h-6 sm:w-8 sm:h-8 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="hover:shadow-lg transition-shadow duration-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm sm:text-base text-muted-foreground mb-2 font-medium">Categories</p>
                  <p className="text-2xl sm:text-3xl font-bold">{agg?.facets?.categories?.length ?? 0}</p>
                </div>
                <div className="w-12 h-12 sm:w-16 sm:h-16 bg-orange-500/10 rounded-xl flex items-center justify-center">
                  <PieChart className="w-6 h-6 sm:w-8 sm:h-8 text-orange-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="hover:shadow-lg transition-shadow duration-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm sm:text-base text-muted-foreground mb-2 font-medium">Time Period</p>
                  <p className="text-2xl sm:text-3xl font-bold">{agg?.by_year_month?.labels?.length ?? 0}</p>
                  <p className="text-sm text-muted-foreground mt-1">months</p>
          </div>
                <div className="w-12 h-12 sm:w-16 sm:h-16 bg-purple-500/10 rounded-xl flex items-center justify-center">
                  <Clock className="w-6 h-6 sm:w-8 sm:h-8 text-purple-600" />
          </div>
          </div>
            </CardContent>
          </Card>
          </div>

        {/* Single Row Visuals: Section Overview (Pie via Recharts) + Radar (Recharts) */}
        <div className="mb-6 grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-8">
          {/* Sections Overview Pie (Recharts) */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-green-500/10 rounded-lg flex items-center justify-center">
                    <PieChart className="w-4 h-4 text-green-600" />
                  </div>
                  <CardTitle className="text-base sm:text-xl font-semibold">Sections Overview</CardTitle>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0 px-2 sm:px-4">
              {isLoading ? (
                <LoadingSpinner />
              ) : (
                (() => {
                  const labels = agg?.by_section?.map((d) => d.label) || [];
                  const data = (agg?.by_section || []).map((d) => ({ name: d.label, value: d.count, fill: getStableColor(String(d.label)) }))
                  const total = data.reduce((a, c) => a + c.value, 0)
                  return (
                    <div className="mx-auto max-w-full overflow-hidden rounded-md">
                      <div className="h-[16rem] sm:h-[20rem] lg:h-[24rem]">
                        <RResponsiveContainer width="100%" height="100%">
                         <RPieChart margin={{ top: 12, right: 12, bottom: 12, left: 12 }}>
                        <RTooltip formatter={(value: any, _name: any, item: any) => {
                          return [String(value), item?.payload?.name || ''];
                        }} />
                          <Pie
                          data={data}
                          dataKey="value"
                          nameKey="name"
                              innerRadius={65}
                              outerRadius={"75%"}
                          strokeWidth={4}
                        >
                          {data.map((entry, index) => (
                            <RCell key={`cell-${index}`} fill={entry.fill} stroke={entry.fill} />
                          ))}
                          <RechartsLabel
                            content={({ viewBox }: any) => {
                              if (viewBox && 'cx' in viewBox && 'cy' in viewBox) {
                                return (
                                    <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle" className="scale-90 sm:scale-100">
                                      <tspan x={viewBox.cx} y={viewBox.cy} className="fill-foreground text-2xl sm:text-3xl font-bold">{total}</tspan>
                                      <tspan x={viewBox.cx} y={(viewBox.cy || 0) + 18} className="fill-muted-foreground text-xs sm:text-sm">items</tspan>
                                  </text>
                                )
                              }
                              return null
                            }}
                          />
                          </Pie>
                        </RPieChart>
                        </RResponsiveContainer>
                      </div>
                      {/* Mobile legend */}
                      <div className="mt-3 sm:hidden text-xs text-muted-foreground flex flex-wrap gap-2">
                        {data.slice(0, 6).map((d, i) => (
                          <span key={i} className="inline-flex items-center gap-1">
                            <span className="inline-block w-2.5 h-2.5 rounded" style={{ backgroundColor: d.fill }} />
                            {formatSectionLabel(String(d.name))}
                          </span>
                        ))}
                      </div>
                    </div>
                  )
                })()
              )}
            </CardContent>
          </Card>

          {/* Category Coverage Bar (Recharts) */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-primary/10 rounded-lg flex items-center justify-center">
                    <TrendingUp className="w-4 h-4 text-primary" />
                  </div>
                  <CardTitle className="text-base sm:text-xl font-semibold">Category Coverage</CardTitle>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0 px-2 sm:px-4">
              {isLoading ? (
                <LoadingSpinner />
              ) : (
                (() => {
                  const topCats = (agg?.by_category || []).slice().sort((a,b)=>b.count-a.count).slice(0,8)
                  const data = topCats.map((c,i)=>({ label: c.label, value: c.count, fill: palette[i % palette.length] }))
                  const config = Object.fromEntries(
                    data.map((d, i) => [
                      `bar${i+1}`,
                      { color: palette[i % palette.length] }
                    ])
                  ) as any
                  return (
                    <ChartContainer config={config} className="mx-auto w-full overflow-hidden rounded-md">
                      <div className="h-[16rem] sm:h-[20rem] lg:h-[24rem]">
                        <RResponsiveContainer width="100%" height="100%">
                          <RBarChart data={data} layout="vertical" margin={{ right: 12, left: 12 }} barCategoryGap={"30%"}>
                            <RCartesianGrid horizontal={false} />
                            <RYAxis dataKey="label" type="category" tickLine={false} tickMargin={10} axisLine={false} hide />
                            <RXAxis dataKey="value" type="number" hide />
                            <RTooltip 
                              formatter={(value: any) => [String(value), 'Items']}
                              labelFormatter={(_label: any, payload: any) => {
                                const p = Array.isArray(payload) ? payload[0] : payload;
                                return String(p?.payload?.label || '');
                              }}
                            />
                            <RBar dataKey="value" radius={4} />
                          </RBarChart>
                        </RResponsiveContainer>
                      </div>
                      {/* Mobile hint */}
                      <div className="mt-2 sm:hidden text-xs text-muted-foreground">Top categories by count</div>
                    </ChartContainer>
                  )
                })()
              )}
            </CardContent>
          </Card>
        </div>

        {/* Total Articles by Month - full width line chart */}
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-purple-500/10 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-purple-600" />
              </div>
              <CardTitle className="text-xl font-semibold">Total Articles by Month</CardTitle>
            </div>
            <CardDescription>Aggregated total items per month</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="h-[14rem] sm:h-[16rem] lg:h-[20rem]">
              {isLoading ? (
                <LoadingSpinner />
              ) : (
                (() => {
                  const labels = agg?.by_year_month?.labels || []
                  const counts = agg?.by_year_month?.counts || []
                  const data = labels.map((l, i) => ({ date: l + '-01', value: counts[i] || 0 }))
                  return (
                    <ChartContainer className="w-full h-full" config={{ line: { color: 'var(--chart-1)' } }}>
                      <RResponsiveContainer width="100%" height="100%">
                        <RLineChart data={data} margin={{ left: 12, right: 12 }}>
                          <RCartesianGrid vertical={false} />
                          <RXAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} minTickGap={20} tickFormatter={(value: string) => {
                            const d = new Date(value)
                            return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
                          }} />
                          <RTooltip formatter={(v: any) => [String(v), 'Items']} labelFormatter={(value: string) => new Date(value).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} />
                          <RLine type="monotone" dataKey="value" stroke="var(--color-line, #2563eb)" strokeWidth={2} dot={false} />
                        </RLineChart>
                      </RResponsiveContainer>
                    </ChartContainer>
                  )
                })()
              )}
            </div>
          </CardContent>
        </Card>

        {/* Enhanced Items Table/List */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-muted rounded-lg flex items-center justify-center">
                  <FileText className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <CardTitle className="text-2xl font-bold">Latest Items</CardTitle>
                  <CardDescription className="text-base">Browse and explore the latest content</CardDescription>
                </div>
              </div>
              {agg && (
              <div className="text-right">
                <div className="text-base text-muted-foreground">Total Items</div>
                <div className="text-2xl font-bold">{agg.total}</div>
              </div>
              )}
            </div>
          </CardHeader>
          <CardContent>

          {/* Enhanced Desktop Table View */}
          <div className="hidden md:block overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left font-semibold px-4 py-3 text-sm text-gray-700">Section</th>
                  <th className="text-left font-semibold px-4 py-3 text-sm text-gray-700">Category</th>
                  <th className="text-left font-semibold px-4 py-3 text-sm text-gray-700">Title</th>
                  <th className="text-left font-semibold px-4 py-3 text-sm text-gray-700">Date</th>
                  <th className="text-left font-semibold px-4 py-3 text-sm text-gray-700">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8">
                      <LoadingSpinner />
                    </td>
                  </tr>
                ) : (
                  items?.items?.map((r, idx) => (
                    <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {r.section}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{r.category}</td>
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-gray-900" title={(r.shortSummary || r.summary || '').toString()}>
                          {r.title}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{r.date}</td>
                      <td className="px-4 py-3">
                        <a 
                          className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors" 
                          href={r.url} 
                          target="_blank" 
                          rel="noreferrer noopener"
                          aria-label={`Open ${r.title}`}
                        >
                          <span>Open</span>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </a>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Enhanced Mobile Card View */}
          <div className="md:hidden space-y-3">
            {isLoading ? (
              <div className="py-6">
                <LoadingSpinner />
              </div>
            ) : (
              items?.items?.map((r, idx) => (
                <div key={idx} className="border border-gray-200 rounded-xl p-3 hover:shadow-sm transition-shadow">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-semibold text-gray-900 text-[15px] leading-snug flex-1 line-clamp-2">{r.title}</h3>
                    <a 
                      className="flex-shrink-0 text-blue-600 hover:text-blue-700 p-2 hover:bg-blue-50 rounded-lg transition-colors" 
                    href={r.url} 
                    target="_blank" 
                    rel="noreferrer noopener"
                      aria-label={`Open ${r.title}`}
                  >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </div>
                  <div className="flex flex-wrap gap-2 mb-2">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-100 text-blue-800">
                      {r.section}
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-gray-100 text-gray-700">
                      {r.date}
                    </span>
                  </div>
                  <p className="text-[13px] text-gray-600 line-clamp-2">{r.category}</p>
                </div>
              ))
            )}
          </div>

          {/* Enhanced Pagination */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 pt-6 border-t">
            <div className="text-sm text-muted-foreground">
              Showing <span className="font-medium text-foreground">{Math.min(pagination.offset + 1, agg?.total || 0)}</span>–<span className="font-medium text-foreground">{Math.min(pagination.offset + pagination.limit, agg?.total || 0)}</span> of <span className="font-medium text-foreground">{agg?.total || 0}</span> items
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.offset === 0}
                onClick={() => setPagination(p => ({ ...p, offset: Math.max(0, p.offset - p.limit) }))}
                aria-label="Previous page"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={(agg?.total || 0) <= (pagination.offset + pagination.limit)}
                onClick={() => setPagination(p => ({ ...p, offset: p.offset + p.limit }))}
                aria-label="Next page"
              >
                Next
                <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Button>
              <select
                className="border border-input bg-background rounded-lg px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-ring focus:border-ring transition-colors"
                value={pagination.limit}
                onChange={(e) => setPagination({ limit: parseInt(e.target.value, 10), offset: 0 })}
                aria-label="Items per page"
              >
                <option value={10}>10 per page</option>
                <option value={20}>20 per page</option>
                <option value={50}>50 per page</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}


