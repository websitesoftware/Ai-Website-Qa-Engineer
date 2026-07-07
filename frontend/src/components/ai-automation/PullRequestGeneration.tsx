import React from 'react';

interface PrProps {
  data: {
    branchName: string;
    prTitle: string;
    prUrl: string;
    status: string;
  } | null;
}

export const PullRequestGeneration: React.FC<PrProps> = ({ data }) => {
  if (!data) return <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm animate-pulse h-36"></div>;

  return (
    <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm mb-6">
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
          <span className="bg-purple-100 text-purple-800 text-xs px-2.5 py-0.5 rounded-full font-semibold dark:bg-purple-950/50 dark:text-purple-400">
            PR Status: {data.status}
          </span>
        </div>

        <div>
          <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 block">Automated Commit Header</span>
          <div className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{data.prTitle}</div>
        </div>

        <div className="pt-2">
          <a 
            href={data.prUrl} 
            target="_blank" 
            rel="noreferrer" 
            className="inline-flex items-center justify-center w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors duration-150 cursor-pointer"
          >
            🚀 View Generated PR on GitHub
          </a>
        </div>
      </div>
    </div>
  );
};