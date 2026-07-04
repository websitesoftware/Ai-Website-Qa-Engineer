'use client';
import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useTestDetail } from '../../hooks/useTestDetail';
import { ScoreGauge } from '../ui/ScoreGauge';
import { api } from '../../lib/api';
import { formatDate, timeAgo } from '../../lib/format';
import { useQAData } from '../../context/QADataContext';
import { useToast } from '../../context/ToastContext';

const severityStyles: Record<string, { dot: string; badge: string }> = {
  critical: { dot: 'bg-red-500', badge: 'bg-red-50 text-red-600 border-red-100' },
  high: { dot: 'bg-orange-500', badge: 'bg-orange-50 text-orange-600 border-orange-100' },
  medium: { dot: 'bg-amber-500', badge: 'bg-amber-50 text-amber-600 border-amber-100' },
  low: { dot: 'bg-slate-400', badge: 'bg-slate-100 text-slate-600 border-slate-200' },
};

const stageLabels: Record<string, string> = {
  crawling: 'Crawling site and discovering pages',
  links: 'Checking for broken links',
  responsive: 'Capturing responsive screenshots',
  console: 'Scanning for console errors',
  lighthouse: 'Running Lighthouse audit',
  aggregating: 'Compiling the report',
  done: 'Done',
};

export const ReportDetailModal: React.FC<{ testId: string | null; onClose: () => void }> = ({ testId, onClose }) => {
  const { test, loading, error, refetch } = useTestDetail(testId);
  const { rerunTest } = useQAData();
  const { showToast } = useToast();
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const toggleIssue = async (issueId: string, resolved: boolean) => {
    if (!test) return;
    setResolvingId(issueId);
    try {
      await api.updateIssue(test.id, issueId, resolved);
      await refetch();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not update issue', 'error');
    } finally {
      setResolvingId(null);
    }
  };

  const handleRerun = async () => {
    if (!test) return;
    try {
      await rerunTest(test.id);
      showToast('Test re-queued for scanning', 'success');
      refetch();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not re-run test', 'error');
    }
  };

  return (
    <AnimatePresence>
      {testId && (
        <motion.div
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[88vh] overflow-hidden flex flex-col"
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60 shrink-0">
              <div className="min-w-0">
                <h3 className="text-lg font-bold text-slate-900 truncate">{test?.name || 'Loading report...'}</h3>
                {test && <p className="text-xs text-slate-500 mt-0.5 truncate">{test.url}</p>}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {test && (test.status === 'passed' || test.status === 'failed' || test.status === 'error') && (
                  <button
                    onClick={handleRerun}
                    className="text-xs font-semibold text-indigo-600 hover:bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100 transition-colors flex items-center gap-1.5"
                  >
                    <i className="ph ph-arrow-clockwise"></i> Re-run
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="text-slate-400 hover:text-slate-600 transition-colors w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100"
                >
                  <i className="ph ph-x text-xl"></i>
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="overflow-y-auto flex-1 px-6 py-6 space-y-6">
              {loading && !test && (
                <div className="space-y-4 animate-fade-in">
                  <div className="skeleton h-32 rounded-xl" />
                  <div className="skeleton h-24 rounded-xl" />
                  <div className="skeleton h-40 rounded-xl" />
                </div>
              )}

              {error && !loading && !test && (
                <div className="text-center py-10 text-red-500 text-sm">
                  <i className="ph ph-warning-circle text-3xl block mb-2"></i>
                  {error}
                </div>
              )}

              {test && (test.status === 'queued' || test.status === 'running') && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="bg-indigo-50/60 border border-indigo-100 rounded-xl p-6 text-center"
                >
                  <i className="ph ph-spinner-gap animate-spin text-3xl text-indigo-500 block mb-3"></i>
                  <p className="font-semibold text-indigo-700">{stageLabels[test.currentStage || ''] || 'Starting scan...'}</p>
                  <div className="w-full max-w-sm mx-auto bg-white rounded-full h-2 mt-4 overflow-hidden border border-indigo-100">
                    <motion.div
                      className="h-full bg-indigo-500 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${test.progress}%` }}
                      transition={{ ease: 'easeOut', duration: 0.6 }}
                    />
                  </div>
                  <p className="text-xs text-indigo-400 mt-2">{test.progress}% complete — updates live</p>
                </motion.div>
              )}

              {test && test.score !== null && (
                <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-6 items-center bg-white border border-slate-200 rounded-xl p-6">
                  <ScoreGauge score={test.score} size={110} label="Overall" />
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 w-full">
                    {(['performance', 'accessibility', 'seo', 'bestPractices'] as const).map((key) => (
                      <div key={key} className="text-center">
                        <ScoreGauge score={test.scores[key]} size={64} strokeWidth={6} />
                        <p className="text-[11px] font-medium text-slate-500 mt-1 capitalize">
                          {key === 'bestPractices' ? 'Best Practices' : key}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {test && test.screenshots?.length > 0 && (
                <div>
                  <h4 className="font-bold text-slate-900 mb-3 flex items-center gap-2">
                    <i className="ph ph-devices text-indigo-500"></i> Responsive Screenshots
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {test.screenshots.map((s) => (
                      <div key={s.viewport} className="border border-slate-200 rounded-lg overflow-hidden bg-slate-50">
                        <div className="px-3 py-2 text-xs font-semibold text-slate-600 border-b border-slate-200 bg-white capitalize flex items-center justify-between">
                          {s.viewport}
                          {s.width && (
                            <span className="text-slate-400 font-normal">
                              {s.width}×{s.height}
                            </span>
                          )}
                        </div>
                        {s.path ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={api.screenshotUrl(s.path)}
                            alt={`${s.viewport} screenshot`}
                            className="w-full h-40 object-cover object-top"
                          />
                        ) : (
                          <div className="h-40 flex items-center justify-center text-xs text-red-400">Capture failed</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {test && test.issues?.length > 0 && (
                <div>
                  <h4 className="font-bold text-slate-900 mb-3 flex items-center gap-2">
                    <i className="ph ph-bug text-red-500"></i> Issues ({test.issues.filter((i) => !i.resolved).length} open)
                  </h4>
                  <div className="space-y-2">
                    {test.issues.map((issue, i) => {
                      const styles = severityStyles[issue.severity] || severityStyles.low;
                      return (
                        <motion.div
                          key={issue.id}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: Math.min(i * 0.03, 0.3) }}
                          className={`border rounded-lg p-3 flex items-start gap-3 ${
                            issue.resolved ? 'bg-slate-50 border-slate-100 opacity-60' : 'bg-white border-slate-200'
                          }`}
                        >
                          <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${styles.dot}`}></span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border ${styles.badge}`}>
                                {issue.severity}
                              </span>
                              <span className="text-xs text-slate-400">{issue.category}</span>
                            </div>
                            <p className={`text-sm font-medium text-slate-800 mt-1 ${issue.resolved ? 'line-through' : ''}`}>
                              {issue.title}
                            </p>
                            {issue.suggestion && <p className="text-xs text-slate-500 mt-1">{issue.suggestion}</p>}
                          </div>
                          <button
                            onClick={() => toggleIssue(issue.id, !issue.resolved)}
                            disabled={resolvingId === issue.id}
                            className={`text-xs font-semibold px-2.5 py-1 rounded-lg shrink-0 transition-colors ${
                              issue.resolved ? 'text-slate-500 hover:bg-slate-100' : 'text-emerald-600 hover:bg-emerald-50'
                            }`}
                          >
                            {resolvingId === issue.id ? (
                              <i className="ph ph-spinner-gap animate-spin"></i>
                            ) : issue.resolved ? (
                              'Reopen'
                            ) : (
                              'Resolve'
                            )}
                          </button>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              )}

              {test && (test.status === 'passed' || test.status === 'failed') && test.issues?.length === 0 && (
                <div className="text-center py-8 text-emerald-600">
                  <i className="ph ph-check-circle text-3xl block mb-2"></i>
                  No issues found — clean scan!
                </div>
              )}

              {test && test.status === 'error' && (
                <div className="text-center py-8 text-red-500 text-sm">
                  <i className="ph ph-x-circle text-3xl block mb-2"></i>
                  Scan failed: {test.error}
                </div>
              )}

              {test && (
                <p className="text-xs text-slate-400 text-center pt-2 border-t border-slate-100">
                  Scanned {test.pagesScanned} page{test.pagesScanned === 1 ? '' : 's'} · Started {timeAgo(test.startedAt)} ·{' '}
                  {test.completedAt ? `Completed ${formatDate(test.completedAt)}` : 'In progress'}
                </p>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
