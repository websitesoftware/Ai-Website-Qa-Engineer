'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TicketOverviewCard } from '../components/ai-automation/TicketOverviewCard';
import { IssueAnalysisCard } from '../components/ai-automation/IssueAnalysisCard';
import { AffectedComponentCard } from '../components/ai-automation/AffectedComponentCard';
import { ReleaseNotesCard } from '../components/ai-automation/ReleaseNotesCard';
import { CicdSummaryCard } from '../components/ai-automation/CicdSummaryCard';
import { ResolutionVerificationCard } from '../components/ai-automation/ResolutionVerificationCard';
import { PullRequestGeneration } from '../components/ai-automation/PullRequestGeneration';
import { API_BASE_URL } from '../lib/api';
import { usePolling } from '../hooks/usePolling';
import { useNewTestModal } from '../context/NewTestModalContext';

// ---------------------------------------------------------------------------
// Types (match the /api/ai-automation payload)
// ---------------------------------------------------------------------------
interface Prioritization {
  bugId: string;
  issueId: string;
  category: string;
  issueType: string;
  title: string;
  description: string | null;
  suggestion: string | null;
  selector: string | null;
  url: string | null;
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
  filePath?: string | null;
  grounded?: boolean;
  autoFixable?: boolean;
}
interface CicdCounts {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
}
interface Cicd {
  status: 'Passed' | 'Failed' | 'Running' | 'Idle';
  passed?: boolean;
  logs: string[];
  counts?: CicdCounts;
  workflowRun?: { url: string };
}
interface RepoMatch {
  name?: string;
  path?: string;
  matchedBy?: string; // "hostname" | "live-port" | "url-path" | "port" | "unmatched" | "ambiguous_*"
}
interface PullRequest {
  configured?: boolean;
  branchName?: string;
  prTitle?: string;
  prUrl?: string;
  prNumber?: number;
  repo?: string; // "owner/repo" the PR was actually opened in
  repoMatch?: RepoMatch;
  status?: string;
  error?: string;
  reason?: string;
  noCodeChange?: boolean;
}
interface MergeResult {
  configured?: boolean;
  merged?: boolean;
  reason?: string;
  approvalCount?: number;
  changesRequestedCount?: number;
  error?: string;
}
interface AutomationResponse {
  ready: boolean;
  reason?: string;
  status?: string;
  testId?: string;
  url?: string;
  generatedAt?: string;
  llm?: { enabled: boolean; provider: string };
  github?: { configured: boolean; repo?: string | null; repoName?: string; matchedBy?: string };
  prioritization?: Prioritization | null;
  rca?: Rca | null;
  fixes?: Fixes | null;
  cicd?: Cicd | null;
  releaseNotes?: string | null;
}

export const AIAutomationPage: React.FC = () => {
  const { open: openNewTest } = useNewTestModal();
  const [resp, setResp] = useState<AutomationResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // PR action state
  const [pr, setPr] = useState<PullRequest | null>(null);
  const [prLoading, setPrLoading] = useState(false);

  // Merge (app-level approval gate) state
  const [mergeResult, setMergeResult] = useState<MergeResult | null>(null);
  const [mergeLoading, setMergeLoading] = useState(false);

  const fetchAutomation = useCallback(async () => {
    setLoading(true);
    setError(null);
    setPr(null);
    setMergeResult(null);
    try {
      const res = await fetch(`${API_BASE_URL}/ai-automation/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const json: AutomationResponse = await res.json();
      setResp(json);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Could not reach the QA backend. Make sure it is running on port 5000.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Initial data fetch on mount — intentional, not a derived-state loop.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchAutomation();
  }, [fetchAutomation]);

  // Real-time scanning: watch for a newly completed test (from Test Management
  // running in another tab, or a fresh crawl finishing) and auto re-run the
  // automation pipeline against it — no manual "re-analyse" click needed.
  const latestSeenTestId = useRef<string | undefined>(undefined);
  useEffect(() => {
    latestSeenTestId.current = resp?.testId;
  }, [resp?.testId]);

  const checkForNewScan = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/tests`);
      if (!res.ok) return;
      const tests: Array<{ id: string; status: string }> = await res.json();
      const latestCompleted = tests.find(
        (t) => t.status === 'passed' || t.status === 'failed',
      );
      if (latestCompleted && latestCompleted.id !== latestSeenTestId.current && !loading) {
        fetchAutomation();
      }
    } catch {
      // backend unreachable — the manual button / next tick will recover
    }
  }, [fetchAutomation, loading]);

  usePolling(checkForNewScan, 5000, true);

  // Deliberately narrow deps (only the fields actually used) so this isn't
  // recreated on every unrelated `resp` change — the compiler's inferred
  // whole-object dep would defeat that intentionally.
  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const createPr = useCallback(async () => {
    if (!resp?.testId) return;
    setPrLoading(true);
    setMergeResult(null);
    try {
      const res = await fetch(`${API_BASE_URL}/ai-automation/pr`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testId: resp.testId }),
      });
      const json: PullRequest = await res.json();
      setPr(json);
    } catch (e) {
      setPr({ error: e instanceof Error ? e.message : 'PR request failed' });
    } finally {
      setPrLoading(false);
    }
  }, [resp?.testId]);

  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const mergePr = useCallback(async () => {
    if (!pr?.prNumber) return;
    setMergeLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/ai-automation/merge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prNumber: pr.prNumber, repo: pr.repo }),
      });
      const json: MergeResult = await res.json();
      setMergeResult(json);
    } catch (e) {
      setMergeResult({ error: e instanceof Error ? e.message : 'Merge request failed' });
    } finally {
      setMergeLoading(false);
    }
  }, [pr?.prNumber, pr?.repo]);

  const running = loading;

  // ---- Initial spinner ----
  if (loading && !resp) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col items-center justify-center gap-3">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 tracking-wide animate-pulse">
          Analysing latest scan…
        </p>
      </div>
    );
  }

  const llmEnabled = resp?.llm?.enabled;
  const githubConfigured = resp?.github?.configured;
  const p = resp?.prioritization;

  const suggestedFixText =
    resp?.fixes?.autoFixable && resp.fixes.filePath
      ? `Automatically patches ${resp.fixes.filePath} — see the generated pull request below.`
      : p?.suggestion || p?.description || null;

  return (
    <div className="bg-slate-50 dark:bg-slate-900 min-h-screen p-6 sm:p-8 text-slate-800 dark:text-slate-200 transition-colors duration-200">
      <header className="max-w-6xl mx-auto mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 shadow-md shadow-blue-600/30 flex items-center justify-center text-2xl shrink-0">
            🤖
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              AI Agent – Website QA Automation
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Smart Analysis · Intelligent Suggestions · Faster Resolution
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <span
            className={`text-[10px] font-semibold px-2.5 py-1 rounded-full border ${llmEnabled
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900'
                : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
              }`}
          >
            {llmEnabled ? `LLM: ${resp?.llm?.provider}` : 'LLM: rules only'}
          </span>
          <span
            className={`text-[10px] font-semibold px-2.5 py-1 rounded-full border ${githubConfigured && resp?.github?.repo
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900'
                : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900'
              }`}
          >
            {!githubConfigured ? 'GitHub: not connected' : resp?.github?.repo ? `GitHub: ${resp.github.repo}` : 'GitHub: repo not identified'}
          </span>
          <button
            onClick={openNewTest}
            className="inline-flex items-center gap-2 justify-center px-4 py-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-xs rounded-lg shadow-sm transition-all duration-150 active:scale-[0.98] cursor-pointer"
          >
            🌐 Scan a Website
          </button>
          <button
            onClick={fetchAutomation}
            disabled={running}
            className="inline-flex items-center gap-2 justify-center px-4 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:bg-blue-400 disabled:cursor-not-allowed text-white font-semibold text-xs rounded-lg shadow-sm transition-all duration-150 active:scale-[0.98] cursor-pointer"
          >
            <motion.span
              animate={running ? { rotate: 360 } : { rotate: 0 }}
              transition={running ? { repeat: Infinity, duration: 1, ease: 'linear' } : {}}
              className="inline-block"
            >
              🔄
            </motion.span>
            {running ? 'Analysing…' : 'Re-analyse Latest Scan'}
          </button>
        </div>
      </header>

      {error && (
        <div className="max-w-6xl mx-auto mb-6 rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 p-4 text-sm text-red-700 dark:text-red-400">
          <strong className="font-semibold">Backend unreachable.</strong> {error}
        </div>
      )}

      {!error && resp && !resp.ready && (
        <div className="max-w-6xl mx-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 p-8 text-center">
          <div className="text-3xl mb-3">🧪</div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-1">
            {resp.reason === 'test_not_complete' ? 'A scan is still running' : 'No completed scan yet'}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-5">
            {resp.reason === 'test_not_complete'
              ? "The AI Automation engine works on the output of a real QA scan — it'll pick this one up automatically the moment it finishes."
              : 'The AI Automation engine works on the output of a real QA scan. Scan a website below, and once it finishes the pipeline will prioritise and analyse the actual issues found.'}
          </p>
          {resp.reason !== 'test_not_complete' && (
            <button
              onClick={openNewTest}
              className="inline-flex items-center gap-2 justify-center px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm rounded-lg shadow-sm transition-colors cursor-pointer"
            >
              🌐 Scan a Website
            </button>
          )}
        </div>
      )}

      <AnimatePresence>
        {!error && resp?.ready && p && resp.testId && (
          <motion.main
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="max-w-6xl mx-auto space-y-5"
          >
            <TicketOverviewCard
              bugId={p.bugId}
              title={p.title}
              severity={p.severity}
              confidence={resp.rca?.confidence ?? null}
              scanDate={resp.generatedAt || null}
            />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <IssueAnalysisCard
                issueType={p.issueType}
                category={p.category}
                severity={p.severity}
                rootCause={resp.rca?.explanation || null}
                suggestedFix={suggestedFixText}
              />
              <AffectedComponentCard
                testId={resp.testId}
                issueId={p.issueId}
                selector={p.selector}
                pageUrl={p.url || resp.url || null}
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <ReleaseNotesCard
                issueTitle={p.title}
                notes={resp.releaseNotes || null}
                affectedComponent={p.selector}
                generatedAt={resp.generatedAt || null}
                resolved={Boolean(pr?.prUrl)}
              />
              <CicdSummaryCard
                status={resp.cicd?.status || 'Idle'}
                counts={resp.cicd?.counts || null}
                logs={resp.cicd?.logs || []}
                workflowRunUrl={resp.cicd?.workflowRun?.url}
              />
            </div>

            {/* Pull request — real when GitHub connected, honest notice otherwise */}
            {githubConfigured ? (
              pr && pr.prUrl ? (
                <PullRequestGeneration
                  data={{
                    branchName: pr.branchName || '',
                    prTitle: pr.prTitle || '',
                    prUrl: pr.prUrl,
                    status: pr.status || 'Open',
                    repo: pr.repo,
                    repoMatch: pr.repoMatch,
                    filePath: resp.fixes?.filePath,
                  }}
                  onMerge={mergePr}
                  merge={{
                    loading: mergeLoading,
                    merged: Boolean(mergeResult?.merged),
                    reason: mergeResult?.reason,
                    approvalCount: mergeResult?.approvalCount,
                    changesRequestedCount: mergeResult?.changesRequestedCount,
                    error: mergeResult?.error,
                  }}
                />
              ) : (
                <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 mb-3">
                    <span>🌿</span> Pull Request Generation
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                    Opens a real PR that patches the actual offending source file in your
                    connected repo — never a generic report.
                  </p>
                  {pr?.noCodeChange ? (
                    <p className="text-xs text-amber-600 dark:text-amber-400 mb-3">
                      {pr.error ||
                        'No auto-fixable code change was found in your repo, so no PR was opened — ' +
                          'opening one with nothing but commentary would be dishonest.'}{' '}
                      Fix it manually, or re-analyse once you have (see Root Cause Analysis for
                      the observed location).
                    </p>
                  ) : pr?.error ? (
                    <p className="text-xs text-red-600 dark:text-red-400 mb-3">Error: {pr.error}</p>
                  ) : null}
                  <button
                    onClick={createPr}
                    disabled={prLoading}
                    className="inline-flex items-center justify-center w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors cursor-pointer"
                  >
                    {prLoading ? 'Opening PR…' : '🚀 Generate Pull Request'}
                  </button>
                </div>
              )
            ) : (
              <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 shadow-sm">
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 mb-2">
                  <span>🌿</span> Pull Request Generation
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Not connected. Set <code className="font-mono text-xs bg-slate-100 dark:bg-slate-700 px-1 rounded">GITHUB_TOKEN</code> and{' '}
                  <code className="font-mono text-xs bg-slate-100 dark:bg-slate-700 px-1 rounded">GITHUB_REPO</code> in the
                  backend <code className="font-mono text-xs bg-slate-100 dark:bg-slate-700 px-1 rounded">.env</code> to open real PRs
                  against your own repository. (A public scanner can&apos;t PR a site it doesn&apos;t own.)
                </p>
              </div>
            )}

            <ResolutionVerificationCard testId={resp.testId} issueId={p.issueId} issueTitle={p.title} />
          </motion.main>
        )}
      </AnimatePresence>
    </div>
  );
};
