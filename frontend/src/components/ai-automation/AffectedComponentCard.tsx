'use client';

import React, { useEffect, useState } from 'react';
import { API_BASE_URL, api } from '../../lib/api';

interface AffectedComponentProps {
  testId: string;
  issueId: string;
  selector: string | null;
  pageUrl: string | null;
}

interface AnnotatedResult {
  available: boolean;
  path?: string;
  reason?: string;
  annotated?: boolean;
}

export const AffectedComponentCard: React.FC<AffectedComponentProps> = ({ testId, issueId, selector, pageUrl }) => {
  const [result, setResult] = useState<AnnotatedResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setResult(null);
    fetch(`${API_BASE_URL}/ai-automation/annotated-screenshot?testId=${encodeURIComponent(testId)}&issueId=${encodeURIComponent(issueId)}`)
      .then((res) => res.json())
      .then((json: AnnotatedResult) => {
        if (!cancelled) setResult(json);
      })
      .catch(() => {
        if (!cancelled) setResult({ available: false, reason: 'request_failed' });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [testId, issueId]);

  let pagePath = pageUrl;
  try {
    if (pageUrl) pagePath = new URL(pageUrl).pathname || '/';
  } catch {
    // keep raw pageUrl if it isn't a parseable absolute URL
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-6">
      <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 mb-4">
        <span>🎯</span> Affected Component
      </h3>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-4">
        <div className="relative rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 min-h-[140px] flex items-center justify-center">
          {loading && (
            <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500 py-8">
              <i className="ph ph-spinner-gap animate-spin" /> Capturing the affected page…
            </div>
          )}
          {!loading && result?.available && result.path && (
            <>
              {result.annotated === false && (
                <span className="absolute top-2 left-2 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-700/90 text-white shadow-sm">
                  Full page
                </span>
              )}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={api.screenshotUrl(result.path)} alt="Affected component" className="w-full h-auto" />
            </>
          )}
          {!loading && result && !result.available && (
            <div className="text-center py-8 px-4">
              <i className="ph ph-image-broken text-2xl text-slate-300 dark:text-slate-600 block mb-1.5" />
              <p className="text-xs text-slate-400 dark:text-slate-500">
                {result.reason === 'no_url'
                  ? 'This issue has no associated page to capture.'
                  : 'The page could not be reached to capture a screenshot right now.'}
              </p>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row lg:flex-col lg:w-44">
          <div className="flex-1 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-700 p-3">
            <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 block mb-1">Component</span>
            <code className="text-xs font-mono text-slate-700 dark:text-slate-300 break-all">{selector || 'n/a'}</code>
          </div>
          <div className="flex-1 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-700 p-3">
            <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 block mb-1">Page</span>
            <code className="text-xs font-mono text-slate-700 dark:text-slate-300 break-all">{pagePath || 'n/a'}</code>
          </div>
        </div>
      </div>
    </div>
  );
};
