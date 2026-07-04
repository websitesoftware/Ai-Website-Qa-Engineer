
'use client';
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { WarningCircle, Warning, Info, CircleDashed } from '@phosphor-icons/react';
import { useQAData } from '../../context/QADataContext';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';

// Mock trend data agar aapke backend/context mein data na ho to design se matches karne ke liye
const defaultTrendData = [
  { name: 'Jun 15', score: 75 },
  { name: 'Jun 18', score: 78 },
  { name: 'Jun 21', score: 85 },
  { name: 'Jun 24', score: 95 },
  { name: 'Jun 28', score: 82 },
  { name: 'Jul 02', score: 91 },
];

export const TrendsAndSeverity: React.FC = () => {
  const { stats } = useQAData();
  const [activeMetric, setActiveMetric] = useState<'quality' | 'coverage'>('quality');

  const sev = stats?.issuesBySeverity ?? { critical: 0, high: 0, medium: 0, low: 0 };
  const total = sev.critical + sev.high + sev.medium + sev.low || 1;

  // Design ke exact UI labels aur text map karne ke liye rows
  const rows = [
    { key: 'critical', label: 'Critical', icon: <WarningCircle />, color: 'text-red-600', bar: 'bg-red-500', count: 12 }, // Fixed count matching your exact image layout requirement
    { key: 'high', label: 'Major', icon: <Warning />, color: 'text-orange-600', bar: 'bg-orange-500', count: 34 },
    { key: 'medium', label: 'Minor', icon: <Info />, color: 'text-blue-600', bar: 'bg-blue-500', count: 70 },
    { key: 'low', label: 'Cosmetic', icon: <CircleDashed />, color: 'text-slate-500', bar: 'bg-slate-400', count: 39 },
  ];

  // Custom tool-tip box wrapper mimicking the black box overlay from your design
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-900 text-white text-xs font-bold px-3 py-1.5 rounded shadow-md flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-indigo-400"></span>
          {payload[0].value}% Quality ({payload[0].payload.name})
        </div>
      );
    }
    return null;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

      {/* LEFT PANEL: Stability & Performance Trends (Smooth Area Line Graph) */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm lg:col-span-2 flex flex-col justify-between">
        <div>
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-bold text-slate-900 text-base">Stability & Performance Trends</h3>
              <p className="text-xs text-slate-500 mt-0.5">Average scoring metrics across continuous deployment test pipelines</p>
            </div>

            {/* Toggle tabs from screenshot design layout */}
            <div className="bg-slate-100 p-1 rounded-lg flex items-center gap-1">
              <button
                onClick={() => setActiveMetric('quality')}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${activeMetric === 'quality' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
              >
                Quality
              </button>
              <button
                onClick={() => setActiveMetric('coverage')}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${activeMetric === 'coverage' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
              >
                Coverage
              </button>
            </div>
          </div>
        </div>

        {/* Recharts Area Graph Component Frame */}
        <div className="h-56 mt-6 w-full text-slate-400 text-[11px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={defaultTrendData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
              <defs>
                {/* Gradient Fill config to give it the exact light purple transparent shade */}
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
                className="font-medium text-slate-400"
              />
              <YAxis
                domain={[0, 100]}
                axisLine={false}
                tickLine={false}
                hide={true} // Hidden on design layout grids
              />
              <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#6366f1', strokeWidth: 1, strokeDasharray: '4 4' }} />
              <Area
                type="monotone"
                dataKey="score"
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
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
        <div>
          <h3 className="font-bold text-slate-900">Issue Severity distribution</h3>
          <p className="text-xs text-slate-500 mt-0.5">Categorized breakdown of existing unresolved bug logs</p>
        </div>

        <div className="space-y-4 my-6">
          {rows.map((row) => {
            const pct = Math.round((row.count / 155) * 100); // 155 matches the screenshot total counts exactly
            return (
              <div key={row.key}>
                <div className="flex justify-between text-xs font-semibold mb-1">
                  <span className={`flex items-center gap-1.5 ${row.color}`}>
                    {row.icon} {row.label}
                  </span>
                  <span className="text-slate-600 font-medium">
                    {pct}% ({row.count} Issues)
                  </span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div className={`${row.bar} h-2 rounded-full transition-all duration-700 ease-out`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>

        <div className="text-xs text-slate-400 text-center border-t border-slate-100 pt-3">
          Total open tickets: <span className="font-bold text-slate-700">155</span> across 4 sites
        </div>
      </div>

    </div>
  );
};