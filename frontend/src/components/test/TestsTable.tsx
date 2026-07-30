'use client';
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BackendTest } from '../../lib/types';
import { timeAgo } from '../../lib/format';
import { useReportModal } from '../../context/ReportModalContext';
import { Skeleton } from '../ui/Skeleton';
import { EmptyState } from '../ui/EmptyState';
import { useContent } from '../../context/ContentContext';

interface TestsTableProps {
  tests: BackendTest[];
  totalCount: number;
  loading: boolean;
  page: number;
  pageSize: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onDelete: (id: string) => void;
  onRerun: (id: string) => void;
}

const statusBadge = (status: BackendTest['status']) => {
  switch (status) {
    case 'passed':
      return (
        <span className="text-emerald-700 dark:text-emerald-400 font-medium text-xs bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-full border border-emerald-100 dark:border-emerald-900">
          Passed
        </span>
      );
    case 'failed':
      return (
        <span className="text-red-700 dark:text-red-400 font-medium text-xs bg-red-50 dark:bg-red-950/40 px-2.5 py-1 rounded-full border border-red-100 dark:border-red-900">
          Failed
        </span>
      );
    case 'error':
      return (
        <span className="text-slate-600 dark:text-slate-300 font-medium text-xs bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-full border border-slate-200 dark:border-slate-700">
          Error
        </span>
      );
    default:
      return (
        <div className="flex items-center gap-2">
          <i className="ph ph-spinner-gap animate-spin text-blue-500 dark:text-blue-400 text-lg"></i>
          <span className="text-blue-600 dark:text-blue-400 font-medium text-xs bg-blue-50 dark:bg-blue-950/40 px-2 py-1 rounded-full capitalize">
            {status === 'queued' ? 'Queued' : 'Running'}
          </span>
        </div>
      );
  }
};

export const TestsTable: React.FC<TestsTableProps> = ({
  tests,
  totalCount,
  loading,
  page,
  pageSize,
  totalPages,
  onPageChange,
  onDelete,
  onRerun,
}) => {
  const { openReport } = useReportModal();
  const emptyTitle = useContent('tests.empty.title', { text: 'No tests yet', icon: 'ph-flask' });
  const emptyDescription = useContent('tests.empty.description', { text: 'Run your first AI QA scan to see results here.' });

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
      <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
        <thead className="text-xs text-slate-500 dark:text-slate-400 uppercase bg-slate-50/80 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700">
          <tr>
            <th className="px-6 py-4 font-medium">Target URL</th>
            <th className="px-6 py-4 font-medium">Pages</th>
            <th className="px-6 py-4 font-medium">Status</th>
            <th className="px-6 py-4 font-medium">Issues</th>
            <th className="px-6 py-4 font-medium">Score</th>
            <th className="px-6 py-4 font-medium">Date</th>
            <th className="px-6 py-4 font-medium text-right">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {loading &&
            tests.length === 0 &&
            Array.from({ length: 4 }).map((_, i) => (
              <tr key={i}>
                <td className="px-6 py-4" colSpan={7}>
                  <Skeleton className="h-6 w-full" />
                </td>
              </tr>
            ))}

          <AnimatePresence initial={false}>
            {tests.map((test, i) => {
              const criticalCount = test.issues.filter(
                (iss) => (iss.severity === 'critical' || iss.severity === 'high') && !iss.resolved
              ).length;
              return (
                <motion.tr
                  key={test.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ delay: Math.min(i * 0.03, 0.25) }}
                  className="hover:bg-slate-50 dark:hover:bg-slate-800/40 dark:border-slate-800 transition-colors"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 shrink-0">
                        <i className="ph ph-globe"></i>
                      </div>
                      <span className="font-medium text-slate-900 dark:text-slate-100 truncate max-w-[220px]" title={test.url}>
                        {test.url}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-500 dark:text-slate-400">{test.pagesScanned || '-'}</td>
                  <td className="px-6 py-4">{statusBadge(test.status)}</td>
                  <td className="px-6 py-4">
                    {test.status === 'passed' || test.status === 'failed' ? (
                      <div className="flex items-center gap-1">
                        <span className={`font-medium ${criticalCount > 0 ? 'text-red-500 dark:text-red-400' : 'text-slate-400 dark:text-slate-500'}`}>
                          {criticalCount}
                        </span>
                        <span className="text-slate-400 dark:text-slate-500 text-xs">critical</span>
                      </div>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {test.score !== null ? (
                      <div
                        className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-bold text-slate-700 dark:text-slate-200 ${
                          test.score >= 90
                            ? 'border-emerald-400'
                            : test.score >= 70
                            ? 'border-blue-400'
                            : test.score >= 50
                            ? 'border-amber-400'
                            : 'border-red-400'
                        }`}
                      >
                        {test.score}
                      </div>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="px-6 py-4 text-slate-500 dark:text-slate-400">{timeAgo(test.createdAt)}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-3">
                      {(test.status === 'passed' || test.status === 'failed') && (
                        <button
                          onClick={() => openReport(test.id)}
                          className="text-blue-500 dark:text-blue-400 hover:text-blue-600 dark:hover:text-blue-300 font-medium text-sm transition-colors"
                        >
                          View Report
                        </button>
                      )}
                      {test.status === 'running' || test.status === 'queued' ? (
                        <button
                          onClick={() => openReport(test.id)}
                          className="text-blue-500 dark:text-blue-400 hover:text-blue-600 dark:hover:text-blue-300 font-medium text-sm transition-colors"
                        >
                          Watch live
                        </button>
                      ) : (
                        <button
                          onClick={() => onRerun(test.id)}
                          title="Re-run"
                          className="text-slate-400 dark:text-slate-500 hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
                        >
                          <i className="ph ph-arrow-clockwise text-lg"></i>
                        </button>
                      )}
                      <button
                        onClick={() => onDelete(test.id)}
                        title="Delete"
                        className="text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                      >
                        <i className="ph ph-trash text-lg"></i>
                      </button>
                    </div>
                  </td>
                </motion.tr>
              );
            })}
          </AnimatePresence>
        </tbody>
      </table>

      {!loading && tests.length === 0 && (
        <EmptyState icon={emptyTitle.icon} title={emptyTitle.text} description={emptyDescription.text} />
      )}

      <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
        <span className="text-sm text-slate-500 dark:text-slate-400">
          Showing <span className="font-medium text-slate-700 dark:text-slate-200">{tests.length === 0 ? 0 : (page - 1) * pageSize + 1}</span> to{' '}
          <span className="font-medium text-slate-700 dark:text-slate-200">{Math.min(page * pageSize, totalCount)}</span> of{' '}
          <span className="font-medium text-slate-700 dark:text-slate-200">{totalCount}</span> tests
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onPageChange(Math.max(1, page - 1))}
            disabled={page <= 1}
            className="px-3 py-1 border border-slate-200 dark:border-slate-700 rounded text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60 disabled:text-slate-300 dark:disabled:text-slate-600 disabled:cursor-not-allowed disabled:bg-slate-50 dark:disabled:bg-slate-900/50 transition-colors"
          >
            Previous
          </button>
          <button
            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
            disabled={page >= totalPages}
            className="px-3 py-1 border border-slate-200 dark:border-slate-700 rounded text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60 disabled:text-slate-300 dark:disabled:text-slate-600 disabled:cursor-not-allowed disabled:bg-slate-50 dark:disabled:bg-slate-900/50 transition-colors"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
};
