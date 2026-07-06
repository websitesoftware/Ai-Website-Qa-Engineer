'use client';
import React from 'react';
import { api } from '../../lib/api';
import { BackendTest } from '../../lib/types';

const impactStyles: Record<string, string> = {
  critical: 'bg-red-50 text-red-600 border-red-100',
  serious: 'bg-orange-50 text-orange-600 border-orange-100',
  moderate: 'bg-amber-50 text-amber-600 border-amber-100',
  minor: 'bg-slate-100 text-slate-600 border-slate-200',
};

function fmtMs(v: number | null | undefined) {
  if (v === null || v === undefined) return '—';
  return v < 1000 ? `${Math.round(v)}ms` : `${(v / 1000).toFixed(2)}s`;
}

export const Phase2ResultsPanel: React.FC<{ test: BackendTest }> = ({ test }) => {
  const hasAccessibility = (test.accessibility?.violations?.length ?? 0) > 0 || test.accessibility?.passes;
  const hasSEO = (test.seo?.checks?.length ?? 0) > 0;
  const hasVisual = (test.visualRegression?.length ?? 0) > 0;
  const hasCrossBrowser = (test.crossBrowser?.length ?? 0) > 0;
  const hasPerf = !!test.performanceBenchmark;

  if (!hasAccessibility && !hasSEO && !hasVisual && !hasCrossBrowser && !hasPerf) return null;

  return (
    <div className="space-y-6">
      <h4 className="font-bold text-slate-900 flex items-center gap-2">
        <i className="ph ph-sparkle text-indigo-500"></i> Phase 2: Intelligent QA
      </h4>

      {/* Accessibility */}
      {hasAccessibility && (
        <div className="border border-slate-200 rounded-xl p-4">
          <p className="text-sm font-semibold text-slate-800 mb-2">
            Accessibility — {test.accessibility!.violations.length} violation
            {test.accessibility!.violations.length === 1 ? '' : 's'} · {test.accessibility!.passes} passed checks
          </p>
          <div className="space-y-2">
            {test.accessibility!.violations.slice(0, 8).map((v) => (
              <div key={v.id} className="flex items-start gap-2 text-sm">
                <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border shrink-0 ${impactStyles[v.impact || ''] || impactStyles.minor}`}>
                  {v.impact || 'n/a'}
                </span>
                <span className="text-slate-700">{v.help} <span className="text-slate-400">({v.nodes} elements)</span></span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SEO */}
      {hasSEO && (
        <div className="border border-slate-200 rounded-xl p-4">
          <p className="text-sm font-semibold text-slate-800 mb-2">
            SEO Audit — score {test.seo!.score ?? '—'}/100
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {test.seo!.checks.map((c) => (
              <div key={c.id} className="flex items-start gap-2 text-xs">
                <i className={`ph ${c.passed ? 'ph-check-circle text-emerald-500' : 'ph-x-circle text-red-500'} mt-0.5`}></i>
                <span className="text-slate-600">{c.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Visual regression */}
      {hasVisual && (
        <div className="border border-slate-200 rounded-xl p-4">
          <p className="text-sm font-semibold text-slate-800 mb-3">Visual Regression</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {test.visualRegression!.map((r) => (
              <div key={r.viewport} className="border border-slate-200 rounded-lg p-3 bg-slate-50">
                <p className="text-xs font-semibold capitalize text-slate-700">{r.viewport}</p>
                {r.isNewBaseline ? (
                  <p className="text-xs text-indigo-500 mt-1">New baseline saved</p>
                ) : (
                  <p className={`text-xs mt-1 ${r.significant ? 'text-red-500 font-semibold' : 'text-slate-500'}`}>
                    {r.diffPercentage}% diff {r.significant ? '⚠️ significant' : ''}
                  </p>
                )}
                {r.diffImagePath && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={api.screenshotUrl(r.diffImagePath)} alt={`${r.viewport} diff`} className="w-full h-24 object-cover rounded mt-2" />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cross-browser */}
      {hasCrossBrowser && (
        <div className="border border-slate-200 rounded-xl p-4">
          <p className="text-sm font-semibold text-slate-800 mb-3">Cross-Browser Testing</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {test.crossBrowser!.map((r) => (
              <div key={r.browser} className="border border-slate-200 rounded-lg p-3 text-center">
                <p className="text-xs font-semibold capitalize text-slate-700">{r.browser}</p>
                <p className={`text-xs mt-1 ${r.ok ? 'text-emerald-600' : 'text-red-500'}`}>
                  {r.ok ? `OK · ${fmtMs(r.loadTimeMs)}` : r.error || `Failed (${r.statusCode})`}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Performance benchmark */}
      {hasPerf && test.performanceBenchmark && (
        <div className="border border-slate-200 rounded-xl p-4">
          <p className="text-sm font-semibold text-slate-800 mb-3">
            Performance Benchmark {test.performanceBenchmark.comparedAgainstTestId ? '(vs. previous run)' : '(first run — no baseline yet)'}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
            {(Object.keys(test.performanceBenchmark.metrics) as Array<keyof typeof test.performanceBenchmark.metrics>).map((key) => {
              const delta = test.performanceBenchmark!.delta[key];
              return (
                <div key={key} className="border border-slate-100 rounded-lg p-2">
                  <p className="text-slate-500 capitalize">{key.replace(/([A-Z])/g, ' $1')}</p>
                  <p className="font-semibold text-slate-800">{fmtMs(test.performanceBenchmark!.metrics[key])}</p>
                  {typeof delta === 'number' && (
                    <p className={delta > 0 ? 'text-red-500' : 'text-emerald-600'}>
                      {delta > 0 ? '▲' : '▼'} {fmtMs(Math.abs(delta))}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};