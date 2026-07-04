'use client';

import React from 'react';
import { StatsGrid } from '../components/report/StatsGrid';
import { TrendsAndSeverity } from '../components/report/TrendsAndSeverity';
import { ReportsTable } from '../components/report/ReportsTable';
import { useQAData } from '../context/QADataContext';
import { useToast } from '../context/ToastContext';

export const ReportsPage: React.FC = () => {
  const { tests } = useQAData();
  const { showToast } = useToast();

  const exportCsv = () => {
    const completed = tests.filter((t) => t.status === 'passed' || t.status === 'failed');
    if (completed.length === 0) {
      showToast('No completed reports to export yet', 'info');
      return;
    }

    const header = [
      'URL', 'Status', 'Score', 'Performance', 'Accessibility', 'SEO', 'BestPractices', 'BrokenLinks', 'Issues', 'CompletedAt',
    ];
    const rows = completed.map((t) => [
      t.url,
      t.status,
      t.score ?? '',
      t.scores.performance ?? '',
      t.scores.accessibility ?? '',
      t.scores.seo ?? '',
      t.scores.bestPractices ?? '',
      t.brokenLinks.length,
      t.issues.length,
      t.completedAt ?? '',
    ]);

    const csv = [header, ...rows]
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `qa-reports-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Reports exported as CSV', 'success');
  };

  return (
    <div className="space-y-6 animate-fade-in w-full">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Reports & Analytics</h2>
          <p className="text-sm text-slate-500 mt-1">Live QA scores, issue breakdown, and completed scan history.</p>
        </div>
        <button
          onClick={exportCsv}
          className="border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 px-4 py-2.5 rounded-lg font-medium text-sm transition-colors flex items-center gap-2"
        >
          <i className="ph ph-download-simple"></i> Export CSV
        </button>
      </div>

      <StatsGrid />
      <TrendsAndSeverity />
      <ReportsTable />
    </div>
  );
};
