
import React from 'react';
import { motion } from 'framer-motion';
import { Folder } from '@phosphor-icons/react';

interface RcaProps {
  data: {
    culpritFile: string;
    errorLine: number;
    explanation: string;
    confidence: number;
  } | null;
  /** vscode://file/... link for the real repo file this issue was located in, or null while still locating / if nothing was found. */
  editorUrl?: string | null;
  editorLabel?: string | null;
  /** True while the locate call is still in flight (distinct from "checked, found nothing"). */
  locating?: boolean;
}

export const RootCauseAnalysis: React.FC<RcaProps> = ({ data, editorUrl, editorLabel, locating }) => {
  if (!data) {
    return (
      <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm animate-pulse h-40 mb-6"></div>
    );
  }

  // errorLine is 0 when the browser only gave us a page/selector (not a line).
  const locationLabel =
    data.errorLine && data.errorLine > 0
      ? `${data.culpritFile}:${data.errorLine}`
      : data.culpritFile;

  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ duration: 0.2 }}
      className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md mb-6"
    >
      <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 mb-4">
        <span>🔍</span> AI Root Cause Analysis (RCA)
      </h3>

      <div className="flex flex-wrap items-center gap-6 mb-4">
        <div className="flex-1 min-w-[200px]">
          <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 block mb-1">
            Observed Location (browser-reported)
          </span>
          <code className="text-xs font-mono bg-amber-50 text-amber-700 px-2 py-1 rounded border border-amber-100 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900/50 block truncate">
            {locationLabel}
          </code>
          <button
            onClick={() => {
              if (editorUrl) window.location.href = editorUrl;
            }}
            disabled={!editorUrl}
            title={editorUrl ? `Open ${editorLabel} in VS Code` : 'No local source file matched for this issue yet'}
            className={`mt-2 inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-lg border transition-colors ${
              editorUrl
                ? 'text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 border-blue-200 dark:border-blue-900/50 bg-blue-50 dark:bg-blue-950/30 cursor-pointer'
                : 'text-slate-400 dark:text-slate-600 border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/30 cursor-not-allowed'
            }`}
          >
            <Folder className="w-3.5 h-3.5" />
            {editorUrl ? 'Go to File' : locating ? 'Locating file…' : 'No matching file found'}
          </button>
        </div>
        <div>
          <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 block mb-1">AI Confidence</span>
          <div className="flex items-center gap-2">
            <div className="w-16 bg-slate-100 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
              <motion.div
                className="bg-blue-600 h-full"
                initial={{ width: 0 }}
                animate={{ width: `${data.confidence * 100}%` }}
                transition={{ duration: 0.7, ease: 'easeOut', delay: 0.1 }}
              />
            </div>
            <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{(data.confidence * 100).toFixed(0)}%</span>
          </div>
        </div>
      </div>

      <div>
        <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 block mb-1">Failure Breakdown</span>
        <p className="text-sm text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/40 p-3 rounded-lg border border-slate-100 dark:border-slate-800 leading-relaxed">
          {data.explanation}
        </p>
      </div>
    </motion.div>
  );
};
