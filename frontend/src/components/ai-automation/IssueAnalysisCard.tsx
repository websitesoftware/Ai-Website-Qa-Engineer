import React from 'react';

interface IssueAnalysisProps {
  issueType: string;
  category: string;
  severity: string;
  rootCause: string | null;
  suggestedFix: string | null;
}

const TYPE_BADGE: Record<string, string> = {
  UI: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-400 dark:border-violet-900',
  API: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-400 dark:border-sky-900',
  Accessibility: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-400 dark:border-indigo-900',
  CSS: 'bg-pink-50 text-pink-700 border-pink-200 dark:bg-pink-950/40 dark:text-pink-400 dark:border-pink-900',
  Functional: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-900',
  SEO: 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/40 dark:text-teal-400 dark:border-teal-900',
  Performance: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900',
  Security: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-900',
};

const SEVERITY_BADGE: Record<string, string> = {
  Critical: 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400',
  High: 'bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-400',
  Medium: 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400',
  Low: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
};

export const IssueAnalysisCard: React.FC<IssueAnalysisProps> = ({ issueType, category, severity, rootCause, suggestedFix }) => {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-6">
      <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 mb-4">
        <span>🔍</span> Issue Analysis
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
        <div className="space-y-3">
          <div>
            <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 block mb-1">Issue Type</span>
            <span className={`inline-block text-xs font-bold px-2.5 py-1 rounded-full border ${TYPE_BADGE[issueType] || TYPE_BADGE.Functional}`}>
              {issueType}
            </span>
          </div>
          <div>
            <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 block mb-1">Category</span>
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300 capitalize">{category.replace(/-/g, ' ')}</span>
          </div>
          <div>
            <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 block mb-1">Severity</span>
            <span className={`inline-block text-xs font-bold px-2.5 py-1 rounded-full ${SEVERITY_BADGE[severity] || SEVERITY_BADGE.Low}`}>
              {severity}
            </span>
          </div>
        </div>

        <div>
          <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 block mb-1">Root Cause</span>
          <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
            {rootCause || 'Not enough data captured to determine a root cause for this issue.'}
          </p>
        </div>
      </div>

      <div className="mt-5 flex items-start gap-2.5 text-sm bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900 rounded-lg p-3.5">
        <span className="shrink-0">💡</span>
        <div>
          <span className="font-bold text-blue-700 dark:text-blue-400 block mb-0.5">Suggested Fix</span>
          <span className="text-blue-700/90 dark:text-blue-300/90">
            {suggestedFix || 'No automated suggestion available for this issue type — review it manually.'}
          </span>
        </div>
      </div>
    </div>
  );
};
