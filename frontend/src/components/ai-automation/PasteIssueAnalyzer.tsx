'use client';

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BugPrioritization } from './BugPrioritization';
import { RootCauseAnalysis } from './RootCauseAnalysis';
import { SuggestedFixes } from './SuggestedFixes';
import { API_BASE_URL } from '../../lib/api';

interface Prioritization {
  bugId: string;
  issueId: string;
  category: string;
  title: string;
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
  score: number;
  impactSummary: string;
}
interface Rca {
  culpritFile: string;
  errorLine: number;
  explanation: string;
  confidence: number;
}
interface Fixes {
  original: string;
  patched: string;
  source?: string;
}
interface PullRequestResult {
  configured?: boolean;
  branchName?: string;
  prTitle?: string;
  prUrl?: string;
  prNumber?: number;
  repo?: string;
  repoMatch?: { name?: string; path?: string; matchedBy?: string };
  status?: string;
  error?: string;
  reason?: string;
}
interface AnalyzeResponse {
  ready: boolean;
  reason?: string;
  source?: 'linked' | 'pasted';
  url?: string;
  github?: { configured: boolean; repo?: string | null; repoName?: string; matchedBy?: string };
  prioritization?: Prioritization | null;
  rca?: Rca | null;
  fixes?: Fixes | null;
  pullRequest?: PullRequestResult | null;
}

const READY_FALSE_COPY: Record<string, string> = {
  could_not_parse:
    "Couldn't find a URL in that text. Copy an issue with the \"Copy for AI Automation\" button on the Issues page, or make sure your pasted text includes a line like \"URL: https://...\".",
};

export const PasteIssueAnalyzer: React.FC = () => {
  const [pastedText, setPastedText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzeResponse | null>(null);

  const analyze = useCallback(async () => {
    if (!pastedText.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`${API_BASE_URL}/ai-automation/analyze-issue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pastedText }),
      });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const json: AnalyzeResponse = await res.json();
      setResult(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not reach the QA backend.');
    } finally {
      setLoading(false);
    }
  }, [pastedText]);

  const pr = result?.pullRequest;
  const githubConfigured = result?.github?.configured;

  return (
    <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm mb-6">
      <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 mb-1">
        <span>📋</span> Paste an Issue &rarr; Auto-Generate PR
      </h3>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
        Copy an issue from the Issues page ("Copy for AI Automation") and paste it here. Analyzing
        it auto-detects the target repo from the issue's URL and opens a real PR.
      </p>

      <textarea
        value={pastedText}
        onChange={(e) => setPastedText(e.target.value)}
        placeholder={'[HIGH] Broken link to /old-page\nURL: https://example.com/page\nCategory: broken-link\n\nAnalysis: ...'}
        rows={5}
        className="w-full px-3 py-2.5 border rounded-lg text-xs font-mono focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 bg-slate-50 border-slate-200 text-slate-800 dark:bg-slate-950 dark:border-slate-800 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 resize-y"
      />

      <button
        onClick={analyze}
        disabled={loading || !pastedText.trim()}
        className="mt-3 inline-flex items-center justify-center w-full px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg shadow-sm transition-colors cursor-pointer"
      >
        {loading ? 'Analyzing…' : '🔍 Analyze & Generate PR'}
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
            className="mt-5 space-y-1"
          >
            {!result.ready ? (
              <div className="rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 p-3 text-xs text-amber-700 dark:text-amber-400">
                {READY_FALSE_COPY[result.reason || ''] || 'Could not analyze this issue.'}
              </div>
            ) : (
              <>
                <div className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 mb-1">
                  Source: {result.source === 'linked' ? 'matched to the original scan record' : 'parsed from pasted text'}
                </div>
                <BugPrioritization data={result.prioritization || null} />
                <RootCauseAnalysis data={result.rca || null} />
                <SuggestedFixes codeBefore={result.fixes?.original || ''} codeAfter={result.fixes?.patched || ''} />

                {/* PR outcome */}
                <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 mb-2">
                    <span>🌿</span> Pull Request
                  </h4>
                  {!githubConfigured ? (
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      GitHub isn&apos;t connected, so no PR was opened. The analysis above is still real.
                    </p>
                  ) : pr?.prUrl ? (
                    <div className="space-y-2">
                      <div className="text-xs text-slate-600 dark:text-slate-400">
                        Repo: <code className="font-mono bg-slate-100 dark:bg-slate-900/50 px-1.5 py-0.5 rounded">{pr.repo}</code>
                        {pr.repoMatch?.matchedBy && <span className="ml-1.5 text-slate-400 dark:text-slate-500">(matched by {pr.repoMatch.matchedBy})</span>}
                      </div>
                      <a
                        href={pr.prUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-center w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors"
                      >
                        🚀 View Generated PR on GitHub
                      </a>
                    </div>
                  ) : (
                    <p className="text-xs text-red-600 dark:text-red-400">
                      {pr?.error || 'PR could not be created.'}
                    </p>
                  )}
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
