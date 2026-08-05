import React, { useState } from 'react';

interface Counts {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
}

interface CicdSummaryProps {
  status: 'Passed' | 'Failed' | 'Running' | 'Idle';
  counts: Counts | null;
  logs: string[];
  workflowRunUrl?: string | null;
}

export const CicdSummaryCard: React.FC<CicdSummaryProps> = ({ status, counts, logs, workflowRunUrl }) => {
  const [showLogs, setShowLogs] = useState(false);
  const c = counts || { total: 0, passed: 0, failed: 0, skipped: 0 };
  const passRate = c.total > 0 ? Math.round((c.passed / c.total) * 100) : 0;

  const statusStyle =
    status === 'Passed'
      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400'
      : status === 'Failed'
        ? 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400'
        : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400';

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-6">
      <div className="flex items-center justify-between gap-2 mb-4">
        <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <span>🧩</span> CI/CD Test Summary
        </h3>
        <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full flex items-center gap-1 ${statusStyle}`}>
          {status === 'Passed' ? '✓' : status === 'Failed' ? '✕' : '•'} {status}
        </span>
      </div>

      <p className="text-xs text-slate-400 dark:text-slate-500 mb-4">
        {c.total} automated check{c.total === 1 ? '' : 's'} run (Lighthouse audits, accessibility rules, SEO checks) · {passRate}% pass rate
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-700 p-3 text-center">
          <div className="text-lg font-black text-slate-800 dark:text-slate-100">{c.total}</div>
          <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">Total</div>
        </div>
        <div className="bg-emerald-50 dark:bg-emerald-950/30 rounded-lg border border-emerald-200 dark:border-emerald-900 p-3 text-center">
          <div className="text-lg font-black text-emerald-700 dark:text-emerald-400">{c.passed}</div>
          <div className="text-[10px] uppercase tracking-wider font-semibold text-emerald-600/80 dark:text-emerald-500/80">Passed</div>
        </div>
        <div className="bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-900 p-3 text-center">
          <div className="text-lg font-black text-red-700 dark:text-red-400">{c.failed}</div>
          <div className="text-[10px] uppercase tracking-wider font-semibold text-red-600/80 dark:text-red-500/80">Failed</div>
        </div>
        <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-700 p-3 text-center">
          <div className="text-lg font-black text-slate-600 dark:text-slate-300">{c.skipped}</div>
          <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">Skipped</div>
        </div>
      </div>

      <button
        onClick={() => setShowLogs((v) => !v)}
        className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
      >
        <i className={`ph ${showLogs ? 'ph-caret-down' : 'ph-caret-right'}`} /> {showLogs ? 'Hide' : 'View'} pipeline logs
      </button>
      {showLogs && (
        <pre className="mt-2 text-[11px] font-mono bg-slate-900 text-slate-300 rounded-lg p-3 overflow-x-auto leading-relaxed">
          {logs.join('\n')}
        </pre>
      )}
      {workflowRunUrl && (
        <a href={workflowRunUrl} target="_blank" rel="noreferrer" className="block mt-2 text-xs text-blue-600 dark:text-blue-400 hover:underline">
          View GitHub Actions run →
        </a>
      )}
    </div>
  );
};
