"use client";

import { useEffect, useMemo, useState } from 'react';
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
  '#0ea5e9', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6',
  '#14b8a6', '#f43f5e', '#10b981', '#a855f7', '#6366f1',
];

const gridColor = 'rgba(0,0,0,0.06)';
const axisColor = '#6b7280';
const borderColor = 'rgba(0,0,0,0.1)';

export default function Page() {
  const [csvPath, setCsvPath] = useState<string>('');
  const [agg, setAgg] = useState<Aggregations | null>(null);
  const [items, setItems] = useState<ItemsResp | null>(null);
  const [filters, setFilters] = useState<{ section: string; category: string; q: string; startYm: string; endYm: string }>({ section: '', category: '', q: '', startYm: '', endYm: '' });
  const [pagination, setPagination] = useState<{ limit: number; offset: number }>({ limit: 20, offset: 0 });
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const isCategoryFiltered = !!filters.category;

  const formatSectionLabel = (val: string) => {
    const v = (val || '').toLowerCase();
    if (!v) return '';
    return v.split('-').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
  };

  useEffect(() => {
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

    Promise.all([
      fetch(aggUrl),
      fetch(itemsUrl),
    ])
      .then(async ([a, i]) => [await a.json(), await i.json()])
      .then(([a, i]) => {
        setAgg(a);
        setItems(i);
      })
      .catch(console.error);
  }, [filters, pagination]);

  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        grid: { color: gridColor, drawBorder: false },
        ticks: { color: axisColor, font: { size: 11 } },
        border: { color: borderColor },
      },
      y: {
        grid: { color: gridColor, drawBorder: false },
        ticks: { color: axisColor, font: { size: 11 }, precision: 0 },
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
      },
    },
  } as const;

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '70%',
    plugins: {
      legend: { position: 'bottom' as const, labels: { color: axisColor, boxWidth: 10, boxHeight: 10 } },
      tooltip: {
        backgroundColor: 'rgba(17,24,39,0.9)',
        titleColor: '#fff',
        bodyColor: '#e5e7eb',
        displayColors: false,
      },
    },
  };

  const lineOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        grid: { color: gridColor, drawBorder: false },
        ticks: { color: axisColor, font: { size: 11 } },
        border: { color: borderColor },
      },
      y: {
        grid: { color: gridColor, drawBorder: false },
        ticks: { color: axisColor, font: { size: 11 }, precision: 0 },
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
      },
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
        ticks: { color: axisColor, font: { size: 12 }, precision: 0 },
        border: { color: borderColor },
        beginAtZero: true,
      },
      y: {
        grid: { color: gridColor, drawBorder: false },
        ticks: { color: axisColor, font: { size: 12 }, callback: (v: any, i: number, ticks: any[]) => {
          const label = (catData?.labels?.[i] || '') as string;
          const maxLen = 42;
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
        callbacks: {
          title: (items: any[]) => items?.[0]?.label || '',
        },
      },
    },
  }), []);

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
        ticks: { color: axisColor, font: { size: 11 } },
        border: { color: borderColor },
      },
      y: {
        stacked: true,
        grid: { color: gridColor, drawBorder: false },
        ticks: { color: axisColor, font: { size: 11 }, precision: 0 },
        border: { color: borderColor },
        beginAtZero: true,
      },
    },
    plugins: {
      legend: { position: 'bottom' as const },
      tooltip: {
        backgroundColor: 'rgba(17,24,39,0.9)',
        titleColor: '#fff',
        bodyColor: '#e5e7eb',
        displayColors: true,
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
          gradient.addColorStop(0, 'rgba(37,99,235,0.25)');
          gradient.addColorStop(1, 'rgba(37,99,235,0.05)');
          return gradient;
        },
        pointRadius: 2,
        pointHoverRadius: 4,
        borderWidth: 2,
        tension: 0.35,
        fill: true,
      }]
    };
  }, [agg]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6">
        <header className="mb-4 sm:mb-6">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">FAO Gender Dashboard</h1>
          <p className="text-xs sm:text-sm text-gray-600 mt-1">
            <span className="hidden sm:inline">JSON source: </span>
            <span className="font-mono text-xs">{csvPath || 'default'}</span>
          </p>
        </header>

        {/* Mobile Filter Toggle */}
        <div className="md:hidden mb-4">
          <button
            onClick={() => setMobileFiltersOpen(!mobileFiltersOpen)}
            className="w-full flex items-center justify-between bg-white rounded-lg shadow px-4 py-3 text-sm font-medium text-gray-700"
          >
            <span className="flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              Filters
            </span>
            <svg className={`w-5 h-5 transition-transform ${mobileFiltersOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>

        {/* Filters Section */}
        <section className={`bg-white rounded-lg shadow p-3 sm:p-4 mb-4 sm:mb-6 ${mobileFiltersOpen ? 'block' : 'hidden'} md:block`}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1 font-medium">Section</label>
              <select className="w-full border border-gray-300 rounded-md px-2 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" value={filters.section} onChange={e => setFilters(s => ({ ...s, section: e.target.value }))}>
                <option value="">All</option>
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
              <label className="block text-xs text-gray-600 mb-1 font-medium">Category</label>
              <select className="w-full border border-gray-300 rounded-md px-2 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" value={filters.category} onChange={e => setFilters(s => ({ ...s, category: e.target.value }))}>
                <option value="">All</option>
                {agg?.facets?.categories?.map((c) => (<option key={c} value={c.toLowerCase()}>{c}</option>))}
              </select>
            </div>
            <div className="sm:col-span-2 lg:col-span-1">
              <label className="block text-xs text-gray-600 mb-1 font-medium">Query</label>
              <input className="w-full border border-gray-300 rounded-md px-2 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="Search..." value={filters.q} onChange={e => setFilters(s => ({ ...s, q: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1 font-medium">Start</label>
              <input type="month" className="w-full border border-gray-300 rounded-md px-2 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="2023-01" value={filters.startYm} onChange={e => setFilters(s => ({ ...s, startYm: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1 font-medium">End</label>
              <input type="month" className="w-full border border-gray-300 rounded-md px-2 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="2024-12" value={filters.endYm} onChange={e => setFilters(s => ({ ...s, endYm: e.target.value }))} />
            </div>
          </div>
          {(filters.section || filters.category || filters.q || filters.startYm || filters.endYm) && (
            <button
              className="mt-3 text-xs text-blue-600 hover:text-blue-700 font-medium"
              onClick={() => { setFilters({ section: '', category: '', q: '', startYm: '', endYm: '' }); setPagination(p => ({ ...p, offset: 0 })); setMobileFiltersOpen(false); }}
            >Clear all filters</button>
          )}
        </section>

        {/* Stats Cards */}
        <section className="mb-4 sm:mb-6 grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white rounded-lg shadow p-3 sm:p-4">
            <div className="text-xs text-gray-500 mb-1">Total Items</div>
            <div className="text-xl sm:text-2xl font-semibold text-gray-900">{agg?.total ?? 0}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-3 sm:p-4">
            <div className="text-xs text-gray-500 mb-1">Sections</div>
            <div className="text-xl sm:text-2xl font-semibold text-gray-900">{agg?.facets?.sections?.length ?? 0}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-3 sm:p-4">
            <div className="text-xs text-gray-500 mb-1">Categories</div>
            <div className="text-xl sm:text-2xl font-semibold text-gray-900">{agg?.facets?.categories?.length ?? 0}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-3 sm:p-4">
            <div className="text-xs text-gray-500 mb-1">Months</div>
            <div className="text-xl sm:text-2xl font-semibold text-gray-900">{agg?.by_year_month?.labels?.length ?? 0}</div>
          </div>
        </section>

        {/* Charts Section */}
        <section className="mb-4 sm:mb-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg shadow p-4 sm:p-6 h-64 sm:h-80">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold text-gray-700">{isCategoryFiltered ? 'Sections for Category' : 'Top Categories'}</h2>
            </div>
            {!isCategoryFiltered && catData && <Bar data={catData} options={catBarOptions} />}
            {isCategoryFiltered && sectionBarForCategory && <Bar data={sectionBarForCategory} options={catBarOptions} />}
          </div>
          <div className="bg-white rounded-lg shadow p-4 sm:p-6 h-64 sm:h-80">
            <h2 className="text-sm font-semibold text-gray-700 mb-2">By Section</h2>
            {secData && <Doughnut data={secData} options={doughnutOptions} />} 
          </div>
          <div className="bg-white rounded-lg shadow p-4 sm:p-6 h-64 sm:h-80">
            <h2 className="text-sm font-semibold text-gray-700 mb-2">By Month</h2>
            {timeData && <Line data={timeData} options={lineOptions} />} 
          </div>
        </section>

        {/* Monthly Stacked Chart */}
        <section className="mb-4 sm:mb-6 grid grid-cols-1">
          <div className="bg-white rounded-lg shadow p-4 sm:p-6 h-72 sm:h-96">
            <h2 className="text-sm font-semibold text-gray-700 mb-2">Monthly Items by Section</h2>
            {monthlyStackedData && <Bar data={monthlyStackedData} options={stackedBarOptions} />}
          </div>
        </section>

        {/* Items Table/List */}
        <section className="bg-white rounded-lg shadow p-3 sm:p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm sm:text-base font-semibold text-gray-700">Latest Items</h2>
            {agg && <span className="text-xs sm:text-sm text-gray-600">Total: {agg.total}</span>}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto rounded-md border border-gray-200">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-gray-700">
                <tr>
                  <th className="text-left font-semibold px-3 py-2">Section</th>
                  <th className="text-left font-semibold px-3 py-2">Category</th>
                  <th className="text-left font-semibold px-3 py-2">Title</th>
                  <th className="text-left font-semibold px-3 py-2">Date</th>
                  <th className="text-left font-semibold px-3 py-2">Link</th>
                </tr>
              </thead>
              <tbody>
                {items?.items?.map((r, idx) => (
                  <tr key={idx} className="border-b last:border-0 hover:bg-gray-50/60 transition-colors">
                    <td className="px-3 py-2 text-gray-700">{r.section}</td>
                    <td className="px-3 py-2 text-gray-700 text-xs">{r.category}</td>
                    <td className="px-3 py-2 text-gray-900" title={(r.shortSummary || r.summary || '').toString()}>{r.title}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-gray-700">{r.date}</td>
                    <td className="px-3 py-2">
                      <a className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 hover:underline" href={r.url} target="_blank" rel="noreferrer noopener">
                        <span>Open</span>
                        <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M12.293 2.293a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L14 5.414V13a1 1 0 11-2 0V5.414L9.707 7.707A1 1 0 018.293 6.293l4-4z"/><path d="M3 9a2 2 0 012-2h3a1 1 0 010 2H5a1 1 0 00-1 1v5a1 1 0 001 1h10a1 1 0 001-1v-3a1 1 0 112 0v3a3 3 0 01-3 3H5a3 3 0 01-3-3V9z"/></svg>
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden space-y-3">
            {items?.items?.map((r, idx) => (
              <div key={idx} className="border border-gray-200 rounded-lg p-3">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-medium text-sm text-gray-900 flex-1 line-clamp-2">{r.title}</h3>
                  <a 
                    className="flex-shrink-0 text-blue-600 hover:text-blue-700 p-1" 
                    href={r.url} 
                    target="_blank" 
                    rel="noreferrer noopener"
                    aria-label="Open article"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
                      <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
                    </svg>
                  </a>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="inline-flex items-center px-2 py-1 rounded-full bg-blue-50 text-blue-700 font-medium">{r.section}</span>
                  <span className="inline-flex items-center px-2 py-1 rounded-full bg-gray-100 text-gray-700">{r.date}</span>
                </div>
                <p className="mt-2 text-xs text-gray-600 line-clamp-2">{r.category}</p>
              </div>
            ))}
          </div>

          {/* Pagination */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4 pt-3 border-t">
            <div className="text-xs text-gray-600">
              Showing {Math.min(pagination.offset + 1, agg?.total || 0)}–{Math.min(pagination.offset + pagination.limit, agg?.total || 0)} of {agg?.total || 0}
            </div>
            <div className="flex items-center gap-2">
              <button
                className="px-3 py-1.5 rounded-md text-sm border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
                disabled={pagination.offset === 0}
                onClick={() => setPagination(p => ({ ...p, offset: Math.max(0, p.offset - p.limit) }))}
              >Previous</button>
              <button
                className="px-3 py-1.5 rounded-md text-sm border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
                disabled={(agg?.total || 0) <= (pagination.offset + pagination.limit)}
                onClick={() => setPagination(p => ({ ...p, offset: p.offset + p.limit }))}
              >Next</button>
              <select
                className="border border-gray-300 bg-white rounded-md px-2 py-1.5 text-sm touch-manipulation"
                value={pagination.limit}
                onChange={(e) => setPagination({ limit: parseInt(e.target.value, 10), offset: 0 })}
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}


