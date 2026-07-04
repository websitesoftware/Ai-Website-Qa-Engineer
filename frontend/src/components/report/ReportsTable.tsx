'use client';
import React from 'react';
import { motion } from 'framer-motion';
import { useQAData } from '../../context/QADataContext';
import { useReportModal } from '../../context/ReportModalContext';
import { formatDate } from '../../lib/format';
import { EmptyState } from '../ui/EmptyState';

export const ReportsTable: React.FC = () => {
  const { tests, loading } = useQAData();
  const { openReport } = useReportModal();

  const completed = tests.filter((t) => t.status === 'passed' || t.status === 'failed');

  if (!loading && completed.length === 0) {
    return (
      <EmptyState
        icon="ph-file-text"
        title="No completed reports yet"
        description="Once a scan finishes, its report will show up here."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left text-sm text-slate-600">
          <thead className="text-xs text-slate-500 uppercase bg-slate-50/80 border-b border-slate-200">
            <tr>
              <th className="px-6 py-4 font-medium">Domain Name</th>
              <th className="px-6 py-4 font-medium">Lighthouse Specs</th>
              <th className="px-6 py-4 font-medium">Broken Links</th>
              <th className="px-6 py-4 font-medium">Overall Score</th>
              <th className="px-6 py-4 font-medium">Date Run</th>
              <th className="px-6 py-4 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {completed.map((test, i) => (
              <motion.tr
                key={test.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.04, 0.3) }}
                className="hover:bg-slate-50/50 transition-colors"
              >
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded bg-indigo-50 text-indigo-500 flex items-center justify-center text-md font-bold shrink-0">
                      {test.url.replace(/^https?:\/\//, '')[0]?.toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <span className="font-semibold text-slate-900 block truncate max-w-[220px]">{test.url}</span>
                      <span className="text-xs text-slate-400 block">ID: {test.id.slice(0, 8)}</span>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                      Perf: {test.scores.performance ?? '-'}
                    </span>
                    <span className="text-[11px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                      SEO: {test.scores.seo ?? '-'}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className={`font-medium ${test.brokenLinks.length > 0 ? 'text-red-500' : 'text-slate-700'}`}>
                    {test.brokenLinks.length} broken link{test.brokenLinks.length === 1 ? '' : 's'}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span
                    className={`inline-flex items-center gap-1.5 font-bold ${
                      (test.score ?? 0) >= 90
                        ? 'text-emerald-600'
                        : (test.score ?? 0) >= 70
                        ? 'text-indigo-600'
                        : (test.score ?? 0) >= 50
                        ? 'text-amber-500'
                        : 'text-red-500'
                    }`}
                  >
                    {test.score ?? '-'}/100
                  </span>
                </td>
                <td className="px-6 py-4 text-slate-500 font-medium">{formatDate(test.completedAt)}</td>
                <td className="px-6 py-4 text-right">
                  <button
                    onClick={() => openReport(test.id)}
                    className="text-indigo-500 hover:text-indigo-600 font-bold text-sm px-3 py-1 bg-indigo-50 rounded-md transition-colors"
                  >
                    Inspect
                  </button>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
