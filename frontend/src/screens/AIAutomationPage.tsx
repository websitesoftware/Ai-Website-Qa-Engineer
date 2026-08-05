'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BugPrioritization } from '../components/ai-automation/BugPrioritization';
import { RootCauseAnalysis } from '../components/ai-automation/RootCauseAnalysis';
import { SuggestedFixes } from '../components/ai-automation/SuggestedFixes';
import { PullRequestGeneration } from '../components/ai-automation/PullRequestGeneration';
import { CicdIntegration } from '../components/ai-automation/CicdIntegration';
import { PasteIssueAnalyzer } from '../components/ai-automation/PasteIssueAnalyzer';
import { CodeReviewPanel } from '../components/ai-automation/CodeReviewPanel';
import { API_BASE_URL, api } from '../lib/api';
import { usePolling } from '../hooks/usePolling';

// ---------------------------------------------------------------------------
// Types (match the /api/ai-automation payload)
// ---------------------------------------------------------------------------
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
  filePath?: string | null;
  grounded?: boolean;
  autoFixable?: boolean;
}
interface Cicd {
  status: 'Passed' | 'Failed' | 'Running' | 'Idle';
  passed?: boolean;
  logs: string[];
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
  llm?: { enabled: boolean; provider: string };
  github?: { configured: boolean; repo?: string | null; repoName?: string; matchedBy?: string };
  prioritization?: Prioritization | null;
  rca?: Rca | null;
  fixes?: Fixes | null;
  cicd?: Cicd | null;
}

type Stage = 'idle' | 'prioritizing' | 'rca' | 'fixing' | 'cicd' | 'done';
const STAGE_ORDER: Stage[] = ['prioritizing', 'rca', 'fixing', 'cicd', 'done'];

export const AIAutomationPage: React.FC = () => {
  const [resp, setResp] = useState<AutomationResponse | null>(null);
  const [stage, setStage] = useState<Stage>('idle');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Staged reveal state (presentation only — data is already real & fetched).
  const [showPrio, setShowPrio] = useState(false);
  const [showRca, setShowRca] = useState(false);
  const [showFix, setShowFix] = useState(false);
  const [showCicd, setShowCicd] = useState(false);

  // PR action state
  const [pr, setPr] = useState<PullRequest | null>(null);
  const [prLoading, setPrLoading] = useState(false);

  // Merge (app-level approval gate) state
  const [mergeResult, setMergeResult] = useState<MergeResult | null>(null);
  const [mergeLoading, setMergeLoading] = useState(false);

  // Real source file/line for the top-priority issue — same locate call
  // (and same Gemini-assisted fallback) IssuesPage's "Go to File" uses, so
  // this panel can offer the identical click-to-VS-Code shortcut.
  const [located, setLocated] = useState<{
    filePath: string | null;
    fileFullPath: string | null;
    line: number | null;
  } | null>(null);

  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  const revealSequence = useCallback(() => {
    clearTimers();
    setShowPrio(false);
    setShowRca(false);
    setShowFix(false);
    setShowCicd(false);
    const schedule = (delay: number, fn: () => void) => timers.current.push(setTimeout(fn, delay));

    setStage('prioritizing');
    schedule(300, () => { setShowPrio(true); setStage('rca'); });
    schedule(900, () => { setShowRca(true); setStage('fixing'); });
    schedule(1500, () => { setShowFix(true); setStage('cicd'); });
    schedule(2100, () => { setShowCicd(true); setStage('done'); });
  }, []);

  const fetchAutomation = useCallback(async () => {
    setLoading(true);
    setError(null);
    setPr(null);
    try {
      const res = await fetch(`${API_BASE_URL}/ai-automation/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const json: AutomationResponse = await res.json();
      setResp(json);
      if (json.ready) revealSequence();
      else setStage('idle');
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Could not reach the QA backend. Make sure it is running on port 5000.',
      );
      setStage('idle');
    } finally {
      setLoading(false);
    }
  }, [revealSequence]);

  useEffect(() => {
    // Initial data fetch on mount — intentional, not a derived-state loop.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchAutomation();
    return clearTimers;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const running = loading || (stage !== 'idle' && stage !== 'done');

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
      if (latestCompleted && latestCompleted.id !== latestSeenTestId.current && !running) {
        fetchAutomation();
      }
    } catch {
      // backend unreachable — the manual button / next tick will recover
    }
  }, [fetchAutomation, running]);

  usePolling(checkForNewScan, 5000, true);

  const testId = resp?.testId;
  const issueId = resp?.prioritization?.issueId;
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resets the previous issue's location before fetching the new one's; mirrors QADataContext's fetch-on-change pattern
    setLocated(null);
    if (!testId || !issueId) return;
    let cancelled = false;
    api
      .locateIssue(testId, issueId)
      .then((result) => {
        if (cancelled) return;
        setLocated({ filePath: result.filePath, fileFullPath: result.fileFullPath, line: result.line });
      })
      .catch(() => {
        if (!cancelled) setLocated({ filePath: null, fileFullPath: null, line: null });
      });
    return () => {
      cancelled = true;
    };
  }, [testId, issueId]);

  /** vscode://file/<absolute-path>:<line> opens VS Code desktop at the exact location, when registered as a URL handler. */
  const vscodeFileUrl = (fileFullPath: string | null | undefined, line: number | null | undefined) => {
    if (!fileFullPath) return null;
    const normalized = fileFullPath.replace(/\\/g, '/');
    const prefixed = normalized.startsWith('/') ? normalized : `/${normalized}`;
    return `vscode://file${prefixed}${line ? `:${line}` : ''}`;
  };

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

  // Same rationale as createPr above: narrow deps are intentional.
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

  // Manual correction / removal of the AI-detected top issue. Both re-run
  // the whole pipeline afterwards so prioritization, RCA and the suggested
  // fix reflect the change (or move on to the next-ranked issue on delete).
  // Same narrow-deps rationale as createPr/mergePr above.
  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const editTopIssue = useCallback(async (fields: { title: string; severity: string; category: string }) => {
    if (!resp?.testId || !resp?.prioritization?.issueId) return;
    await api.editIssue(resp.testId, resp.prioritization.issueId, {
      title: fields.title,
      severity: fields.severity.toLowerCase(),
      category: fields.category,
    });
    await fetchAutomation();
  }, [resp?.testId, resp?.prioritization?.issueId, fetchAutomation]);

  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const deleteTopIssue = useCallback(async () => {
    if (!resp?.testId || !resp?.prioritization?.issueId) return;
    await api.deleteIssue(resp.testId, resp.prioritization.issueId);
    await fetchAutomation();
  }, [resp?.testId, resp?.prioritization?.issueId, fetchAutomation]);

  const stageIndex = STAGE_ORDER.indexOf(stage);
  const progressPct = stage === 'idle' ? 0 : Math.round(((stageIndex + 1) / STAGE_ORDER.length) * 100);

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

  return (
    <div className="bg-slate-50 dark:bg-slate-900 min-h-screen p-6 sm:p-8 text-slate-800 dark:text-slate-200 transition-colors duration-200">
      <header className="max-w-7xl mx-auto mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-6">
        <div>
          <div className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-1 flex items-center gap-2 flex-wrap">
            Core Operations Suite
            <span
              className={`normal-case font-semibold text-[10px] px-2 py-0.5 rounded-full border ${llmEnabled
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900'
                  : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                }`}
            >
              {llmEnabled ? `LLM: ${resp?.llm?.provider}` : 'LLM: rules only'}
            </span>
            <span
              className={`normal-case font-semibold text-[10px] px-2 py-0.5 rounded-full border ${githubConfigured && resp?.github?.repo
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900'
                  : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900'
                }`}
            >
              {!githubConfigured
                ? 'GitHub: not connected'
                : resp?.github?.repo
                  ? `GitHub: ${resp.github.repo}`
                  : 'GitHub: repo not identified'}
            </span>
            {githubConfigured && resp?.github?.matchedBy && (
              <span
                className="normal-case font-medium text-[10px] px-2 py-0.5 rounded-full border bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700"
                title="How the scanned URL was matched to a local repo"
              >
                matched by: {resp.github.matchedBy}
              </span>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            Phase 3 – AI Automation Engine
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {resp?.url
              ? <>Analysing the latest completed scan: <span className="font-mono text-slate-700 dark:text-slate-300">{resp.url}</span></>
              : 'Prioritises real detected issues, analyses root cause, and proposes fixes.'}
          </p>
        </div>

        <button
          onClick={fetchAutomation}
          disabled={running}
          className="inline-flex items-center gap-2 justify-center px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:bg-emerald-400 disabled:cursor-not-allowed text-white font-semibold text-sm rounded-lg shadow-sm hover:shadow transition-all duration-150 active:scale-[0.98] cursor-pointer"
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
      </header>

      {/* Error state */}
      {error && (
        <div className="max-w-7xl mx-auto mb-6 rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 p-4 text-sm text-red-700 dark:text-red-400">
          <strong className="font-semibold">Backend unreachable.</strong> {error}
        </div>
      )}

      {/* No completed scan yet — honest empty state, no fake data */}
      {!error && resp && !resp.ready && (
        <div className="max-w-7xl mx-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 p-8 text-center">
          <div className="text-3xl mb-3">🧪</div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-1">
            {resp.reason === 'test_not_complete' ? 'A scan is still running' : 'No completed scan yet'}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            The AI Automation engine works on the output of a real QA scan. Go to
            Test Management, run a test against a website, and come back here once
            it finishes — the pipeline will prioritise and analyse the actual issues found.
          </p>
        </div>
      )}

      {/* Real pipeline */}
      {!error && resp?.ready && (
        <>
          <div className="max-w-7xl mx-auto mb-8">
            <div className="flex justify-between text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              <span>Pipeline Progress</span>
              <span>{progressPct}%</span>
            </div>
            <div className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-blue-500 to-emerald-500"
                initial={{ width: 0 }}
                animate={{ width: `${progressPct}%` }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
              />
            </div>
          </div>

          <main className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            <div className="space-y-1">
              <AnimatePresence mode="wait">
                {showPrio && resp.prioritization && (
                  <motion.div key="prio" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
                    <BugPrioritization data={resp.prioritization} onEdit={editTopIssue} onDelete={deleteTopIssue} />
                  </motion.div>
                )}
              </AnimatePresence>
              {(!showPrio || !resp.prioritization) && <BugPrioritization data={null} />}

              <AnimatePresence mode="wait">
                {showRca && resp.rca && (
                  <motion.div key="rca" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
                    <RootCauseAnalysis
                      data={resp.rca}
                      editorUrl={vscodeFileUrl(located?.fileFullPath, located?.line)}
                      editorLabel={located?.filePath ? `${located.filePath}${located.line ? `:${located.line}` : ''}` : null}
                      locating={located === null}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
              {(!showRca || !resp.rca) && <RootCauseAnalysis data={null} />}

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
                  <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm mb-6">
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
                <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 shadow-sm mb-6">
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
            </div>

            <div className="space-y-1">
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: showFix ? 1 : 0.5, y: 0 }} transition={{ duration: 0.4 }}>
                <SuggestedFixes
                  codeBefore={(showFix && resp.fixes?.original) || ''}
                  codeAfter={(showFix && resp.fixes?.patched) || ''}
                  filePath={resp.fixes?.filePath}
                  grounded={resp.fixes?.grounded}
                  autoFixable={resp.fixes?.autoFixable}
                />
                {showFix && resp.fixes?.source && (
                  <p className="-mt-4 mb-6 text-[11px] text-slate-400 dark:text-slate-500 px-1">
                    Fix generated by: <span className="font-semibold">{resp.fixes.source === 'rules' ? 'deterministic rules' : resp.fixes.source}</span>
                  </p>
                )}
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: showCicd ? 1 : 0.5, y: 0 }} transition={{ duration: 0.4 }}>
                <CicdIntegration
                  status={(showCicd && resp.cicd?.status) || 'Idle'}
                  logs={(showCicd && resp.cicd?.logs) || []}
                />
                {showCicd && resp.cicd?.workflowRun?.url && (
                  <a href={resp.cicd.workflowRun.url} target="_blank" rel="noreferrer" className="block mt-2 text-xs text-blue-600 dark:text-blue-400 hover:underline px-1">
                    View GitHub Actions run →
                  </a>
                )}
              </motion.div>
            </div>
          </main>
        </>
      )}

      {/* Paste-an-issue analyzer — independent of whatever the "latest scan"
          happens to be right now, so it stays available even in the empty state. */}
      {!error && (
        <div className="max-w-7xl mx-auto mt-2">
          <PasteIssueAnalyzer />
        </div>
      )}
    </div>
  );
};
