import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface FixesProps {
  codeBefore: string;
  codeAfter: string;
  filePath?: string | null;
  grounded?: boolean;
  autoFixable?: boolean;
}

const CodeBlock: React.FC<{ code: string; variant: 'before' | 'after' }> = ({ code, variant }) => {
  const lines = code ? code.split('\n') : [];
  const isBefore = variant === 'before';

  return (
    <pre
      className={`p-4 rounded-lg border-l-4 overflow-x-auto font-mono text-xs shadow-inner h-48 ${isBefore
          ? 'bg-slate-50 dark:bg-slate-900/60 border-red-500 text-slate-700 dark:text-slate-300'
          : 'bg-slate-900 dark:bg-black border-emerald-500 text-emerald-400 dark:text-emerald-500'
        }`}
    >
      <code>
        {lines.map((line, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: isBefore ? -8 : 8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.25, delay: i * 0.04 }}
          >
            {line || '\u00A0'}
          </motion.div>
        ))}
      </code>
    </pre>
  );
};

export const SuggestedFixes: React.FC<FixesProps> = ({ codeBefore, codeAfter, filePath, grounded, autoFixable }) => {
  const ready = Boolean(codeBefore && codeAfter);

  return (
    <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm mb-6">
      <div className="flex items-center justify-between gap-2 flex-wrap mb-4">
        <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <span>🛠️</span> Suggested Code Fixes
        </h3>
        {ready && (
          <span
            className={`text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded border ${autoFixable
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900'
                : grounded
                  ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-900'
                  : 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
              }`}
          >
            {autoFixable
              ? `Patches ${filePath || 'a real file'} directly`
              : grounded
                ? `Located in ${filePath || 'your repo'} — review before applying`
                : 'Guidance only — no matching source line found'}
          </span>
        )}
      </div>

      <AnimatePresence mode="wait">
        {ready ? (
          <motion.div
            key="ready"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="grid grid-cols-1 xl:grid-cols-2 gap-4"
          >
            <div>
              <span className="text-[11px] uppercase tracking-wider font-semibold text-red-500 block mb-1.5 font-sans">Original Buggy Code</span>
              <CodeBlock code={codeBefore} variant="before" />
            </div>

            <div>
              <span className="text-[11px] uppercase tracking-wider font-semibold text-emerald-500 block mb-1.5 font-sans">AI Recommended Patch</span>
              <CodeBlock code={codeAfter} variant="after" />
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="pending"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid grid-cols-1 xl:grid-cols-2 gap-4"
          >
            <div className="h-48 rounded-lg bg-slate-50 dark:bg-slate-900/60 border-l-4 border-slate-200 dark:border-slate-700 animate-pulse" />
            <div className="h-48 rounded-lg bg-slate-50 dark:bg-slate-900/60 border-l-4 border-slate-200 dark:border-slate-700 animate-pulse" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
