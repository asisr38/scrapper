"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  LineElement,
  PointElement,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import { Pie, PieChart as RPieChart, Label as RechartsLabel, Bar as RBar, BarChart as RBarChart, CartesianGrid as RCartesianGrid, XAxis as RXAxis, YAxis as RYAxis, LabelList as RLabelList, LineChart as RLineChart, Line as RLine, Tooltip as RTooltip, ResponsiveContainer as RResponsiveContainer, Cell as RCell } from 'recharts';
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

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, LineElement, PointElement, Tooltip, Legend, Filler);

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

const gridColor = 'rgba(0,0,0,0.05)';
const axisColor = '#64748b';
const borderColor = 'rgba(0,0,0,0.08)';

export default function Page() {
  const [csvPath, setCsvPath] = useState<string>('');
  const [agg, setAgg] = useState<Aggregations | null>(null);
  const [items, setItems] = useState<ItemsResp | null>(null);
  const [filters, setFilters] = useState<{ section: string; category: string; q: string; startYm: string; endYm: string }>({ section: '', category: '', q: '', startYm: '', endYm: '' });
  const [pagination, setPagination] = useState<{ limit: number; offset: number }>({ limit: 20, offset: 0 });
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isCategoryFiltered = !!filters.category;
  const secChartRef = useRef<any>(null);
  const catChartRef = useRef<any>(null);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
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

  const handleSectionPieClick = (event: any) => {
    const chart = secChartRef.current;
    const nativeEvent = event?.native || event;
    if (!chart || !nativeEvent) return;
    const points = chart.getElementsAtEventForMode(nativeEvent, 'nearest', { intersect: true }, true);
    if (!points?.length) return;
    const idx = points[0].index;
    const label = secData?.labels?.[idx] || '';
    const value = String(label).toLowerCase();
    setFilters((s) => ({ ...s, section: s.section === value ? '' : value }));
  };

  const handleCategoryBarClick = (event: any) => {
    const chart = catChartRef.current;
    const nativeEvent = event?.native || event;
    if (!chart || !nativeEvent) return;
    const points = chart.getElementsAtEventForMode(nativeEvent, 'nearest', { intersect: true }, true);
    if (!points?.length) return;
    const idx = points[0].index;
    const label = catData?.labels?.[idx] || '';
    const value = String(label).toLowerCase();
    setFilters((s) => ({ ...s, category: s.category === value ? '' : value }));
  };

  const formatSectionLabel = (val: string) => {
    const v = (val || '').toLowerCase();
    if (!v) return '';
    return v.split('-').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
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

  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        grid: { color: gridColor, drawBorder: false },
        ticks: { color: axisColor, font: { size: 16, weight: 500 } },
        border: { color: borderColor },
      },
      y: {
        grid: { color: gridColor, drawBorder: false },
        ticks: { color: axisColor, font: { size: 16, weight: 500 }, precision: 0 },
        border: { color: borderColor },
        beginAtZero: true,
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(17,24,39,0.9)',
        titleColor: '#fff',
        bodyColor: '#e5e7eb',
        displayColors: false,
        titleFont: { size: 16, weight: 600 },
        bodyFont: { size: 15, weight: 500 },
      },
    },
    elements: {
      bar: {
        borderRadius: 6,
        borderSkipped: false,
      }
    },
  } as const;

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '50%',
    plugins: {
      legend: { 
        position: 'bottom' as const, 
        labels: { 
          color: axisColor, 
          boxWidth: 18, 
          boxHeight: 18,
          padding: 20,
          font: { size: 16, weight: 500 }
        } 
      },
      tooltip: {
        backgroundColor: 'rgba(17,24,39,0.9)',
        titleColor: '#fff',
        bodyColor: '#e5e7eb',
        displayColors: true,
        titleFont: { size: 16, weight: 600 },
        bodyFont: { size: 15, weight: 500 },
        callbacks: {
          label: function(context: any) {
            const label = context.label || '';
            const value = context.parsed;
            const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
            const percentage = ((value / total) * 100).toFixed(1);
            return `${label}: ${value} (${percentage}%)`;
          }
        }
      },
    },
  };

  const lineOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        grid: { color: gridColor, drawBorder: false },
        ticks: { 
          color: axisColor, 
          font: { size: 15, weight: 500 },
          maxRotation: 45,
          minRotation: 45,
          autoSkip: true,
          maxTicksLimit: 15
        },
        border: { color: borderColor },
      },
      y: {
        grid: { color: gridColor, drawBorder: false },
        ticks: { color: axisColor, font: { size: 15, weight: 500 }, precision: 0 },
        border: { color: borderColor },
        beginAtZero: true,
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(17,24,39,0.9)',
        titleColor: '#fff',
        bodyColor: '#e5e7eb',
        displayColors: false,
        titleFont: { size: 16, weight: 600 },
        bodyFont: { size: 15, weight: 500 },
      },
    },
    elements: {
      point: {
        radius: 6,
        hoverRadius: 8,
        borderWidth: 3,
      },
      line: {
        borderWidth: 4,
        tension: 0.4,
      }
    },
  } as const;

  const catData = useMemo(() => {
    if (!agg) return null;
    const topN = 8;
    const sorted = [...agg.by_category].sort((a, b) => b.count - a.count);
    const top = sorted.slice(0, topN);
    const others = sorted.slice(topN);
    const othersTotal = others.reduce((sum, d) => sum + d.count, 0);
    const labels = [...top.map(d => d.label), ...(othersTotal > 0 ? ['Others'] : [])];
    const counts = [...top.map(d => d.count), ...(othersTotal > 0 ? [othersTotal] : [])];
    return {
      labels,
      datasets: [{
        label: 'Items',
        data: counts,
        backgroundColor: labels.map((_, i) => palette[i % palette.length] + 'CC'),
        borderColor: labels.map((_, i) => palette[i % palette.length]),
        borderWidth: 1,
      }]
    };
  }, [agg]);

  const catBarOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: 'y' as const,
    scales: {
      x: {
        grid: { color: gridColor, drawBorder: false },
        ticks: { color: axisColor, font: { size: 16, weight: 500 }, precision: 0 },
        border: { color: borderColor },
        beginAtZero: true,
      },
      y: {
        grid: { color: gridColor, drawBorder: false },
        ticks: { color: axisColor, font: { size: 15, weight: 500 }, callback: (v: any, i: number, ticks: any[]) => {
          const label = (catData?.labels?.[i] || '') as string;
          // Adjust max length based on screen size
          const maxLen = window.innerWidth < 640 ? 40 : 70;
          return label.length > maxLen ? label.slice(0, maxLen - 1) + '…' : label;
        } },
        border: { color: borderColor },
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(17,24,39,0.9)',
        titleColor: '#fff',
        bodyColor: '#e5e7eb',
        displayColors: true,
        titleFont: { size: 16, weight: 600 },
        bodyFont: { size: 15, weight: 500 },
        callbacks: {
          title: (items: any[]) => items?.[0]?.label || '',
          label: function(context: any) {
            return `Count: ${context.parsed.x}`;
          }
        },
      },
    },
    elements: {
      bar: {
        borderRadius: 6,
        borderSkipped: false,
      }
    },
  }), [catData]);

  const secData = useMemo(() => {
    if (!agg) return null;
    const labels = agg.by_section.map(d => d.label);
    const counts = agg.by_section.map(d => d.count);
    return {
      labels,
      datasets: [{
        data: counts,
        backgroundColor: labels.map((_, i) => palette[i % palette.length] + 'CC'),
        borderWidth: 0,
        hoverOffset: 8,
        spacing: 2,
      }]
    };
  }, [agg]);

  const monthlyStackedData = useMemo(() => {
    if (!agg || !agg.monthly_by_section) return null;
    const labels = agg.monthly_by_section.labels;
    const sections = Object.keys(agg.monthly_by_section.series).sort();
    const datasets = sections.map((sec, i) => ({
      label: sec,
      data: agg.monthly_by_section!.series[sec],
      backgroundColor: (palette[i % palette.length] + 'B3'),
      borderColor: palette[i % palette.length],
      borderWidth: 1,
      stack: 'sections',
    }));
    return { labels, datasets };
  }, [agg]);

  const stackedBarOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        stacked: true,
        grid: { color: gridColor, drawBorder: false },
        ticks: { 
          color: axisColor, 
          font: { size: 15, weight: 500 },
          maxRotation: 45,
          minRotation: 45,
          autoSkip: true,
          maxTicksLimit: 12
        },
        border: { color: borderColor },
      },
      y: {
        stacked: true,
        grid: { color: gridColor, drawBorder: false },
        ticks: { color: axisColor, font: { size: 15, weight: 500 }, precision: 0 },
        border: { color: borderColor },
        beginAtZero: true,
      },
    },
    plugins: {
      legend: { 
        position: 'bottom' as const,
        labels: {
          font: { size: 16, weight: 500 },
          padding: 16,
          boxWidth: 16,
          boxHeight: 16
        }
      },
      tooltip: {
        backgroundColor: 'rgba(17,24,39,0.9)',
        titleColor: '#fff',
        bodyColor: '#e5e7eb',
        displayColors: true,
        titleFont: { size: 16, weight: 600 },
        bodyFont: { size: 15, weight: 500 },
      },
    },
  }), []);

  const sectionBarForCategory = useMemo(() => {
    if (!agg) return null;
    const labels = agg.by_section.map(d => d.label);
    const counts = agg.by_section.map(d => d.count);
    return {
      labels,
      datasets: [{
        label: 'Items',
        data: counts,
        backgroundColor: labels.map((_, i) => palette[i % palette.length] + 'CC'),
        borderColor: labels.map((_, i) => palette[i % palette.length]),
        borderWidth: 1,
      }]
    };
  }, [agg]);

  const timeData = useMemo(() => {
    if (!agg) return null;
    const labels = agg.by_year_month.labels;
    const counts = agg.by_year_month.counts;
    return {
      labels,
      datasets: [{
        label: 'Items',
        data: counts,
        borderColor: '#2563eb',
        backgroundColor: (ctx: any) => {
          const { chart } = ctx;
          const { ctx: c, chartArea } = chart;
          if (!chartArea) return '#93c5fd66';
          const gradient = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
          gradient.addColorStop(0, 'rgba(37,99,235,0.3)');
          gradient.addColorStop(1, 'rgba(37,99,235,0.1)');
          return gradient;
        },
        pointRadius: 5,
        pointHoverRadius: 8,
        pointBackgroundColor: '#2563eb',
        pointBorderColor: '#ffffff',
        pointBorderWidth: 2,
        borderWidth: 4,
        tension: 0.4,
        fill: true,
      }]
    };
  }, [agg]);

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
                  <CardTitle className="text-2xl sm:text-3xl font-bold">FAO Gender Dashboard</CardTitle>
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

        {/* Filters Section */}
          <CardContent id="mobile-filters" className={`pt-0 ${mobileFiltersOpen ? 'block' : 'hidden'} lg:block`}>
            <div className="space-y-4">
              {/* Main Filters Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
            <div>
                  <Label htmlFor="section" className="text-sm font-semibold">Section</Label>
                  <select 
                    id="section"
                    className="w-full mt-1 border border-input rounded-md px-3 py-2 text-base focus:ring-2 focus:ring-ring focus:border-ring transition-colors bg-background" 
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
                  <Label htmlFor="category" className="text-sm font-semibold">Category</Label>
                  <select 
                    id="category"
                    className="w-full mt-1 border border-input rounded-md px-3 py-2 text-base focus:ring-2 focus:ring-ring focus:border-ring transition-colors bg-background" 
                    value={filters.category} 
                    onChange={e => setFilters(s => ({ ...s, category: e.target.value }))}
                    aria-label="Filter by category"
                  >
                    <option value="">All Categories</option>
                {agg?.facets?.categories?.map((c) => (<option key={c} value={c.toLowerCase()}>{c}</option>))}
              </select>
            </div>
                <div className="sm:col-span-2 lg:col-span-2">
                  <Label htmlFor="search" className="text-sm font-semibold">Search</Label>
                  <div className="relative mt-1">
                    <Input 
                      id="search"
                      className="pl-9 h-10 text-base" 
                      placeholder="Search content..." 
                      value={filters.q} 
                      onChange={e => setFilters(s => ({ ...s, q: e.target.value }))}
                      aria-label="Search content"
                    />
                    <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  </div>
            </div>
                <div className="lg:col-span-2">
                  <Label htmlFor="dates" className="text-sm font-semibold">Date Range</Label>
                  <div className="mt-1">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          id="dates"
                          className="w-full justify-between font-normal h-10"
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
              <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t">
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
            </div>
          </CardContent>
        </Card>

        {error && <ErrorMessage message={error} />}

        {/* Enhanced Stats Cards */}
        <div className="mb-8 grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          <Card className="hover:shadow-lg transition-shadow duration-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-base text-muted-foreground mb-2 font-medium">Total Items</p>
                  <p className="text-3xl sm:text-4xl font-bold">{agg?.total ?? 0}</p>
                </div>
                <div className="w-16 h-16 bg-primary/10 rounded-xl flex items-center justify-center">
                  <FileText className="w-8 h-8 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="hover:shadow-lg transition-shadow duration-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-base text-muted-foreground mb-2 font-medium">Sections</p>
                  <p className="text-3xl sm:text-4xl font-bold">{agg?.facets?.sections?.length ?? 0}</p>
                </div>
                <div className="w-16 h-16 bg-green-500/10 rounded-xl flex items-center justify-center">
                  <BarChart3 className="w-8 h-8 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="hover:shadow-lg transition-shadow duration-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-base text-muted-foreground mb-2 font-medium">Categories</p>
                  <p className="text-3xl sm:text-4xl font-bold">{agg?.facets?.categories?.length ?? 0}</p>
                </div>
                <div className="w-16 h-16 bg-orange-500/10 rounded-xl flex items-center justify-center">
                  <PieChart className="w-8 h-8 text-orange-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="hover:shadow-lg transition-shadow duration-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-base text-muted-foreground mb-2 font-medium">Time Period</p>
                  <p className="text-3xl sm:text-4xl font-bold">{agg?.by_year_month?.labels?.length ?? 0}</p>
                  <p className="text-sm text-muted-foreground mt-1">months</p>
          </div>
                <div className="w-16 h-16 bg-purple-500/10 rounded-xl flex items-center justify-center">
                  <Clock className="w-8 h-8 text-purple-600" />
          </div>
          </div>
            </CardContent>
          </Card>
          </div>

        {/* Single Row Visuals: Section Overview (Pie via Recharts) + Radar (Recharts) */}
        <div className="mb-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Sections Overview Pie (Recharts) */}
          <Card className="h-[28rem] lg:h-[32rem]">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-green-500/10 rounded-lg flex items-center justify-center">
                    <PieChart className="w-4 h-4 text-green-600" />
                  </div>
                  <CardTitle className="text-xl font-semibold">Sections Overview</CardTitle>
                </div>
                {filters.section && (
                  <Button variant="ghost" size="sm" onClick={() => setFilters((s) => ({ ...s, section: '' }))} aria-label="Clear section filter" className="text-destructive hover:text-destructive">Clear</Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {isLoading ? (
                <LoadingSpinner />
              ) : (
                (() => {
                  const labels = agg?.by_section?.map((d) => d.label) || [];
                  const data = (agg?.by_section || []).map((d) => ({ name: d.label, value: d.count, fill: getStableColor(String(d.label)) }))
                  const total = data.reduce((a, c) => a + c.value, 0)
                  return (
                    <div className="mx-auto aspect-square max-h-[28rem]">
                      <RPieChart width={500} height={500} className="w-full h-full">
                        <RTooltip formatter={(value: any, _name: any, item: any) => {
                          return [String(value), item?.payload?.name || ''];
                        }} />
                        <Pie
                          data={data}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={80}
                          strokeWidth={4}
                        >
                          {data.map((entry, index) => (
                            <RCell key={`cell-${index}`} fill={entry.fill} stroke={entry.fill} />
                          ))}
                          <RechartsLabel
                            content={({ viewBox }: any) => {
                              if (viewBox && 'cx' in viewBox && 'cy' in viewBox) {
                                return (
                                  <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                                    <tspan x={viewBox.cx} y={viewBox.cy} className="fill-foreground text-3xl font-bold">{total}</tspan>
                                    <tspan x={viewBox.cx} y={(viewBox.cy || 0) + 22} className="fill-muted-foreground">items</tspan>
                                  </text>
                                )
                              }
                              return null
                            }}
                          />
                        </Pie>
                      </RPieChart>
                    </div>
                  )
                })()
              )}
            </CardContent>
          </Card>

          {/* Category Coverage Bar (Recharts) */}
          <Card className="h-[28rem] lg:h-[32rem]">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-primary/10 rounded-lg flex items-center justify-center">
                    <TrendingUp className="w-4 h-4 text-primary" />
                  </div>
                  <CardTitle className="text-xl font-semibold">Category Coverage</CardTitle>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
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
                    <ChartContainer config={config} className="mx-auto max-h-[28rem] w-full">
                      <RBarChart data={data} layout="vertical" margin={{ right: 16, left: 8 }} width={600} height={450} className="w-full h-full">
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
                    </ChartContainer>
                  )
                })()
              )}
            </CardContent>
          </Card>
        </div>

        {/* Total Articles by Month - full width line chart */}
        <Card className="mb-8">
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
            <div className="h-[18rem] lg:h-[22rem]">
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
                          <RXAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} tickFormatter={(value: string) => {
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
          <div className="md:hidden space-y-4">
            {isLoading ? (
              <div className="py-8">
                <LoadingSpinner />
              </div>
            ) : (
              items?.items?.map((r, idx) => (
                <div key={idx} className="border border-gray-200 rounded-xl p-4 hover:shadow-sm transition-shadow">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <h3 className="font-semibold text-gray-900 flex-1 line-clamp-2">{r.title}</h3>
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
                  <div className="flex flex-wrap gap-2 mb-3">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {r.section}
                    </span>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                      {r.date}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 line-clamp-2">{r.category}</p>
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


