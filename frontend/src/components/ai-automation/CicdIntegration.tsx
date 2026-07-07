import React from 'react';

interface CicdProps {
  status: 'Passed' | 'Failed' | 'Running' | 'Idle';
  logs: string[];
}

export const CicdIntegration: React.FC<CicdProps> = ({ status, logs }) => {
  const statusColors = {
    Passed: 'bg-emerald-500 text-white',
    Failed: 'bg-red-500 text-white',
    Running: 'bg-blue-500 text-white animate-pulse',
    Idle: 'bg-slate-400 text-white',
  };

  return (
    <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <span>🔄</span> CI/CD Integration Test
        </h3>
        <span className={`text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider ${statusColors[status]}`}>
          {status}
        </span>
      </div>

      <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 block mb-1.5">Validation Sandbox Build Logs</span>
      <div className="bg-slate-950 text-slate-400 p-4 rounded-lg font-mono text-xs h-32 overflow-y-auto border border-slate-800 shadow-inner custom-scrollbar space-y-1">
        {logs.map((log, index) => {
          let logColor = 'text-slate-400';
          if (log.includes('[SUCCESS]')) logColor = 'text-emerald-400 font-medium';
          if (log.includes('[INFO]')) logColor = 'text-sky-400';
          if (log.includes('[RUNNING]')) logColor = 'text-amber-400';
          
          return (
            <div key={index} className={`whitespace-pre-wrap leading-relaxed ${logColor}`}>
              {log}
            </div>
          );
        })}
      </div>
    </div>
  );
};