
'use client';
import React, { useState, useMemo } from 'react';
import { WarningCircle, Warning, Info, CircleDashed } from '@phosphor-icons/react';
import { useQAData } from '../../context/QADataContext';
import { useTheme } from '../../context/ThemeContext';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';

// Function jo present date ke hisab se pichle dino ke dynamic dates generate karega
const generateDynamicTrendData = () => {
  const data = [];
  const today = new Date();

  // Pichle 5 intervals (har 3 din pehle ki date) generate karne ke liye
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setDate(today.getDate() - (i * 3));

    const formattedDate = d.toLocaleDateString('en-US', {
      month: 'short',
      day: '2-digit',
    });

    // Dynamic mock values jo aapki image ke graph paths se match karti hain
    // Real project mein aap ise backend API data se replace kar sakte hain
    const qualityScores = [75, 78, 85, 95, 82, 91];
    const coverageScores = [65, 70, 72, 88, 80, 85];

    data.push({
      name: formattedDate,
      quality: qualityScores[5 - i] || 85,
      coverage: coverageScores[5 - i] || 80,
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
        <span className="w-2 h-2 rounded-full bg-indigo-400"></span>
        {payload[0].value}% {metricLabel} ({payload[0].payload?.name})
      </div>
    );
  }
  return null;
};

export const TrendsAndSeverity: React.FC = () => {
  const { stats } = useQAData();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const [activeMetric, setActiveMetric] = useState<'quality' | 'coverage'>('quality');

  // useMemo use kiya taaki har render par dates change na hon aur present date stable rahe
  const dynamicTrendData = useMemo(() => generateDynamicTrendData(), []);

  const sev = stats?.issuesBySeverity ?? { critical: 0, high: 0, medium: 0, low: 0 };

  const rows = [
    { key: 'critical', label: 'Critical', icon: <WarningCircle />, color: 'text-red-600 dark:text-red-400', bar: 'bg-red-500', count: 12 },
    { key: 'high', label: 'Major', icon: <Warning />, color: 'text-orange-600 dark:text-orange-400', bar: 'bg-orange-500', count: 34 },
    { key: 'medium', label: 'Minor', icon: <Info />, color: 'text-blue-600 dark:text-blue-400', bar: 'bg-blue-500', count: 70 },
    { key: 'low', label: 'Cosmetic', icon: <CircleDashed />, color: 'text-slate-500 dark:text-slate-400', bar: 'bg-slate-400', count: 39 },
  ];

  const metricLabel = activeMetric === 'quality' ? 'Quality' : 'Coverage';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

      {/* LEFT PANEL: Stability & Performance Trends */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm lg:col-span-2 flex flex-col justify-between">
        <div>
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">Stability & Performance Trends</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Average scoring metrics across continuous deployment test pipelines</p>
            </div>

            {/* Toggle Tabs (Quality / Coverage) */}
            <div className="bg-slate-100 dark:bg-slate-900/50 p-1 rounded-lg flex items-center gap-1">
              <button
                onClick={() => setActiveMetric('quality')}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${activeMetric === 'quality' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}
              >
                Quality
              </button>
              <button
                onClick={() => setActiveMetric('coverage')}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${activeMetric === 'coverage' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}
              >
                Coverage
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
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
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
              <Tooltip content={<CustomTooltip metricLabel={metricLabel} />} cursor={{ stroke: '#6366f1', strokeWidth: 1, strokeDasharray: '4 4' }} />
              <Area
                type="monotone"
                dataKey={activeMetric} // Dynamic key mapping based on state (quality or coverage)
                stroke="#6366f1"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#colorScore)"
                activeDot={{ r: 5, stroke: 'white', strokeWidth: 2, fill: '#6366f1' }}
                dot={{ r: 4, stroke: 'white', strokeWidth: 2, fill: '#6366f1' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* RIGHT PANEL: Issue Severity Distribution */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-between">
        <div>
          <h3 className="font-bold text-slate-900 dark:text-slate-100">Issue Severity distribution</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Categorized breakdown of existing unresolved bug logs</p>
        </div>

        <div className="space-y-4 my-6">
          {rows.map((row) => {
            const pct = Math.round((row.count / 155) * 100);
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
          Total open tickets: <span className="font-bold text-slate-700 dark:text-slate-300">155</span> across 4 sites
        </div>
      </div>

    </div>
  );
};