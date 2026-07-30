import React from 'react';
import { motion } from 'framer-motion';

interface PrioritizationProps {
  data: {
    bugId: string;
    title: string;
    severity: 'Critical' | 'High' | 'Medium' | 'Low';
    score: number;
    impactSummary: string;
  } | null;
}

export const BugPrioritization: React.FC<PrioritizationProps> = ({ data }) => {
  if (!data) {
    return (
      <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm animate-pulse mb-6">
        <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-1/3 mb-4"></div>
        <div className="h-10 bg-slate-100 dark:bg-slate-700/60 rounded mb-2"></div>
      </div>
    );
  }

  const severityStyles = {
    Critical: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-900',
    High: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900',
    Medium: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-900',
    Low: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900',
  };

  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ duration: 0.2 }}
      className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md mb-6"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <span>⚡</span> AI Bug Prioritization
        </h3>
        <motion.span
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.25 }}
          className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${severityStyles[data.severity]}`}
        >
          {data.severity} Severity
        </motion.span>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4 bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg">
        <div>
          <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 block">Ticket ID</span>
          <span className="text-sm font-mono font-bold text-slate-700 dark:text-slate-300">{data.bugId}</span>
        </div>
        <div>
          <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 block">AI Priority Score</span>
          <span className="text-sm font-bold text-slate-900 dark:text-slate-100">{data.score} <span className="text-xs text-slate-400">/100</span></span>
          <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden mt-1.5">
            <motion.div
              className="h-full bg-blue-600"
              initial={{ width: 0 }}
              animate={{ width: `${data.score}%` }}
              transition={{ duration: 0.7, ease: 'easeOut', delay: 0.1 }}
            />
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 block mb-0.5">Bug Target</span>
          <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{data.title}</p>
        </div>
        <div>
          <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 block mb-0.5">AI Impact Assessment</span>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{data.impactSummary}</p>
        </div>
      </div>
    </motion.div>
  );
};
