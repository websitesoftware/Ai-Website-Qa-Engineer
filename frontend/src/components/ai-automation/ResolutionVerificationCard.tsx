'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { API_BASE_URL } from '../../lib/api';

interface VerifyResult {
  supported: boolean;
  reason?: string;
  status?: 'resolved' | 'partial' | 'still_failing';
  evidence?: string;
  checkedAt?: string;
  error?: string;
}

interface Props {
  testId: string;
  issueId: string;
  issueTitle: string;
}

const UNSUPPORTED_COPY: Record<string, string> = {
  category_not_supported:
    'This issue type (visual regression, cross-browser, or performance benchmark) needs a full re-scan to verify — re-run the test from Test Management instead.',
  check_failed: 'The re-check itself failed to run — see the error below.',
};

export const ResolutionVerificationCard: React.FC<Props> = ({ testId, issueId, issueTitle }) => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VerifyResult | null>(null);

  const run = async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(`${API_BASE_URL}/ai-automation/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testId, issueId }),
      });
      const json: VerifyResult = await res.json();
      setResult(json);
    } catch (e) {
      setResult({ supported: false, reason: 'check_failed', error: e instanceof Error ? e.message : 'Request failed' });
    } finally {
      setLoading(false);
    }
  };

  const statusMeta = {
    resolved: { label: 'Resolved', icon: '✅', style: 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-400' },
    partial: { label: 'Partially Resolved', icon: '⚠️', style: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900 text-amber-700 dark:text-amber-400' },
    still_failing: { label: 'Still Failing', icon: '❌', style: 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900 text-red-700 dark:text-red-400' },
  } as const;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-6">
      <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 mb-4">
        <span>🛡️</span> AI Resolution Verification
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-5 items-start">
        <div className="flex flex-col items-center gap-2 w-full sm:w-40 shrink-0">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-violet-100 to-indigo-100 dark:from-violet-950/50 dark:to-indigo-950/50 border border-violet-200 dark:border-violet-900 flex items-center justify-center text-2xl">
            🤖
          </div>
          <button
            onClick={run}
            disabled={loading}
            className="w-full text-xs font-bold px-3 py-2.5 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 hover:brightness-105 disabled:opacity-50 text-white shadow-sm transition cursor-pointer"
          >
            {loading ? 'Re-scanning…' : '🔄 Re-scan & Verify'}
          </button>
          {loading && (
            <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-violet-500 to-indigo-500"
                initial={{ width: '10%' }}
                animate={{ width: '90%' }}
                transition={{ duration: 3, ease: 'easeOut' }}
              />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <AnimatePresence mode="wait">
            {!result && !loading && (
              <motion.p key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm text-slate-400 dark:text-slate-500">
                Not verified yet — click &ldquo;Re-scan &amp; Verify&rdquo; to re-run the real check that found this issue and confirm it&apos;s actually fixed.
              </motion.p>
            )}
            {loading && (
              <motion.p key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm text-slate-500 dark:text-slate-400">
                Scanning <span className="font-mono">{issueTitle}</span> for fixes…
              </motion.p>
            )}
            {result && !loading && (
              <motion.div key="result" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
                {result.supported && result.status ? (
                  <div className={`rounded-lg border p-4 ${statusMeta[result.status].style}`}>
                    <div className="flex items-center gap-2 font-bold text-sm mb-1.5">
                      <span>{statusMeta[result.status].icon}</span>
                      Issue &quot;{issueTitle}&quot; is <span>{statusMeta[result.status].label}</span>
                    </div>
                    <p className="text-sm opacity-90">{result.evidence}</p>
                  </div>
                ) : (
                  <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 p-4 text-sm text-slate-500 dark:text-slate-400">
                    {UNSUPPORTED_COPY[result.reason || ''] || 'Verification is not available for this issue.'}
                    {result.error && <p className="mt-1 text-xs text-red-500 dark:text-red-400">Error: {result.error}</p>}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};
