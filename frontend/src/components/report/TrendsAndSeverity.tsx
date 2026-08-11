
'use client';
import React, { useState, useMemo } from 'react';
import { WarningCircle, Warning, Info, CircleDashed } from '@phosphor-icons/react';
import { useQAData } from '../../context/QADataContext';
import { useTheme } from '../../context/ThemeContext';
import { useContent } from '../../context/ContentContext';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';
import { BackendTest } from '../../lib/types';

function coverageFromTest(test: BackendTest): number | null {
  const scores = [test.scores.performance, test.scores.accessibility, test.scores.seo, test.scores.bestPractices].filter(
    (v): v is number => v != null
  );
  return scores.length ? scores.reduce((sum, v) => sum + v, 0) / scores.length : null;
}

// Buckets completed tests into 6 rolling 3-day windows and averages their
// scores, so the trend reflects actual scan history instead of mock data.
const buildTrendData = (tests: BackendTest[]) => {
  const today = new Date();
  const scored = tests.filter((t) => t.score != null && t.completedAt);

  const data = [];
  for (let i = 5; i >= 0; i--) {
    const windowEnd = new Date(today);
    windowEnd.setDate(today.getDate() - i * 3);
    const windowStart = new Date(windowEnd);
    windowStart.setDate(windowEnd.getDate() - 3);

    const inWindow = scored.filter((t) => {
      const completed = new Date(t.completedAt as string);
      return completed > windowStart && completed <= windowEnd;
    });

    const quality = inWindow.length
      ? inWindow.reduce((sum, t) => sum + (t.score as number), 0) / inWindow.length
      : null;
    const coverageValues = inWindow.map(coverageFromTest).filter((v): v is number => v != null);
    const coverage = coverageValues.length ? coverageValues.reduce((sum, v) => sum + v, 0) / coverageValues.length : null;

    data.push({
      name: windowEnd.toLocaleDateString('en-US', { month: 'short', day: '2-digit' }),
      quality: quality != null ? Math.round(quality) : null,
      coverage: coverage != null ? Math.round(coverage) : null,
    });
  }
  return data;
};

interface TrendTooltipEntry {
  value?: string | number;
  payload?: { name?: string };
}

// Declared outside the component (not per-render) so Recharts doesn't get a
// freshly-created component instance on every render.
const CustomTooltip = ({
  active,
  payload,
  metricLabel,
}: {
  active?: boolean;
  payload?: TrendTooltipEntry[];
  metricLabel: string;
}) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900 dark:bg-slate-950 text-white text-xs font-bold px-3 py-1.5 rounded shadow-md flex items-center gap-1.5 border border-transparent dark:border-slate-700">
        <span className="w-2 h-2 rounded-full bg-blue-400"></span>
        {payload[0].value}% {metricLabel} ({payload[0].payload?.name})
      </div>
    );
  }
  return null;
};

export const TrendsAndSeverity: React.FC = () => {
  const { stats, tests } = useQAData();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const [activeMetric, setActiveMetric] = useState<'quality' | 'coverage'>('quality');
  const performanceTitle = useContent('scanResults.trends.performanceTitle', { text: 'Stability & Performance Trends' });
  const performanceSubtitle = useContent('scanResults.trends.performanceSubtitle', {
    text: 'Average scoring metrics across continuous deployment test pipelines',
  });
  const qualityToggle = useContent('scanResults.trends.qualityToggle', { text: 'Quality' });
  const coverageToggle = useContent('scanResults.trends.coverageToggle', { text: 'Coverage' });
  const severityTitle = useContent('scanResults.trends.severityTitle', { text: 'Issue Severity distribution' });
  const severitySubtitle = useContent('scanResults.trends.severitySubtitle', {
    text: 'Categorized breakdown of existing unresolved bug logs',
  });

  // useMemo so the rolling date windows don't recompute (and jitter) on every render
  const dynamicTrendData = useMemo(() => buildTrendData(tests), [tests]);

  const sev = stats?.issuesBySeverity ?? { critical: 0, high: 0, medium: 0, low: 0 };

  const rows = [
    { key: 'critical', label: 'Critical', icon: <WarningCircle />, color: 'text-red-600 dark:text-red-400', bar: 'bg-red-500', count: sev.critical },
    { key: 'high', label: 'Major', icon: <Warning />, color: 'text-orange-600 dark:text-orange-400', bar: 'bg-orange-500', count: sev.high },
    { key: 'medium', label: 'Minor', icon: <Info />, color: 'text-blue-600 dark:text-blue-400', bar: 'bg-blue-500', count: sev.medium },
    { key: 'low', label: 'Cosmetic', icon: <CircleDashed />, color: 'text-slate-500 dark:text-slate-400', bar: 'bg-slate-400', count: sev.low },
  ];

  const metricLabel = activeMetric === 'quality' ? qualityToggle.text : coverageToggle.text;
  const totalIssues = rows.reduce((sum, row) => sum + row.count, 0);
  const siteCount = new Set(tests.map((t) => t.url)).size;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

      {/* LEFT PANEL: Stability & Performance Trends */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm lg:col-span-2 flex flex-col justify-between">
        <div>
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">{performanceTitle.text}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{performanceSubtitle.text}</p>
            </div>

            {/* Toggle Tabs (Quality / Coverage) */}
            <div className="bg-slate-100 dark:bg-slate-900/50 p-1 rounded-lg flex items-center gap-1">
              <button
                onClick={() => setActiveMetric('quality')}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${activeMetric === 'quality' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}
              >
                {qualityToggle.text}
              </button>
              <button
                onClick={() => setActiveMetric('coverage')}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${activeMetric === 'coverage' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}
              >
                {coverageToggle.text}
              </button>
            </div>
          </div>
        </div>

        {/* Recharts Area Graph Component Frame */}
        <div className="h-56 mt-6 w-full text-slate-400 dark:text-slate-500 text-[11px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={dynamicTrendData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
              <defs>
                <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2E7BF6" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#2E7BF6" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="name"
                axisLine={false}
                tickLine={false}
                dy={10}
                tick={{ fill: isDark ? '#64748b' : '#94a3b8' }}
                className="font-medium text-slate-400"
              />
              <YAxis
                domain={[0, 100]}
                axisLine={false}
                tickLine={false}
                hide={true}
              />
              <Tooltip content={<CustomTooltip metricLabel={metricLabel} />} cursor={{ stroke: '#2E7BF6', strokeWidth: 1, strokeDasharray: '4 4' }} />
              <Area
                type="monotone"
                dataKey={activeMetric} // Dynamic key mapping based on state (quality or coverage)
                stroke="#2E7BF6"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#colorScore)"
                activeDot={{ r: 5, stroke: 'white', strokeWidth: 2, fill: '#2E7BF6' }}
                dot={{ r: 4, stroke: 'white', strokeWidth: 2, fill: '#2E7BF6' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* RIGHT PANEL: Issue Severity Distribution */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-between">
        <div>
          <h3 className="font-bold text-slate-900 dark:text-slate-100">{severityTitle.text}</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{severitySubtitle.text}</p>
        </div>

        <div className="space-y-4 my-6">
          {rows.map((row) => {
            const pct = totalIssues === 0 ? 0 : Math.round((row.count / totalIssues) * 100);
            return (
              <div key={row.key}>
                <div className="flex justify-between text-xs font-semibold mb-1">
                  <span className={`flex items-center gap-1.5 ${row.color}`}>
                    {row.icon} {row.label}
                  </span>
                  <span className="text-slate-600 dark:text-slate-400 font-medium">
                    {pct}% ({row.count} Issues)
                  </span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-900/50 rounded-full h-2 overflow-hidden">
                  <div className={`${row.bar} h-2 rounded-full transition-all duration-700 ease-out`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>

        <div className="text-xs text-slate-400 dark:text-slate-500 text-center border-t border-slate-100 dark:border-slate-800 pt-3">
          Total open tickets: <span className="font-bold text-slate-700 dark:text-slate-300">{stats?.unresolvedIssues ?? 0}</span> across {siteCount} site{siteCount === 1 ? '' : 's'}
        </div>
      </div>

    </div>
  );
};