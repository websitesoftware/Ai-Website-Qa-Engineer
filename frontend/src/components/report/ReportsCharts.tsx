'use client';
import React, { useMemo } from 'react';
import { useQAData } from '../../context/QADataContext';
import { useTheme } from '../../context/ThemeContext';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { BackendTest } from '../../lib/types';

// Health colour from a 0-100 score: good = green, warn = amber, bad = red.
const scoreColor = (v: number | null | undefined): string => {
  if (v == null) return '#94a3b8';
  if (v >= 90) return '#10b981';
  if (v >= 50) return '#f59e0b';
  return '#ef4444';
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#3b82f6',
  low: '#94a3b8',
};

const CATEGORY_COLOR = '#6366f1';

// Short, readable label for a test (its hostname, else its name).
const shortLabel = (t: BackendTest): string => {
  try {
    return new URL(t.url).hostname.replace(/^www\./, '');
  } catch {
    return t.name || t.url;
  }
};

const fmtDate = (iso: string | null): string => {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
  } catch {
    return '';
  }
};

// Simple white tooltip that matches the light theme.
const LightTooltip = ({ active, payload, label, suffix = '' }: any) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-md rounded-lg px-3 py-2 text-xs">
      {label != null && <p className="font-semibold text-slate-700 dark:text-slate-300 mb-0.5">{label}</p>}
      {payload.map((p: any, i: number) => (
        <p key={i} className="text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color || p.payload?.fill }} />
          {p.name}: <span className="font-bold text-slate-800 dark:text-slate-200">{p.value}{suffix}</span>
        </p>
      ))}
    </div>
  );
};

const ChartCard: React.FC<{ title: string; subtitle?: string; className?: string; children: React.ReactNode }> = ({
  title,
  subtitle,
  className = '',
  children,
}) => (
  <div className={`bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm ${className}`}>
    <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">{title}</h3>
    {subtitle && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 mb-2">{subtitle}</p>}
    <div className="h-64 mt-4 w-full text-[11px] text-slate-400 dark:text-slate-500">{children}</div>
  </div>
);

export const ReportsCharts: React.FC = () => {
  const { tests, stats } = useQAData();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const gridStroke = isDark ? '#334155' : '#f1f5f9';
  const tickFillStrong = isDark ? '#94a3b8' : '#64748b';
  const tickFillMuted = isDark ? '#64748b' : '#94a3b8';
  const cursorFill = isDark ? '#1e293b' : '#f8fafc';

  const completed = useMemo(
    () => tests.filter((t) => t.status === 'passed' || t.status === 'failed'),
    [tests]
  );

  // 1. QA score per test (colour-coded by health)
  const scoreByTest = useMemo(
    () => completed.map((t) => ({ name: shortLabel(t), score: t.score ?? 0 })),
    [completed]
  );

  // 2. Issues by severity (real)
  const severityData = useMemo(() => {
    const s = stats?.issuesBySeverity ?? { critical: 0, high: 0, medium: 0, low: 0 };
    return (['critical', 'high', 'medium', 'low'] as const)
      .map((k) => ({ name: k[0].toUpperCase() + k.slice(1), key: k, value: s[k] }))
      .filter((d) => d.value > 0);
  }, [stats]);

  // 3. Score trend over time (real, oldest -> newest)
  const scoreTrend = useMemo(() => {
    return [...completed]
      .filter((t) => t.completedAt)
      .sort((a, b) => new Date(a.completedAt!).getTime() - new Date(b.completedAt!).getTime())
      .map((t) => ({ name: fmtDate(t.completedAt), score: t.score ?? 0 }));
  }, [completed]);

  // 4. Average Lighthouse category scores across all tests (real)
  const lighthouseAverages = useMemo(() => {
    const keys = ['performance', 'accessibility', 'seo', 'bestPractices'] as const;
    const labels: Record<string, string> = {
      performance: 'Performance',
      accessibility: 'Accessibility',
      seo: 'SEO',
      bestPractices: 'Best Practices',
    };
    return keys.map((k) => {
      const vals = completed
        .map((t) => t.scores?.[k])
        .filter((v): v is number => typeof v === 'number');
      const avg = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
      return { name: labels[k], value: avg };
    });
  }, [completed]);

  // 5. Pass vs Fail (real)
  const passFail = useMemo(
    () => [
      { name: 'Passed', value: stats?.passed ?? 0, color: '#10b981' },
      { name: 'Failed', value: stats?.failed ?? 0, color: '#ef4444' },
    ].filter((d) => d.value > 0),
    [stats]
  );

  // 6. Issues by category across all tests (real)
  const issuesByCategory = useMemo(() => {
    const counts: Record<string, number> = {};
    completed.forEach((t) =>
      (t.issues || []).forEach((i) => {
        counts[i.category] = (counts[i.category] || 0) + 1;
      })
    );
    return Object.entries(counts)
      .map(([name, value]) => ({ name: name.replace(/-/g, ' '), value }))
      .sort((a, b) => b.value - a.value);
  }, [completed]);

  if (completed.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-800 p-10 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 text-center">
        <p className="text-3xl mb-2">📊</p>
        <p className="font-bold text-slate-800 dark:text-slate-200">No completed scans yet</p>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Run a test against a website — the charts fill in automatically from real scan results.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* QA score per test — colour-coded */}
      <ChartCard
        title="QA Score by Website"
        subtitle="Green = healthy (≥90), amber = needs work, red = failing. Live from each scan."
        className="lg:col-span-2"
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={scoreByTest} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: tickFillStrong }} interval={0} />
            <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: tickFillMuted }} />
            <Tooltip content={<LightTooltip suffix="/100" />} cursor={{ fill: cursorFill }} />
            <Bar dataKey="score" name="Score" radius={[4, 4, 0, 0]} maxBarSize={48}>
              {scoreByTest.map((d, i) => (
                <Cell key={i} fill={scoreColor(d.score)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Issues by severity — donut */}
      <ChartCard title="Issues by Severity" subtitle="Real unresolved + resolved breakdown">
        {severityData.length === 0 ? (
          <div className="h-full flex items-center justify-center text-slate-400 dark:text-slate-500 text-sm">No issues detected 🎉</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={severityData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={3}>
                {severityData.map((d, i) => (
                  <Cell key={i} fill={SEVERITY_COLORS[d.key]} />
                ))}
              </Pie>
              <Tooltip content={<LightTooltip />} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* Score trend over time — area */}
      <ChartCard title="Score Trend Over Time" subtitle="Overall QA score of each scan, oldest to newest" className="lg:col-span-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={scoreTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: tickFillStrong }} />
            <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: tickFillMuted }} />
            <Tooltip content={<LightTooltip suffix="/100" />} cursor={{ stroke: '#6366f1', strokeWidth: 1, strokeDasharray: '4 4' }} />
            <Area type="monotone" dataKey="score" name="Score" stroke="#6366f1" strokeWidth={2.5} fill="url(#trendFill)"
              dot={{ r: 3, stroke: 'white', strokeWidth: 2, fill: '#6366f1' }}
              activeDot={{ r: 5, stroke: 'white', strokeWidth: 2, fill: '#6366f1' }} />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Pass vs Fail — donut */}
      <ChartCard title="Pass vs Fail" subtitle="Quality-gate outcome across all scans">
        {passFail.length === 0 ? (
          <div className="h-full flex items-center justify-center text-slate-400 dark:text-slate-500 text-sm">No results yet</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={passFail} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={3}>
                {passFail.map((d, i) => (
                  <Cell key={i} fill={d.color} />
                ))}
              </Pie>
              <Tooltip content={<LightTooltip />} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* Lighthouse category averages — colour-coded bars */}
      <ChartCard title="Average Lighthouse Scores" subtitle="Mean across all scanned sites, colour-coded by health">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={lighthouseAverages} layout="vertical" margin={{ top: 5, right: 20, left: 30, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} horizontal={false} />
            <XAxis type="number" domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: tickFillMuted }} />
            <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: tickFillStrong }} width={90} />
            <Tooltip content={<LightTooltip suffix="/100" />} cursor={{ fill: cursorFill }} />
            <Bar dataKey="value" name="Avg" radius={[0, 4, 4, 0]} maxBarSize={26}>
              {lighthouseAverages.map((d, i) => (
                <Cell key={i} fill={scoreColor(d.value)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Issues by category — bars */}
      <ChartCard title="Issues by Category" subtitle="Where problems cluster across every scan" className="lg:col-span-2">
        {issuesByCategory.length === 0 ? (
          <div className="h-full flex items-center justify-center text-slate-400 dark:text-slate-500 text-sm">No issues detected 🎉</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={issuesByCategory} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: tickFillStrong }} interval={0} />
              <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: tickFillMuted }} />
              <Tooltip content={<LightTooltip />} cursor={{ fill: cursorFill }} />
              <Bar dataKey="value" name="Issues" fill={CATEGORY_COLOR} radius={[4, 4, 0, 0]} maxBarSize={48} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>
    </div>
  );
};
