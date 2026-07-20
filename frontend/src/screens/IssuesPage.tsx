

'use client';
import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bug,
  MagnifyingGlass,
  Globe,
  Sparkle,
  Lightbulb,
  Copy,
  EyeSlash,
  ArrowsCounterClockwise,
  Check,
  Folder,
  ListChecks,
} from '@phosphor-icons/react';
import { useQAData } from '../context/QADataContext';
import { useToast } from '../context/ToastContext';
import { buildIssueRows, IssueRow } from '../lib/adapters';
import { EmptyState } from '../components/ui/EmptyState';
import { Skeleton } from '../components/ui/Skeleton';
import { getPhase, getEffort, PHASES, PHASE_ORDER, PhaseId } from '../lib/phases';
import { getDynamicFixCode } from '../lib/fixTemplates'; // <- move your 200-line


const severityBadge: Record<string, string> = {
  critical: 'bg-red-50 text-red-600 border-red-100 dark:bg-red-950/40 dark:text-red-400 dark:border-red-900',
  high: 'bg-orange-50 text-orange-600 border-orange-100 dark:bg-orange-950/40 dark:text-orange-400 dark:border-orange-900',
  medium: 'bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900',
  low: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700',
};

const severityBorder: Record<string, string> = {
  critical: 'border-red-500',
  high: 'border-orange-500',
  medium: 'border-amber-500',
  low: 'border-slate-400',
};

/** Parse once, not on every render pass of every filter. */
const hostOf = (url: string): string => {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
};

type PhaseFilter = 'all' | PhaseId;

export const IssuesPage: React.FC = () => {
  const { tests, loading, rerunTest, updateIssue } = useQAData();
  const { showToast } = useToast();

  const rowKey = (r: IssueRow) => `${r.testId}:${r.id}`;

  /**
   * Decorate once. `phase`, `effort` and `host` are pure functions of the row,
   * so computing them inside a .filter() that runs on every keystroke was waste.
   */
  const allRows = useMemo(
    () =>
      buildIssueRows(tests).map((r) => ({
        ...r,
        host: hostOf(r.url),
        phase: getPhase(r),
        effort: getEffort(r.title),
      })),
    [tests]
  );
  type Row = (typeof allRows)[number];

  const uniqueWebsites = useMemo(
    () => Array.from(new Set(allRows.map((r) => r.host))),
    [allRows]
  );

  // Which phases actually exist in the current data. Don't offer empty options.
  const availablePhases = useMemo(
    () => PHASE_ORDER.filter((p) => allRows.some((r) => r.phase === p)),
    [allRows]
  );

  // ---- state ---------------------------------------------------------------
  const [selectedWebsite, setSelectedWebsite] = useState<string>('all');
  const [selectedPhase, setSelectedPhase] = useState<PhaseFilter>('all');
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [currentTab, setCurrentTab] = useState<'Open' | 'Critical' | 'Resolved'>('Open');
  const [searchQuery, setSearchQuery] = useState('');
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  // ---- filtering -----------------------------------------------------------
  /**
   * SCOPE = everything except tab and search.
   * The counts on the tabs are derived from THIS, which fixes your bug:
   * previously openCount was computed from a list that had already been
   * tab-filtered, so clicking "Resolved" made both counters read (0), and
   * typing in the search box made them jump around.
   */
  const scopedRows = useMemo(
    () =>
      allRows.filter((row) => {
        if (dismissed.has(rowKey(row))) return false;
        if (selectedWebsite !== 'all' && row.host !== selectedWebsite) return false;
        if (selectedPhase !== 'all' && row.phase !== selectedPhase) return false;
        return true;
      }),
    [allRows, dismissed, selectedWebsite, selectedPhase]
  );

  const openCount = scopedRows.filter((r) => !r.resolved).length;
  const criticalCount = scopedRows.filter((r) => !r.resolved && r.severity === 'critical').length;
  const resolvedCount = scopedRows.filter((r) => r.resolved).length;

  const visibleRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return scopedRows
      .filter((row) => {
        if (q && !(row.title.toLowerCase().includes(q) || row.repId.toLowerCase().includes(q)))
          return false;
        if (currentTab === 'Open') return !row.resolved;
        if (currentTab === 'Critical') return !row.resolved && row.severity === 'critical';
        return row.resolved;
      })
      // Order the feed by the phase, so the list itself is the worklist.
      .sort((a, b) => a.phase - b.phase || a.severity.localeCompare(b.severity));
  }, [scopedRows, searchQuery, currentTab]);

  const activeRow: Row | null =
    visibleRows.find((r) => rowKey(r) === activeKey) || visibleRows[0] || null;

  // ---- handlers ------------------------------------------------------------
  const handleResolveToggle = async (row: Row) => {
    try {
      await updateIssue(row.testId, row.id, !row.resolved);
      showToast(row.resolved ? `Reopened ${row.repId}` : `Marked ${row.repId} as resolved`, 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not update issue', 'error');
    }
  };

  const handleRetest = async (row: Row) => {
    // Toast BEFORE the await. Your version fired "Triggering a fresh scan..."
    // only after the scan request had already completed.
    showToast('Triggering a fresh scan for this site...', 'info');
    try {
      await rerunTest(row.testId);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not start re-test', 'error');
    }
  };

  const handleDismiss = (row: Row) => {
    setDismissed((prev) => new Set(prev).add(rowKey(row)));
    setActiveKey(null);
    showToast('Hidden from this view until the next scan', 'info');
  };

  // The real applied patch when the AI Automation pipeline grounded and
  // (optionally) auto-applied one — falls back to the generic keyword-
  // matched template only when no real fix exists yet for this issue.
  const getFixDisplay = (row: Row) => {
    const applied = row.appliedFix;
    if (applied) {
      const header = applied.filePath
        ? `// ${applied.filePath}${applied.autoFixable ? ' (applied)' : ' (suggested — review before applying)'}`
        : '// Guidance only — no exact source line matched in your repo';
      const code =
        `${header}\n\n--- before\n${applied.original}\n\n+++ after\n${applied.patched}`;
      return {
        code,
        label: applied.autoFixable
          ? 'Grounded fix — applied in a real PR'
          : applied.grounded
            ? 'Grounded location — review before applying'
            : 'Best-effort guidance (no matching file found)',
        grounded: applied.grounded,
      };
    }
    return {
      code: getDynamicFixCode(row.title),
      label: 'Generic guidance — run AI Automation on this scan for a fix grounded in your repo',
      grounded: false,
    };
  };

  const handleCopy = async (row: Row, explicitCode?: string) => {
    const text =
      `[${row.severity.toUpperCase()}] [${PHASES[row.phase].label}] ${row.title}\n` +
      `URL: ${row.url}\n\nAnalysis: ${row.analysis}` +
      (explicitCode ? `\n\nCode Fix Snippet:\n${explicitCode}` : '');
    try {
      // navigator.clipboard is undefined on non-HTTPS origins. You were not
      // awaiting this and not catching it, so it failed silently while still
      // showing a success toast.
      await navigator.clipboard.writeText(text);
      showToast('Issue details and fix logic copied!', 'success');
    } catch {
      showToast('Clipboard unavailable — copy manually', 'error');
    }
  };

  // Copies a reference the AI Automation page's paste box can look up exactly
  // (testId+issueId), plus a human-readable summary as a fallback if the
  // marker line ever gets stripped or hand-edited.
  const handleCopyForAutomation = async (row: Row) => {
    const text =
      `QA-ISSUE-REF testId=${row.testId} issueId=${row.id}\n` +
      `[${row.severity.toUpperCase()}] ${row.title}\n` +
      `URL: ${row.url}\n` +
      `Category: ${row.category}\n\n` +
      `Analysis: ${row.analysis}` +
      (row.suggestion ? `\n\nSuggestion: ${row.suggestion}` : '');
    try {
      await navigator.clipboard.writeText(text);
      showToast('Issue copied — paste it into AI Automation to auto-generate a PR', 'success');
    } catch {
      showToast('Clipboard unavailable — copy manually', 'error');
    }
  };

  return (
    <div className="space-y-6 w-full max-w-[1600px] mx-auto px-4 py-2">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
            <Bug className="text-indigo-600 w-7 h-7" /> Issue Tracker
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {selectedPhase === 'all'
              ? 'Issues ordered by remediation phase — work top to bottom.'
              : PHASES[selectedPhase].blurb}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* PHASE DROPDOWN */}
          <div className="relative flex items-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm focus-within:ring-4 focus-within:ring-indigo-500/10 transition-all px-3">
            <ListChecks className="text-indigo-500 w-4 h-4 mr-2" />
            <select
              value={selectedPhase}
              onChange={(e) => {
                const v = e.target.value;
                setSelectedPhase(v === 'all' ? 'all' : (Number(v) as PhaseId));
                setActiveKey(null);
              }}
              className="py-2 bg-transparent text-sm text-slate-700 dark:text-slate-300 font-semibold focus:outline-none pr-6 cursor-pointer"
            >
              <option value="all">🧭 All Phases</option>
              {availablePhases.map((p) => (
                <option key={p} value={p}>
                  {PHASES[p].label}
                </option>
              ))}
            </select>
          </div>

          {/* ===== SITE DROPDOWN — delete this block if you really want it gone ===== */}
          <div className="relative flex items-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm focus-within:ring-4 focus-within:ring-indigo-500/10 transition-all px-3">
            <Folder className="text-indigo-500 w-4 h-4 mr-2" />
            <select
              value={selectedWebsite}
              onChange={(e) => {
                setSelectedWebsite(e.target.value);
                setActiveKey(null);
              }}
              className="py-2 bg-transparent text-sm text-slate-700 dark:text-slate-300 font-semibold focus:outline-none pr-6 cursor-pointer"
            >
              <option value="all">📂 All Scanned Sites</option>
              {uniqueWebsites.map((site) => (
                <option key={site} value={site}>
                  🌐 {site}
                </option>
              ))}
            </select>
          </div>
          {/* ===== end site dropdown ===== */}

          <div className="relative">
            <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 w-4 h-4" />
            <input
              type="text"
              placeholder="Search target issues..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 text-sm w-full sm:w-64 bg-white dark:bg-slate-950 dark:text-white transition-all shadow-sm"
            />
          </div>
        </div>
      </div>

      {loading && allRows.length === 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5"><Skeleton className="h-[72vh] rounded-xl" /></div>
          <div className="lg:col-span-7"><Skeleton className="h-[72vh] rounded-xl" /></div>
        </div>
      ) : allRows.length === 0 ? (
        <EmptyState icon="bug-beetle" title="No issues yet" description="Run a scan to start populating the issue tracker." />
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden flex flex-col lg:flex-row" style={{ height: '75vh' }}>
          {/* Left feed */}
          <section className="w-full lg:w-5/12 border-r border-slate-200 dark:border-slate-700 overflow-y-auto bg-slate-50/40 dark:bg-slate-900/40 flex flex-col min-w-[320px]">
            <div className="px-5 py-4 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between sticky top-0 z-20 shadow-sm">
              <div className="flex space-x-1 p-1 bg-slate-100 dark:bg-slate-900 rounded-lg">
                {(['Open', 'Critical', 'Resolved'] as const).map((tab) => {
                  const n = tab === 'Open' ? openCount : tab === 'Critical' ? criticalCount : resolvedCount;
                  return (
                    <button
                      key={tab}
                      onClick={() => setCurrentTab(tab)}
                      className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${currentTab === tab ? 'text-slate-900 bg-white shadow-sm dark:text-slate-100 dark:bg-slate-800' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                        }`}
                    >
                      {tab} ({n})
                    </button>
                  );
                })}
              </div>
              <span className="text-[11px] text-slate-400 dark:text-slate-500 font-semibold tracking-wide uppercase">
                {selectedPhase === 'all' ? 'All phases' : `Phase ${selectedPhase}`}
              </span>
            </div>

            <div className="bg-white dark:bg-slate-800 flex-1">
              <AnimatePresence initial={false}>
                {visibleRows.map((row, i) => {
                  const key = rowKey(row);
                  const isSelected = activeRow ? rowKey(activeRow) === key : false;
                  // In "All Phases" view, print a group header whenever the phase
                  // changes. This is what actually answers "which issues belong
                  // to which phase" without an accordion.
                  const showGroupHeader =
                    selectedPhase === 'all' && (i === 0 || visibleRows[i - 1].phase !== row.phase);

                  return (
                    <React.Fragment key={key}>
                      {showGroupHeader && (
                        <div className="px-5 py-2 bg-slate-50 dark:bg-slate-900/50 border-y border-slate-200 dark:border-slate-800 sticky top-[65px] z-10">
                          <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                            {PHASES[row.phase].label}
                          </span>
                          <span className="ml-2 text-[11px] text-slate-400 dark:text-slate-500 font-medium">
                            {visibleRows.filter((r) => r.phase === row.phase).length} issue(s)
                          </span>
                        </div>
                      )}
                      <motion.div
                        layout="position"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setActiveKey(key)}
                        className={`p-5 cursor-pointer border-b border-slate-100 dark:border-slate-800 border-l-[5px] ${severityBorder[row.severity] || 'border-slate-400'
                          } transition-all ${isSelected ? 'bg-indigo-50/40 shadow-sm dark:bg-indigo-950/30' : 'hover:bg-slate-50/60 dark:hover:bg-slate-800/40'}`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-1.5">
                            <span className={`text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded border ${severityBadge[row.severity] || severityBadge.low}`}>
                              {row.severity}
                            </span>
                            <span className={`text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded border ${PHASES[row.phase].badge}`}>
                              P{row.phase}
                            </span>
                          </div>
                          <span className="text-xs font-mono text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-900/50 px-1.5 py-0.5 rounded border border-slate-100 dark:border-slate-800">{row.repId}</span>
                        </div>
                        <h4 className={`font-bold text-slate-900 dark:text-slate-100 mt-2.5 text-sm leading-snug tracking-tight ${row.resolved ? 'line-through text-slate-400 dark:text-slate-500' : ''}`}>
                          {row.title}
                        </h4>
                        <div className="flex items-center gap-2 mt-3.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                          <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-600 dark:text-slate-400">{row.category}</span>
                          <span>•</span>
                          <span className="text-slate-400 dark:text-slate-500">{row.effort ? `${row.effort} effort` : 'effort unknown'}</span>
                          <span>•</span>
                          <span className="truncate max-w-[140px] font-mono text-slate-400 dark:text-slate-500">{row.host}</span>
                        </div>
                      </motion.div>
                    </React.Fragment>
                  );
                })}
              </AnimatePresence>

              {visibleRows.length === 0 && (
                <div className="p-12 text-center text-sm font-medium text-slate-400 dark:text-slate-500 bg-slate-50/50 dark:bg-slate-900/30 h-full flex flex-col items-center justify-center gap-2">
                  <span>Nothing in this phase for the current filters.</span>
                </div>
              )}
            </div>
          </section>

          {/* Right inspector.
              NOTE: still `hidden lg:flex`. On mobile, tapping a card does nothing.
              Fix that separately — a bottom sheet or a routed detail view. */}
          <section className="hidden lg:flex lg:w-7/12 flex-col bg-white dark:bg-slate-800 overflow-y-auto">
            <AnimatePresence mode="wait">
              {activeRow ? (() => {
                const fixDisplay = getFixDisplay(activeRow);
                return (
                <motion.div
                  key={rowKey(activeRow)}
                  initial={{ opacity: 0, scale: 0.99 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.99 }}
                  transition={{ duration: 0.15 }}
                  className="p-6 flex-1 flex flex-col justify-between space-y-6"
                >
                  <div className="space-y-6">
                    <div className="space-y-2.5 border-b border-slate-100 dark:border-slate-800 pb-4">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-xs font-extrabold uppercase tracking-wider px-2.5 py-1 rounded border ${severityBadge[activeRow.severity] || severityBadge.low}`}>
                            {activeRow.severity} severity
                          </span>
                          <span className={`text-xs font-extrabold uppercase tracking-wider px-2.5 py-1 rounded border ${PHASES[activeRow.phase].badge}`}>
                            {PHASES[activeRow.phase].label}
                          </span>
                          <span className="text-xs font-mono font-bold text-slate-400 dark:text-slate-500">{activeRow.repId}</span>
                          {activeRow.appliedFix?.mergedAt && (
                            <a
                              href={activeRow.appliedFix.prUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[11px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded border bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900 hover:underline"
                            >
                              ✅ Resolved — merged in PR #{activeRow.appliedFix.prNumber}
                            </a>
                          )}
                        </div>
                        <button
                          onClick={() => handleCopyForAutomation(activeRow)}
                          title="Copy this issue, then paste it into the AI Automation page to auto-generate a PR"
                          className="inline-flex items-center gap-1.5 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 border border-indigo-200 dark:border-indigo-900/50 bg-indigo-50 dark:bg-indigo-950/30 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                        >
                          <Copy className="w-3.5 h-3.5" /> Copy for AI Automation
                        </button>
                      </div>
                      <h3 className="text-xl font-extrabold text-slate-950 dark:text-white tracking-tight leading-snug">{activeRow.title}</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                        {PHASES[activeRow.phase].blurb}
                        {activeRow.effort
                          ? ` · Estimated effort: ${activeRow.effort}.`
                          : ' · Effort could not be estimated from this issue type.'}
                      </p>
                      <div className="flex items-center gap-2 text-xs font-mono bg-slate-50 dark:bg-slate-900/50 text-slate-600 dark:text-slate-400 border border-slate-100 dark:border-slate-800 px-3 py-1.5 rounded-lg w-fit max-w-full truncate">
                        <Globe className="text-slate-400 dark:text-slate-500 text-base flex-shrink-0" />
                        <span className="truncate">{activeRow.url}</span>
                      </div>
                    </div>

                    <div className="bg-indigo-50/30 dark:bg-indigo-950/20 p-5 rounded-xl border border-indigo-100/50 dark:border-indigo-900/40">
                      <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold mb-2.5 text-sm">
                        <Sparkle className="text-base" />
                        <h4>Audit Findings &amp; Analysis</h4>
                      </div>
                      <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed font-medium">{activeRow.analysis}</p>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                          <Lightbulb className="text-base text-amber-500" /> Resolution Blueprint &amp; Code Implementation
                        </h4>
                        <span
                          className={`text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded border ${fixDisplay.grounded
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900'
                              : 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                            }`}
                        >
                          {fixDisplay.label}
                        </span>
                      </div>
                      {activeRow.appliedFix?.prUrl && (
                        <a
                          href={activeRow.appliedFix.prUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="block text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                        >
                          View the pull request that carries this fix →
                        </a>
                      )}
                      <div className="rounded-xl overflow-hidden bg-slate-950 shadow-md border border-slate-900 flex flex-col">
                        <div className="flex items-center justify-between px-4 py-2 bg-slate-900 text-slate-400 text-xs font-mono border-b border-slate-900">
                          <span className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-red-500/80 inline-block" />
                            <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80 inline-block" />
                            <span className="w-2.5 h-2.5 rounded-full bg-green-500/80 inline-block" />
                            <span className="ml-1 text-slate-500 font-sans font-semibold">
                              {activeRow.appliedFix?.filePath || `${activeRow.category} fix`}
                            </span>
                          </span>
                          <button
                            onClick={() => handleCopy(activeRow, fixDisplay.code)}
                            className="hover:text-white transition-colors flex items-center gap-1.5 cursor-pointer font-sans font-bold"
                          >
                            <Copy className="text-xs" /> Copy Solution Code
                          </button>
                        </div>
                        <div className="p-4 overflow-x-auto font-mono text-xs text-indigo-200/90 leading-relaxed whitespace-pre bg-slate-950/95">
                          {fixDisplay.code}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-5 mt-auto">
                    <button
                      onClick={() => handleDismiss(activeRow)}
                      className="px-3.5 py-2 text-slate-500 dark:text-slate-400 font-bold hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 rounded-lg transition-colors flex items-center gap-2 text-xs"
                    >
                      <EyeSlash className="w-4 h-4" /> Hide From Feed
                    </button>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleRetest(activeRow)}
                        className="px-4 py-2 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-lg transition-colors text-xs flex items-center gap-1.5 shadow-sm"
                      >
                        <ArrowsCounterClockwise className="w-3.5 h-3.5" /> Re-test Endpoint
                      </button>
                      <button
                        onClick={() => handleResolveToggle(activeRow)}
                        className={`px-4 py-2 rounded-lg font-bold transition-all text-xs shadow-sm flex items-center gap-1.5 text-white ${activeRow.resolved ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-indigo-600 hover:bg-indigo-700'
                          }`}
                      >
                        <Check className="w-3.5 h-3.5" /> {activeRow.resolved ? 'Reopen Case' : 'Mark As Fixed'}
                      </button>
                    </div>
                  </div>
                </motion.div>
                );
              })() : (
                <div className="h-full w-full flex items-center justify-center text-slate-400 dark:text-slate-500 text-sm font-medium">
                  Select an issue to inspect it.
                </div>
              )}
            </AnimatePresence>
          </section>
        </div>
      )}
    </div>
  );
};
