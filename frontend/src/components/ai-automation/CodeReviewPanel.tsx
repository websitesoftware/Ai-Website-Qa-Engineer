'use client';

import React, { useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { API_BASE_URL } from '../../lib/api';

type Severity = 'high' | 'medium' | 'low';

interface ReviewIssue {
  line: number | null;
  severity: Severity;
  category: string;
  message: string;
}

interface ReviewResponse {
  summary: string | null;
  issues: ReviewIssue[];
  correctedCode: string | null;
  aiUnavailable: boolean;
}

const LANGUAGES = ['auto', 'typescript', 'javascript', 'css', 'html', 'jsx/tsx'] as const;

const SEVERITY_STYLES: Record<Severity, string> = {
  high: 'bg-red-50 text-red-700 border-red-100 dark:bg-red-950/40 dark:text-red-400 dark:border-red-900',
  medium: 'bg-orange-50 text-orange-700 border-orange-100 dark:bg-orange-950/40 dark:text-orange-400 dark:border-orange-900',
  low: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700',
};

export const CodeReviewPanel: React.FC = () => {
  const [code, setCode] = useState('');
  const [language, setLanguage] = useState<(typeof LANGUAGES)[number]>('auto');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ReviewResponse | null>(null);
  const [copied, setCopied] = useState(false);

  const review = useCallback(async () => {
    if (!code.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setCopied(false);
    try {
      const res = await fetch(`${API_BASE_URL}/ai-automation/review-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, language: language === 'auto' ? undefined : language }),
      });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const json: ReviewResponse = await res.json();
      setResult(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not reach the QA backend.');
    } finally {
      setLoading(false);
    }
  }, [code, language]);

  const copyCorrected = () => {
    if (!result?.correctedCode) return;
    navigator.clipboard.writeText(result.correctedCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="bg-white/85 dark:bg-slate-800 backdrop-blur-md p-6 rounded-2xl border border-slate-200/70 dark:border-slate-700 shadow-lg shadow-slate-900/5 mb-6">
      <h3 className="font-display text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 mb-1">
        <i className="ph ph-magnifying-glass text-purple-500"></i> AI Code Review
      </h3>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
        Paste a snippet (TypeScript, JavaScript, CSS, HTML) to catch hardcoded values, line-specific bugs, and
        CSS problems, and get back a fully corrected version.
      </p>

      <div className="flex flex-wrap items-center gap-2 mb-2">
        <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Language</label>
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value as (typeof LANGUAGES)[number])}
          className="px-2.5 py-1.5 rounded-lg text-xs bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-700 text-slate-700 dark:text-slate-200"
        >
          {LANGUAGES.map((l) => (
            <option key={l} value={l}>
              {l === 'auto' ? 'Auto-detect' : l}
            </option>
          ))}
        </select>
      </div>

      <textarea
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder={'Paste a component, function, or CSS block to review...'}
        rows={10}
        spellCheck={false}
        className="w-full px-3 py-2.5 border rounded-lg text-xs font-mono focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 bg-slate-50 border-slate-200 text-slate-800 dark:bg-slate-950 dark:border-slate-800 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 resize-y"
      />

      <button
        onClick={review}
        disabled={loading || !code.trim()}
        className="mt-3 inline-flex items-center justify-center w-full px-4 py-2.5 bg-[#1C56C9] hover:bg-[#164aac] dark:bg-blue-600 dark:hover:bg-blue-500 disabled:bg-blue-300 dark:disabled:bg-blue-900/40 disabled:cursor-not-allowed text-white text-sm font-bold rounded-xl shadow-sm transition-colors cursor-pointer"
      >
        {loading ? 'Reviewing…' : 'Review Code'}
      </button>

      {error && (
        <div className="mt-3 rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 p-3 text-xs text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="mt-5 space-y-4"
          >
            {result.aiUnavailable && (
              <div className="rounded-lg border border-orange-200 dark:border-orange-900 bg-orange-50 dark:bg-orange-950/30 p-3 text-xs text-orange-700 dark:text-orange-400">
                No AI provider configured — showing rule-based pattern checks only. No auto-fix is available in this mode.
              </div>
            )}

            {result.summary && <p className="text-sm text-slate-600 dark:text-slate-300">{result.summary}</p>}

            <div>
              <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                Issues found ({result.issues.length})
              </h4>
              {result.issues.length === 0 ? (
                <p className="text-sm text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                  <i className="ph ph-check-circle"></i> No issues found.
                </p>
              ) : (
                <div className="space-y-2">
                  {result.issues.map((issue, i) => (
                    <div
                      key={i}
                      className={`flex items-start gap-2.5 p-2.5 rounded-lg border text-xs ${SEVERITY_STYLES[issue.severity]}`}
                    >
                      <span className="font-mono font-bold shrink-0 mt-0.5">
                        {issue.line ? `L${issue.line}` : '—'}
                      </span>
                      <div className="flex-1 min-w-0">
                        <span className="font-bold uppercase tracking-wide text-[10px] mr-1.5">{issue.category}</span>
                        {issue.message}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {result.correctedCode && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Corrected code
                  </h4>
                  <button
                    onClick={copyCorrected}
                    className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                  >
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <pre className="w-full max-h-96 overflow-auto px-3 py-2.5 rounded-lg text-xs font-mono bg-slate-900 text-slate-100 border border-slate-800">
                  {result.correctedCode}
                </pre>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
