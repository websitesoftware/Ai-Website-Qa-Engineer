import React from 'react';
import { motion } from 'framer-motion';

interface MergeState {
  loading: boolean;
  merged: boolean;
  reason?: string;
  approvalCount?: number;
  changesRequestedCount?: number;
  error?: string;
}

interface RepoMatch {
  name?: string;
  path?: string;
  matchedBy?: string; // "hostname" | "live-port" | "url-path" | "port" | "unmatched" | "ambiguous_*"
}

interface PrProps {
  data: {
    branchName: string;
    prTitle: string;
    prUrl: string;
    status: string;
    repo?: string;
    repoMatch?: RepoMatch;
    filePath?: string | null;
    filesChanged?: string[];
    fixesApplied?: number;
  } | null;
  merge?: MergeState;
  onMerge?: () => void;
}

const MERGE_REASON_COPY: Record<string, string> = {
  awaiting_approval: 'Not merged: no approving review yet. Approve the PR on GitHub, then try again.',
  changes_requested: 'Not merged: a reviewer requested changes. Resolve them, then try again.',
};

export const PullRequestGeneration: React.FC<PrProps> = ({ data, merge, onMerge }) => {
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
        {data.repo && (
          <div>
            <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 block">Target Repo</span>
            <div className="flex items-center gap-2 flex-wrap">
              <code className="text-xs font-mono bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200 dark:bg-slate-900/50 dark:text-slate-300 dark:border-slate-700">
                {data.repo}
              </code>
              {data.repoMatch?.matchedBy && (
                <span className="text-[11px] text-slate-400 dark:text-slate-500">
                  matched by {data.repoMatch.matchedBy}
                </span>
              )}
            </div>
          </div>
        )}
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

        <div className="text-xs font-semibold rounded-lg px-3 py-2 border bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900">
          {data.filesChanged && data.filesChanged.length > 1 ? (
            <>
              ✅ Bundles {data.fixesApplied ?? data.filesChanged.length} fixes across {data.filesChanged.length} files
              directly — a real code change, not a report.
              <div className="mt-1 font-normal font-mono text-[11px] text-emerald-600 dark:text-emerald-400 space-y-0.5">
                {data.filesChanged.map((f) => (
                  <div key={f} className="truncate">• {f}</div>
                ))}
              </div>
            </>
          ) : (
            <>✅ Patches {data.filesChanged?.[0] || data.filePath || 'a real source file'} directly — a real code change, not a report.</>
          )}
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

        {onMerge && (
          <div className="pt-1">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-400">
                Approval Gate (app-level, no GitHub Pro required)
              </span>
              {typeof merge?.approvalCount === 'number' && (
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  {merge.approvalCount} approval{merge.approvalCount === 1 ? '' : 's'}
                  {merge.changesRequestedCount ? ` · ${merge.changesRequestedCount} changes requested` : ''}
                </span>
              )}
            </div>

            {merge?.merged ? (
              <div className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 rounded-lg px-3 py-2">
                ✅ Merged into main.
              </div>
            ) : (
              <>
                <button
                  onClick={onMerge}
                  disabled={merge?.loading}
                  className="inline-flex items-center justify-center w-full px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors cursor-pointer"
                >
                  {merge?.loading ? 'Checking approval…' : '✅ Check Approval & Merge'}
                </button>
                {merge?.reason && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                    {MERGE_REASON_COPY[merge.reason] || merge.reason}
                  </p>
                )}
                {merge?.error && (
                  <p className="text-xs text-red-600 dark:text-red-400 mt-2">Error: {merge.error}</p>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
};
