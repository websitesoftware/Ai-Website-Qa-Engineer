import React from 'react';
import { formatDate } from '../../lib/format';

interface ReleaseNotesProps {
  issueTitle: string;
  notes: string | null;
  affectedComponent: string | null;
  generatedAt: string | null;
  resolved: boolean;
}

export const ReleaseNotesCard: React.FC<ReleaseNotesProps> = ({ issueTitle, notes, affectedComponent, generatedAt, resolved }) => {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-6">
      <div className="flex items-center justify-between gap-2 mb-4">
        <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <span>📝</span> Release Notes
        </h3>
        <span
          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
            resolved
              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400'
              : 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400'
          }`}
        >
          {resolved ? 'Fixed' : 'Pending'}
        </span>
      </div>

      <p className="text-[11px] text-slate-400 dark:text-slate-500 mb-3">{generatedAt ? formatDate(generatedAt) : ''}</p>

      <div className="space-y-3 text-sm">
        <div>
          <span className="font-bold text-slate-800 dark:text-slate-200">Fixed: </span>
          <span className="text-slate-600 dark:text-slate-400">{issueTitle}</span>
        </div>
        {affectedComponent && (
          <div>
            <span className="font-bold text-slate-800 dark:text-slate-200">Affected Component: </span>
            <code className="text-xs font-mono text-slate-600 dark:text-slate-400">{affectedComponent}</code>
          </div>
        )}
        <div>
          <span className="font-bold text-slate-800 dark:text-slate-200">Impact: </span>
          <span className="text-slate-600 dark:text-slate-400">{notes || 'Not generated yet.'}</span>
        </div>
      </div>
    </div>
  );
};
