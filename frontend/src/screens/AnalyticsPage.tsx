'use client';
import React, { useEffect, useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { StatCard } from '../components/StatCard';
import { EmptyState } from '../components/ui/EmptyState';
import { Skeleton } from '../components/ui/Skeleton';
import { api } from '../lib/api';
import { BackendAnalytics } from '../lib/types';
import { formatDate } from '../lib/format';
import { useContent } from '../context/ContentContext';

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#3b82f6',
  low: '#94a3b8',
};

interface TooltipEntry {
  name?: string;
  value?: string | number;
  color?: string;
  payload?: { fill?: string };
}
interface LightTooltipProps {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string | number;
  suffix?: string;
}

const LightTooltip = ({ active, payload, label, suffix = '' }: LightTooltipProps) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-md rounded-lg px-3 py-2 text-xs">
      {label != null && <p className="font-semibold text-slate-700 dark:text-slate-300 mb-0.5">{label}</p>}
      {payload.map((p, i) => (
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

const RANGE_OPTIONS = [
  { label: '7 days', days: 7 },
  { label: '30 days', days: 30 },
  { label: '90 days', days: 90 },
] as const;

export const AnalyticsPage: React.FC = () => {
  const { user } = useAuth();
  const { resolvedTheme } = useTheme();
  const { showToast } = useToast();
  const isDark = resolvedTheme === 'dark';
  const gridStroke = isDark ? '#334155' : '#f1f5f9';
  const tickFillStrong = isDark ? '#94a3b8' : '#64748b';
  const tickFillMuted = isDark ? '#64748b' : '#94a3b8';
  const cursorFill = isDark ? '#1e293b' : '#f8fafc';

  const [days, setDays] = useState<number>(30);
  const [data, setData] = useState<BackendAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  const pageTitle = useContent('dashboard.analytics.title', { text: 'Historical QA Analytics' });
  const pageSubtitle = useContent('dashboard.analytics.subtitle', { text: 'Trends across every scan, computed live from your test history.' });
  const scoreTrendCard = useContent('dashboard.analytics.scoreTrend.title', { text: 'Score Trend' });
  const scoreTrendSubtitle = useContent('dashboard.analytics.scoreTrend.subtitle', { text: 'Average overall score per day' });
  const topDomainsCard = useContent('dashboard.analytics.topDomains.title', { text: 'Top Domains' });
  const topDomainsSubtitle = useContent('dashboard.analytics.topDomains.subtitle', { text: 'Most-scanned URLs in range' });
  const passFailCard = useContent('dashboard.analytics.passFail.title', { text: 'Pass vs Fail' });
  const passFailSubtitle = useContent('dashboard.analytics.passFail.subtitle', { text: 'Daily outcome counts' });
  const severityCard = useContent('dashboard.analytics.issuesBySeverity.title', { text: 'Issues by Severity' });
  const severitySubtitle = useContent('dashboard.analytics.issuesBySeverity.subtitle', { text: 'Daily issue counts detected across all scans' });

  useEffect(() => {
    // No fetch to make while signed out — the component renders its own
    // "sign in required" state below without ever reading `loading`.
    if (!user) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- kicks off the fetch below; mirrors QADataContext's fetch-on-mount pattern
    setLoading(true);
    api.analytics
      .get(days)
      .then((res) => !cancelled && setData(res))
      .catch((err) => showToast(err instanceof Error ? err.message : 'Could not load analytics', 'error'))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, days]);

  if (!user) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
        <EmptyState icon="ph-lock-key" title="Sign in required" description="Sign in from the Account menu to view historical QA analytics." />
      </div>
    );
  }

  const fmtDay = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
  const scoreTrend = (data?.scoreTrend ?? []).map((p) => ({ name: fmtDay(p.date), score: p.avgScore ?? 0 }));
  const passFailTrend = (data?.passFailTrend ?? []).map((p) => ({ name: fmtDay(p.date), Passed: p.passed, Failed: p.failed }));
  const severityTrend = (data?.issuesBySeverityTrend ?? []).map((p) => ({
    name: fmtDay(p.date),
    Critical: p.critical,
    High: p.high,
    Medium: p.medium,
    Low: p.low,
  }));

  return (
    <div className="space-y-6 animate-fade-in w-full">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{pageTitle.text}</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{pageSubtitle.text}</p>
        </div>
        <div className="flex gap-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-1">
          {RANGE_OPTIONS.map((r) => (
            <button
              key={r.days}
              onClick={() => setDays(r.days)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                days === r.days ? 'bg-indigo-500 text-white' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900/50'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-72 rounded-xl" />
        </div>
      ) : !data || data.summary.totalTests === 0 ? (
        <div className="bg-white dark:bg-slate-800 p-10 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 text-center">
          <p className="text-3xl mb-2">📈</p>
          <p className="font-bold text-slate-800 dark:text-slate-200">No scan history yet</p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Run a few tests — trends fill in automatically once results exist.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <StatCard title="Total Scans" value={data.summary.totalTests} icon="ph-scan" variant="primary" />
            <StatCard title="Avg Score (all time)" value={data.summary.avgScoreAllTime ?? 0} subValue="/100" icon="ph-gauge" variant="success" />
            <StatCard title="Avg Score (7d)" value={data.summary.avgScoreLast7d ?? 0} subValue="/100" icon="ph-calendar-check" variant="warning" />
            <StatCard
              title="7d Trend"
              value={data.summary.scoreDeltaPct ?? 0}
              subValue="%"
              icon={data.summary.scoreDeltaPct !== null && data.summary.scoreDeltaPct < 0 ? 'ph-trend-down' : 'ph-trend-up'}
              variant={data.summary.scoreDeltaPct !== null && data.summary.scoreDeltaPct < 0 ? 'danger' : 'success'}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <ChartCard title={scoreTrendCard.text} subtitle={scoreTrendSubtitle.text} className="lg:col-span-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={scoreTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="analyticsTrendFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: tickFillStrong }} />
                  <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: tickFillMuted }} />
                  <Tooltip content={<LightTooltip suffix="/100" />} cursor={{ stroke: '#6366f1', strokeWidth: 1, strokeDasharray: '4 4' }} />
                  <Area
                    type="monotone"
                    dataKey="score"
                    name="Avg Score"
                    stroke="#6366f1"
                    strokeWidth={2.5}
                    fill="url(#analyticsTrendFill)"
                    dot={{ r: 3, stroke: 'white', strokeWidth: 2, fill: '#6366f1' }}
                    activeDot={{ r: 5, stroke: 'white', strokeWidth: 2, fill: '#6366f1' }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title={topDomainsCard.text} subtitle={topDomainsSubtitle.text}>
              <div className="h-full overflow-y-auto space-y-2 pr-1">
                {data.topDomains.length === 0 && <p className="text-sm text-slate-400 text-center py-6">No domains yet</p>}
                {data.topDomains.map((d) => (
                  <div key={d.url} className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/50">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">{d.url}</p>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500">{d.testCount} scans · {formatDate(d.lastScan)}</p>
                    </div>
                    <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400 shrink-0">{d.avgScore ?? '-'}</span>
                  </div>
                ))}
              </div>
            </ChartCard>

            <ChartCard title={passFailCard.text} subtitle={passFailSubtitle.text} className="lg:col-span-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={passFailTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: tickFillStrong }} />
                  <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: tickFillMuted }} />
                  <Tooltip content={<LightTooltip />} cursor={{ fill: cursorFill }} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Passed" stackId="pf" fill="#10b981" radius={[0, 0, 0, 0]} maxBarSize={32} />
                  <Bar dataKey="Failed" stackId="pf" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={32} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title={severityCard.text} subtitle={severitySubtitle.text}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={severityTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: tickFillStrong }} />
                  <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: tickFillMuted }} />
                  <Tooltip content={<LightTooltip />} cursor={{ fill: cursorFill }} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="Critical" stackId="sev" fill={SEVERITY_COLORS.critical} maxBarSize={28} />
                  <Bar dataKey="High" stackId="sev" fill={SEVERITY_COLORS.high} maxBarSize={28} />
                  <Bar dataKey="Medium" stackId="sev" fill={SEVERITY_COLORS.medium} maxBarSize={28} />
                  <Bar dataKey="Low" stackId="sev" fill={SEVERITY_COLORS.low} radius={[4, 4, 0, 0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>
        </>
      )}
    </div>
  );
};
