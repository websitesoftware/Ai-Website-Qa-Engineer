import React from 'react';

interface FixesProps {
  codeBefore: string;
  codeAfter: string;
}

export const SuggestedFixes: React.FC<FixesProps> = ({ codeBefore, codeAfter }) => {
  return (
    <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm mb-6">
      <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 mb-4">
        <span>🛠️</span> Suggested Code Fixes
      </h3>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div>
          <span className="text-[11px] uppercase tracking-wider font-semibold text-red-500 block mb-1.5 font-sans">Original Buggy Code</span>
          <pre className="p-4 bg-slate-50 dark:bg-slate-900/60 rounded-lg border-l-4 border-red-500 overflow-x-auto font-mono text-xs text-slate-700 dark:text-slate-300 shadow-inner h-48">
            <code>{codeBefore}</code>
          </pre>
        </div>

        <div>
          <span className="text-[11px] uppercase tracking-wider font-semibold text-emerald-500 block mb-1.5 font-sans">AI Recommended Patch</span>
          <pre className="p-4 bg-slate-900 dark:bg-black rounded-lg border-l-4 border-emerald-500 overflow-x-auto font-mono text-xs text-emerald-400 dark:text-emerald-500 shadow-inner h-48">
            <code>{codeAfter}</code>
          </pre>
        </div>
      </div>
    </div>
  );
};