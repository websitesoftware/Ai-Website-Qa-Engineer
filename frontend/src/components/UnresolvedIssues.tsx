'use client';
import React from 'react';
import { motion } from 'framer-motion';
import { IssueItem } from '../app/types/dashboard';
import { useContent } from '../context/ContentContext';

const severityStyles = {
  high: { dot: 'bg-red-500', row: 'bg-red-50/70 dark:bg-red-950/20' },
  medium: { dot: 'bg-[#2E7BF6]', row: 'bg-blue-50/70 dark:bg-blue-950/20' },
  low: { dot: 'bg-[#5AA0FF]', row: 'bg-sky-50/70 dark:bg-sky-950/20' },
  info: { dot: 'bg-[#2FAE84]', row: 'bg-emerald-50/70 dark:bg-emerald-950/20' },
};

export const UnresolvedIssues: React.FC<{ issues?: IssueItem[] }> = ({ issues = [] }) => {
  const title = useContent('dashboard.unresolvedIssues.title', { text: 'Top Unresolved Issues' });
  const subtitle = useContent('dashboard.unresolvedIssues.subtitle', { text: 'Highest priority problem logs needing resolution' });
  const emptyText = useContent('dashboard.unresolvedIssues.emptyText', { text: 'No issues found! 🎉' });
  const footerButton = useContent('dashboard.unresolvedIssues.footerButton', { text: 'Analyze all open tickets', icon: 'ph-caret-right-bold' });

  return (
    <div className="bg-white/85 dark:bg-slate-800 backdrop-blur-md p-6 rounded-2xl border border-slate-200/70 dark:border-slate-700 shadow-lg shadow-slate-900/5 flex flex-col justify-between h-full">
      <div>
        <div className="border-b border-slate-100 dark:border-slate-800 pb-4 mb-3">
          <h3 className="font-display font-bold text-slate-900 dark:text-slate-100">{title.text}</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{subtitle.text}</p>
        </div>

        <div className="space-y-1.5">
          {issues.map((issue, i) => {
            const styles = severityStyles[issue.severity] || severityStyles.info;
            return (
              <motion.div
                key={issue.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className={`px-3 py-2.5 rounded-xl flex items-center justify-between text-sm ${styles.row}`}
              >
                <div className="flex items-center gap-3">
                  <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${styles.dot}`}></span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">{issue.label}</span>
                </div>
                <span className="text-[11px] font-mono font-bold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2.5 py-1 rounded-full shadow-sm">
                  {issue.count}
                </span>
              </motion.div>
            );
          })}
          {issues.length === 0 && (
            <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-6">{emptyText.text}</p>
          )}
        </div>
      </div>

      <div className="pt-4 border-t border-slate-100 dark:border-slate-800 text-center mt-4">
        <button className="text-xs font-semibold text-[#2E7BF6] dark:text-blue-400 hover:text-[#1C56C9] dark:hover:text-blue-300 transition-colors inline-flex items-center gap-1">
          {footerButton.text} <i className={`ph ${footerButton.icon}`}></i>
        </button>
      </div>
    </div>
  );
};
