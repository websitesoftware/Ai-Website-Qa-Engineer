'use client';
import React from 'react';
import { motion } from 'framer-motion';
import { FileText, ChartLine, SealCheck, Browser, ArrowUpRight, CheckSquare } from '@phosphor-icons/react';
import { useQAData } from '../../context/QADataContext';
import { AnimatedCounter } from '../ui/AnimatedCounter';
import { Skeleton } from '../ui/Skeleton';

export const StatsGrid: React.FC = () => {
  const { stats, tests, loading } = useQAData();

  if (loading && !stats) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
    );
  }

  const resolvedCount = tests.reduce((sum, t) => sum + t.issues.filter((i) => i.resolved).length, 0);
  const resolutionRate = stats && stats.totalIssues > 0 ? Math.round((resolvedCount / stats.totalIssues) * 100) : 0;

  const cards = [
    {
      label: 'Total Tests',
      value: stats?.total ?? 0,
      icon: <FileText />,
      bg: 'bg-blue-50 dark:bg-blue-950/40',
      text: 'text-blue-500 dark:text-blue-400',
      sub: (
        <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1 mt-1.5">
          <ArrowUpRight weight="bold" /> {stats?.passed ?? 0} passed
        </span>
      ),
    },
    {
      label: 'Average Quality Score',
      value: stats?.avgScore ?? 0,
      suffix: '%',
      icon: <ChartLine />,
      bg: 'bg-emerald-50 dark:bg-emerald-950/40',
      text: 'text-emerald-600 dark:text-emerald-400',
      sub: <span className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1.5 block">across {stats?.total ?? 0} scans</span>,
    },
    {
      label: 'Resolved Issues',
      value: resolvedCount,
      icon: <SealCheck />,
      bg: 'bg-blue-50 dark:bg-blue-950/40',
      text: 'text-blue-600 dark:text-blue-400',
      sub: (
        <span className="text-xs text-blue-600 dark:text-blue-400 font-medium flex items-center gap-1 mt-1.5">
          <CheckSquare /> {resolutionRate}% resolution rate
        </span>
      ),
    },
    {
      label: 'Failed Scans',
      value: stats?.failed ?? 0,
      icon: <Browser />,
      bg: 'bg-amber-50 dark:bg-amber-950/40',
      text: 'text-amber-600 dark:text-amber-400',
      sub: <span className="text-xs text-slate-500 dark:text-slate-400 mt-2 block">{stats?.running ?? 0} currently running</span>,
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
      {cards.map((c, i) => (
        <motion.div
          key={c.label}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05, duration: 0.35 }}
          className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-between"
        >
          <div>
            <span className="text-sm font-medium text-slate-500 dark:text-slate-400 block">{c.label}</span>
            <span className="text-2xl font-bold text-slate-900 dark:text-slate-100 block mt-1">
              <AnimatedCounter value={c.value} />
              {c.suffix}
            </span>
            {c.sub}
          </div>
          <div className={`w-12 h-12 rounded-xl ${c.bg} ${c.text} flex items-center justify-center text-2xl`}>{c.icon}</div>
        </motion.div>
      ))}
    </div>
  );
};
