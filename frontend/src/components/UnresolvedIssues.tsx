'use client';
import React from 'react';
import { motion } from 'framer-motion';
import { IssueItem } from '../app/types/dashboard';
import { useContent } from '../context/ContentContext';

const severityColorMap = {
  high: 'bg-red-500',
  medium: 'bg-amber-500',
  low: 'bg-indigo-500',
  info: 'bg-slate-400',
};

export const UnresolvedIssues: React.FC<{ issues?: IssueItem[] }> = ({ issues = [] }) => {
  const title = useContent('dashboard.unresolvedIssues.title', { text: 'Top Unresolved Issues' });
  const subtitle = useContent('dashboard.unresolvedIssues.subtitle', { text: 'Highest priority problem logs needing resolution' });
  const emptyText = useContent('dashboard.unresolvedIssues.emptyText', { text: 'No issues found! 🎉' });
  const footerButton = useContent('dashboard.unresolvedIssues.footerButton', { text: 'Analyze all open tickets', icon: 'ph-caret-right-bold' });

  return (
    <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-between h-full">
      <div>
        <div className="border-b border-slate-100 dark:border-slate-800 pb-4 mb-3">
          <h3 className="font-bold text-slate-900 dark:text-slate-100">{title.text}</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{subtitle.text}</p>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {issues.map((issue, i) => (
            <motion.div
              key={issue.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="py-3 flex items-center justify-between text-sm"
            >
              <div className="flex items-center gap-3">
                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${severityColorMap[issue.severity] || 'bg-slate-400'}`}></span>
                <span className="font-medium text-slate-700 dark:text-slate-300">{issue.label}</span>
              </div>
              <span className="text-xs font-bold bg-slate-100 border border-slate-200 text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400 px-2 py-0.5 rounded-full">
                {issue.count}
              </span>
            </motion.div>
          ))}
          {issues.length === 0 && (
            <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-6">{emptyText.text}</p>
          )}
        </div>
      </div>

      <div className="pt-4 border-t border-slate-100 dark:border-slate-800 text-center mt-4">
        <button className="text-xs font-semibold text-[#6366F1] dark:text-indigo-400 hover:text-[#4F46E5] dark:hover:text-indigo-300 transition-colors inline-flex items-center gap-1">
          {footerButton.text} <i className={`ph ${footerButton.icon}`}></i>
        </button>
      </div>
    </div>
  );
};
