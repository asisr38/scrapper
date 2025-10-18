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
        ticks: { color: axisColor, font: { size: 12, weight: '500' as const }, precision: 0 },
        border: { color: borderColor },
        beginAtZero: true,
      },
      y: {
        grid: { color: gridColor, drawBorder: false },
        ticks: { color: axisColor, font: { size: 12, weight: '500' as const }, callback: (v: any, i: number, ticks: any[]) => {
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
    <div className="max-w-7xl mx-auto px-4 py-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold">FAO Gender Dashboard</h1>
        <p className="text-sm text-gray-600">JSON source: <span className="font-mono">{csvPath || 'default (public/env)'}</span></p>
      </header>

      <section className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <div>
            <label className="block text-xs text-gray-600 mb-1">Section</label>
            <select className="w-full border rounded px-2 py-1" value={filters.section} onChange={e => setFilters(s => ({ ...s, section: e.target.value }))}>
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
            <label className="block text-xs text-gray-600 mb-1">Category</label>
            <select className="w-full border rounded px-2 py-1" value={filters.category} onChange={e => setFilters(s => ({ ...s, category: e.target.value }))}>
              <option value="">All</option>
              {agg?.facets?.categories?.map((c) => (<option key={c} value={c.toLowerCase()}>{c}</option>))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Query</label>
            <input className="w-full border rounded px-2 py-1" placeholder="Search title/summary" value={filters.q} onChange={e => setFilters(s => ({ ...s, q: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Start (YYYY-MM)</label>
            <input className="w-full border rounded px-2 py-1" placeholder="2023-01" value={filters.startYm} onChange={e => setFilters(s => ({ ...s, startYm: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">End (YYYY-MM)</label>
            <input className="w-full border rounded px-2 py-1" placeholder="2024-12" value={filters.endYm} onChange={e => setFilters(s => ({ ...s, endYm: e.target.value }))} />
          </div>
        </div>
      </section>

      <section className="mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4"><div className="text-xs text-gray-500">Total Items</div><div className="text-2xl font-semibold">{agg?.total ?? 0}</div></div>
        <div className="bg-white rounded-lg shadow p-4"><div className="text-xs text-gray-500">Sections</div><div className="text-2xl font-semibold">{agg?.facets?.sections?.length ?? 0}</div></div>
        <div className="bg-white rounded-lg shadow p-4"><div className="text-xs text-gray-500">Categories</div><div className="text-2xl font-semibold">{agg?.facets?.categories?.length ?? 0}</div></div>
        <div className="bg-white rounded-lg shadow p-4"><div className="text-xs text-gray-500">Months Covered</div><div className="text-2xl font-semibold">{agg?.by_year_month?.labels?.length ?? 0}</div></div>
      </section>
      <section className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-6 h-80">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-gray-700">{isCategoryFiltered ? 'Sections for Category' : 'Top Categories'}</h2>
            {(filters.section || filters.category || filters.q || filters.startYm || filters.endYm) && (
              <button
                className="text-xs text-blue-600 hover:text-blue-700"
                onClick={() => { setFilters({ section: '', category: '', q: '', startYm: '', endYm: '' }); setPagination(p => ({ ...p, offset: 0 })); }}
              >Clear filters</button>
            )}
          </div>
          {!isCategoryFiltered && catData && <Bar data={catData} options={catBarOptions} />}
          {isCategoryFiltered && sectionBarForCategory && <Bar data={sectionBarForCategory} options={catBarOptions} />}
        </div>
        <div className="bg-white rounded-lg shadow p-6 h-80">
          <h2 className="text-sm font-semibold text-gray-700 mb-2">By Section</h2>
          {secData && <Doughnut data={secData} options={doughnutOptions} />} 
        </div>
        <div className="bg-white rounded-lg shadow p-6 h-80">
          <h2 className="text-sm font-semibold text-gray-700 mb-2">By Month</h2>
          {timeData && <Line data={timeData} options={lineOptions} />} 
        </div>
      </section>

      <section className="mb-6 grid grid-cols-1">
        <div className="bg-white rounded-lg shadow p-6 h-96">
          <h2 className="text-sm font-semibold text-gray-700 mb-2">Monthly Items by Section</h2>
          {monthlyStackedData && <Bar data={monthlyStackedData} options={stackedBarOptions} />}
        </div>
      </section>

      <section className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-700">Latest Items</h2>
          {agg && <span className="text-sm text-gray-600">Total: {agg.total}</span>}
        </div>
        <div className="overflow-x-auto rounded-md border border-gray-200">
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
                  <td className="px-3 py-2 text-gray-700">{r.category}</td>
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
        <div className="flex items-center justify-between mt-3">
          <div className="text-xs text-gray-600">Showing {Math.min(pagination.offset + 1, agg?.total || 0)}–{Math.min(pagination.offset + pagination.limit, agg?.total || 0)} of {agg?.total || 0}</div>
          <div className="flex items-center gap-2">
            <button
              className="px-3 py-1.5 rounded-md text-sm border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50"
              disabled={pagination.offset === 0}
              onClick={() => setPagination(p => ({ ...p, offset: Math.max(0, p.offset - p.limit) }))}
            >Previous</button>
            <button
              className="px-3 py-1.5 rounded-md text-sm border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50"
              disabled={(agg?.total || 0) <= (pagination.offset + pagination.limit)}
              onClick={() => setPagination(p => ({ ...p, offset: p.offset + p.limit }))}
            >Next</button>
            <select
              className="ml-2 border border-gray-300 bg-white rounded-md px-2 py-1.5 text-sm"
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
  );
}


