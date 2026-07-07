import React from 'react';
import { motion } from 'framer-motion';

interface PrProps {
  data: {
    branchName: string;
    prTitle: string;
    prUrl: string;
    status: string;
  } | null;
}

export const PullRequestGeneration: React.FC<PrProps> = ({ data }) => {
  if (!data) {
    return (
      <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm animate-pulse h-36 mb-6"></div>
    );
  }

  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ duration: 0.2 }}
      className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md mb-6"
    >
      <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 mb-4">
        <span>🌿</span> Pull Request Generation
      </h3>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 block">Target Branch</span>
            <code className="text-xs font-mono bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-100 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-900/50">
              {data.branchName}
            </code>
          </div>
          <motion.span
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.25 }}
            className="bg-purple-100 text-purple-800 text-xs px-2.5 py-0.5 rounded-full font-semibold dark:bg-purple-950/50 dark:text-purple-400"
          >
            PR Status: {data.status}
          </motion.span>
        </div>

        <div>
          <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 block">Automated Commit Header</span>
          <div className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{data.prTitle}</div>
        </div>

        <div className="pt-2">
          <motion.a
            href={data.prUrl}
            target="_blank"
            rel="noreferrer"
            whileHover={{ scale: 1.015 }}
            whileTap={{ scale: 0.98 }}
            className="inline-flex items-center justify-center w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors duration-150 cursor-pointer"
          >
            🚀 View Generated PR on GitHub
          </motion.a>
        </div>
      </div>
    </motion.div>
  );
};
