import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface CicdProps {
  status?: 'Passed' | 'Failed' | 'Running' | 'Idle';
  logs: string[];
}

const statusColors: Record<string, string> = {
  Passed: 'bg-emerald-500 text-white',
  Failed: 'bg-red-500 text-white',
  Running: 'bg-blue-500 text-white',
  Idle: 'bg-slate-400 text-white',
};

export const CicdIntegration: React.FC<CicdProps> = ({ status = 'Idle', logs }) => {
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [logs.length]);

  return (
    <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <span>🔄</span> CI/CD Integration Test
        </h3>
        <motion.span
          animate={status === 'Running' ? { opacity: [1, 0.55, 1] } : { opacity: 1 }}
          transition={status === 'Running' ? { repeat: Infinity, duration: 1.1 } : {}}
          className={`text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider ${statusColors[status]}`}
        >
          {status}
        </motion.span>
      </div>

      <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 block mb-1.5">Validation Sandbox Build Logs</span>
      <div className="bg-slate-950 text-slate-400 p-4 rounded-lg font-mono text-xs h-32 overflow-y-auto border border-slate-800 shadow-inner custom-scrollbar space-y-1">
        {logs.length === 0 && (
          <div className="text-slate-600 italic">Waiting for pipeline logs...</div>
        )}
        <AnimatePresence initial={false}>
          {logs.map((log, index) => {
            let logColor = 'text-slate-400';
            if (log.includes('[SUCCESS]')) logColor = 'text-emerald-400 font-medium';
            if (log.includes('[INFO]')) logColor = 'text-sky-400';
            if (log.includes('[RUNNING]')) logColor = 'text-amber-400';

            return (
              <motion.div
                key={`${index}-${log}`}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
                className={`whitespace-pre-wrap leading-relaxed ${logColor}`}
              >
                {log}
              </motion.div>
            );
          })}
        </AnimatePresence>
        <div ref={logEndRef} />
      </div>
    </div>
  );
};
