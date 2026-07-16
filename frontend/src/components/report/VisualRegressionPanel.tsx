'use client';
// frontend/src/components/report/VisualRegressionPanel.tsx
//
// Rendered from Phase2ResultsPanel when the test ran the `visual-regression`
// module. Consumes BackendVisualRegressionResult[] (backend/src/services/
// visualRegression.service.js) plus the run's screenshots so it can show the
// current capture next to the stored baseline.

import React, { useState } from 'react';
import { CheckCircle, Warning, XCircle, Plus } from '@phosphor-icons/react';
import { api } from '../../lib/api';
import { BackendScreenshot, BackendVisualRegressionResult } from '../../lib/types';

type Verdict = 'perfect' | 'good' | 'bad' | 'new-baseline';

const VERDICT: Record<Verdict, { label: string; cls: string; Icon: React.ElementType }> = {
  perfect: { label: 'Perfect', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900', Icon: CheckCircle },
  good: { label: 'Good', cls: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900', Icon: Warning },
  bad: { label: 'Bad', cls: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-900', Icon: XCircle },
  'new-baseline': { label: 'New baseline', cls: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700', Icon: Plus },
};

function verdictOf(r: BackendVisualRegressionResult): Verdict {
  if (r.isNewBaseline) return 'new-baseline';
  if (r.significant) return 'bad';
  if (!r.diffPercentage) return 'perfect';
  return 'good';
}

type Mode = 'side-by-side' | 'diff';

const ShotCard: React.FC<{ result: BackendVisualRegressionResult; currentPath?: string }> = ({ result, currentPath }) => {
  const [mode, setMode] = useState<Mode>('side-by-side');
  const verdict = verdictOf(result);
  const v = VERDICT[verdict];
  const isNew = verdict === 'new-baseline';

  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden bg-white dark:bg-slate-800">
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/50">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider px-2 py-1 rounded border ${v.cls}`}>
            <v.Icon className="w-3.5 h-3.5" weight="fill" /> {v.label}
          </span>
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 capitalize">{result.viewport}</span>
          {typeof result.diffPercentage === 'number' && !isNew && (
            <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
              {result.diffPercentage}% changed
              {typeof result.diffPixels === 'number' ? ` (${result.diffPixels.toLocaleString()} px)` : ''}
            </span>
          )}
          {result.error && (
            <span className="text-[11px] font-bold text-red-600 bg-red-50 border border-red-100 dark:bg-red-950/40 dark:text-red-400 dark:border-red-900 px-1.5 py-0.5 rounded">
              {result.error}
            </span>
          )}
        </div>
      </div>

      {isNew ? (
        <div className="p-4 space-y-3">
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            No baseline existed for this URL + viewport, so nothing was compared. This capture is now
            the baseline — future scans will be diffed against it.
          </p>
          {currentPath && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={api.screenshotUrl(currentPath)} alt="Current capture" className="w-full border border-slate-200 dark:border-slate-700 rounded-lg" />
          )}
        </div>
      ) : (
        <>
          <div className="flex gap-1 p-2 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800">
            {(['side-by-side', 'diff'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                disabled={m === 'diff' && !result.diffImagePath}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-md capitalize transition-all disabled:opacity-40 ${
                  mode === m ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                {m.replace('-', ' ')}
              </button>
            ))}
          </div>

          <div className="p-4">
            {mode === 'side-by-side' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {result.baselinePath && (
                  <figure>
                    <figcaption className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5">Baseline</figcaption>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={api.screenshotUrl(result.baselinePath)} alt="Baseline" className="w-full border border-slate-200 dark:border-slate-700 rounded-lg" />
                  </figure>
                )}
                {currentPath && (
                  <figure>
                    <figcaption className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5">Current</figcaption>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={api.screenshotUrl(currentPath)} alt="Current" className="w-full border border-slate-200 dark:border-slate-700 rounded-lg" />
                  </figure>
                )}
              </div>
            )}

            {mode === 'diff' && result.diffImagePath && (
              <figure>
                <figcaption className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5">
                  Changed pixels highlighted
                </figcaption>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={api.screenshotUrl(result.diffImagePath)} alt="Diff" className="w-full border border-slate-200 dark:border-slate-700 rounded-lg" />
              </figure>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export const VisualRegressionPanel: React.FC<{
  results: BackendVisualRegressionResult[] | undefined;
  screenshots?: BackendScreenshot[];
}> = ({ results, screenshots }) => {
  if (!results?.length) return null;

  const currentPathFor = (viewport: string) =>
    screenshots?.find((s) => s.viewport === viewport)?.path;

  const worst: Verdict = results.some((r) => verdictOf(r) === 'bad')
    ? 'bad'
    : results.some((r) => verdictOf(r) === 'good')
      ? 'good'
      : results.some((r) => verdictOf(r) === 'new-baseline')
        ? 'new-baseline'
        : 'perfect';

  const W = VERDICT[worst];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className={`inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider px-2 py-1 rounded border ${W.cls}`}>
          <W.Icon className="w-3.5 h-3.5" weight="fill" /> {W.label}
        </span>
        <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">
          worst of {results.length} viewport{results.length === 1 ? '' : 's'}
        </span>
      </div>

      <div className="space-y-3">
        {results.map((r) => (
          <ShotCard key={r.viewport} result={r} currentPath={currentPathFor(r.viewport)} />
        ))}
      </div>
    </div>
  );
};
