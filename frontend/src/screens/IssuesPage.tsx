

'use client';
import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bug,
  MagnifyingGlass,
  Folder,
  ListChecks,
  ArrowSquareOut,
  Image as ImageIcon,
  Ticket,
  DownloadSimple,
  FilePdf,
  FileCsv,
  FileDoc,
  UsersThree,
} from '@phosphor-icons/react';
import { useQAData } from '../context/QADataContext';
import { useToast } from '../context/ToastContext';
import { buildIssueRows, IssueRow } from '../lib/adapters';
import { EmptyState } from '../components/ui/EmptyState';
import { Skeleton } from '../components/ui/Skeleton';
import { getPhase, getEffort, PHASES, PHASE_ORDER, PhaseId, severityBadge, severityBorder } from '../lib/phases';
import { getDynamicFixCode } from '../lib/fixTemplates'; // <- move your 200-line
import { api } from '../lib/api';
import { BackendTeamMember } from '../lib/types';
import {
  exportTicketListCSV,
  exportTicketListPDF,
  exportTicketListDocx,
  exportAssignedTicketsXLSX,
  TicketExportRow,
  AssignedTicketExportRow,
} from '../lib/exportReport';

/** Parse once, not on every render pass of every filter. */
const hostOf = (url: string): string => {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
};

export const initials = (name: string | null | undefined, fallback: string): string => {
  const source = (name || fallback).trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return source.slice(0, 2).toUpperCase();
};

type PhaseFilter = 'all' | PhaseId;

export const IssuesPage: React.FC = () => {
  const { tests, loading } = useQAData();

  // Team members, for showing who an issue is assigned to (assignment
  // itself only happens on the dedicated ticket page).
  const [teamMembers, setTeamMembers] = useState<BackendTeamMember[]>([]);
  useEffect(() => {
    api.team.listMembers().then(setTeamMembers).catch(() => setTeamMembers([]));
  }, []);
  const memberById = useMemo(() => new Map(teamMembers.map((m) => [m.id, m])), [teamMembers]);

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
  // Cheap, read-only file/line lookups (no LLM, no PR) so the detail panel
  // can point at the real source location even before AI Automation runs.
  // `aiSuggested` means the exact-match locator found nothing and an LLM
  // (when enabled) picked the file instead — shown with a distinct, less
  // certain label so it's never confused with a grounded, verified match.
  const [locatedByKey, setLocatedByKey] = useState<
    Record<
      string,
      {
        filePath: string | null;
        fileFullPath: string | null;
        line: number | null;
        grounded: boolean;
        aiSuggested: boolean;
        explanation: string | null;
      }
    >
  >({});

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
        if (selectedWebsite !== 'all' && row.host !== selectedWebsite) return false;
        if (selectedPhase !== 'all' && row.phase !== selectedPhase) return false;
        return true;
      }),
    [allRows, selectedWebsite, selectedPhase]
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

  // Resolve the real source file/line for EVERY currently visible issue (not
  // just the selected one) so each card in the list can show its own
  // "Go to File" button, not only the detail panel. Bounded to a few
  // in-flight lookups at once so a big list doesn't fire off dozens of
  // Gemini-backed locate calls simultaneously; already-cached keys (or ones
  // with a grounded appliedFix from a real PR) are skipped.
  useEffect(() => {
    const pending = visibleRows.filter((r) => !r.appliedFix && !(rowKey(r) in locatedByKey));
    if (!pending.length) return;

    let cancelled = false;
    const CONCURRENCY = 3;
    let nextIndex = 0;

    const resolveOne = async (row: (typeof pending)[number]) => {
      const key = rowKey(row);
      try {
        const result = await api.locateIssue(row.testId, row.id);
        if (cancelled) return;
        setLocatedByKey((prev) =>
          key in prev
            ? prev
            : {
              ...prev,
              [key]: {
                filePath: result.filePath,
                fileFullPath: result.fileFullPath,
                line: result.line,
                grounded: result.grounded,
                aiSuggested: result.aiSuggested,
                explanation: result.explanation,
              },
            }
        );
      } catch {
        if (cancelled) return;
        setLocatedByKey((prev) =>
          key in prev
            ? prev
            : { ...prev, [key]: { filePath: null, fileFullPath: null, line: null, grounded: false, aiSuggested: false, explanation: null } }
        );
      }
    };

    const worker = async () => {
      while (!cancelled) {
        const i = nextIndex++;
        if (i >= pending.length) return;
        await resolveOne(pending[i]);
      }
    };

    Array.from({ length: Math.min(CONCURRENCY, pending.length) }, () => worker());

    return () => {
      cancelled = true;
    };
  }, [visibleRows, locatedByKey]);

  // ---- handlers ------------------------------------------------------------
  // The real applied patch when the AI Automation pipeline grounded and
  // (optionally) auto-applied one — falls back to the generic keyword-
  // matched template only when no real fix exists yet for this issue.
  const getFixDisplay = (row: Row) => {
    const applied = row.appliedFix;
    if (applied) {
      const location = applied.filePath
        ? applied.line
          ? `${applied.filePath}:${applied.line}`
          : applied.filePath
        : null;
      const header = location
        ? `// ${location}${applied.autoFixable ? ' (applied)' : ' (suggested — review before applying)'}`
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
        aiSuggested: false,
        filePath: applied.filePath,
        fileFullPath: applied.fileFullPath ?? null,
        line: applied.line ?? null,
      };
    }

    // No real applied fix yet — fall back to the cheap, read-only file/line
    // lookup (locatedByKey) so we can still point at the exact source file,
    // even before the user runs the full AI Automation pipeline. When exact
    // matching found nothing, this may instead be an AI *guess* — kept
    // visually and textually distinct from a grounded/exact match so it's
    // never mistaken for a verified location.
    const located = locatedByKey[rowKey(row)];
    const location = located?.filePath
      ? located.line
        ? `${located.filePath}:${located.line}`
        : located.filePath
      : null;
    const header = !location
      ? '// Guidance only — no local repo linked, or no exact source line matched'
      : located?.aiSuggested
        ? `// ${location} (AI-suggested — not an exact match, verify before applying)`
        : `// ${location} (found in your local repo — review before applying)`;
    const explanationBlock = located?.aiSuggested && located.explanation
      ? `\n\n// What to change:\n// ${located.explanation}`
      : '';
    return {
      code: `${header}${explanationBlock}\n\n${getDynamicFixCode(row.title)}`,
      label: !location
        ? 'Generic guidance — run AI Automation on this scan for a fix grounded in your repo'
        : located?.aiSuggested
          ? 'AI-suggested location — not exact, verify before applying'
          : 'File located in your repo — run AI Automation for a grounded patch',
      grounded: false,
      aiSuggested: Boolean(located?.aiSuggested),
      filePath: located?.filePath ?? null,
      fileFullPath: located?.fileFullPath ?? null,
      line: located?.line ?? null,
    };
  };

  /** vscode://file/<absolute-path>:<line> opens VS Code desktop at the exact location, when registered as a URL handler. */
  const vscodeFileUrl = (fileFullPath: string | null, line: number | null) => {
    if (!fileFullPath) return null;
    const normalized = fileFullPath.replace(/\\/g, '/');
    const prefixed = normalized.startsWith('/') ? normalized : `/${normalized}`;
    return `vscode://file${prefixed}${line ? `:${line}` : ''}`;
  };

  return (
    <div className="space-y-6 w-full max-w-[1600px] mx-auto px-4 py-2">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
            <Bug className="text-blue-600 w-7 h-7" /> Issue Tracker
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {selectedPhase === 'all'
              ? 'Issues ordered by remediation phase — work top to bottom.'
              : PHASES[selectedPhase].blurb}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* PHASE DROPDOWN */}
          <div className="relative flex items-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm focus-within:ring-4 focus-within:ring-blue-500/10 transition-all px-3">
            <ListChecks className="text-blue-500 w-4 h-4 mr-2" />
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
          <div className="relative flex items-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm focus-within:ring-4 focus-within:ring-blue-500/10 transition-all px-3">
            <Folder className="text-blue-500 w-4 h-4 mr-2" />
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
              className="pl-9 pr-4 py-2 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 text-sm w-full sm:w-64 bg-white dark:bg-slate-950 dark:text-white transition-all shadow-sm"
            />
          </div>

          <AssignedTicketsButton rows={allRows} memberById={memberById} />
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
                          } transition-all ${isSelected ? 'bg-blue-50/40 shadow-sm dark:bg-blue-950/30' : 'hover:bg-slate-50/60 dark:hover:bg-slate-800/40'}`}
                      >
                        <div className="flex gap-3.5">
                          {/* Ticket thumbnail — the real page screenshot from the
                              scan this issue came from, when one was captured. */}
                          <div className="w-16 h-16 shrink-0 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-900 flex items-center justify-center">
                            {row.screenshotPath ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={api.screenshotUrl(row.screenshotPath)} alt="" className="w-full h-full object-cover object-top" />
                            ) : (
                              <ImageIcon className="w-5 h-5 text-slate-300 dark:text-slate-600" />
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
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
                            <div className="flex items-start justify-between gap-2 mt-2.5">
                              <h4 className={`font-bold text-slate-900 dark:text-slate-100 text-sm leading-snug tracking-tight ${row.resolved ? 'line-through text-slate-400 dark:text-slate-500' : ''}`}>
                                {row.title}
                              </h4>
                              <a
                                href={`/tickets/${row.testId}/${row.id}`}
                                target="_blank"
                                rel="noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                title="Open this ticket in a new tab"
                                className="shrink-0 inline-flex items-center gap-1 text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 border border-blue-200 dark:border-blue-900/50 bg-blue-50 dark:bg-blue-950/30 px-2 py-1 rounded-lg cursor-pointer"
                              >
                                Open Ticket <ArrowSquareOut className="w-3 h-3" />
                              </a>
                            </div>
                            <div className="flex items-center gap-2 mt-2 text-[11px] font-medium text-slate-500 dark:text-slate-400 flex-wrap">
                              <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-600 dark:text-slate-400">{row.category}</span>
                              <span>•</span>
                              <span className="text-slate-400 dark:text-slate-500">{row.effort ? `${row.effort} effort` : 'effort unknown'}</span>
                              <span>•</span>
                              <span className="truncate max-w-35 font-mono text-slate-400 dark:text-slate-500">{row.host}</span>
                              {row.assigneeIds.length > 0 && (
                                <span className="flex items-center -space-x-1.5 ml-auto">
                                  {row.assigneeIds.slice(0, 3).map((id) => {
                                    const m = memberById.get(id);
                                    return (
                                      <span
                                        key={id}
                                        title={m?.name || m?.email || id}
                                        className="w-5 h-5 rounded-full bg-blue-500 text-white text-[9px] font-bold flex items-center justify-center border-2 border-white dark:border-slate-900"
                                      >
                                        {initials(m?.name, m?.email || '?')}
                                      </span>
                                    );
                                  })}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        {(() => {
                          const rowFix = getFixDisplay(row);
                          const rowEditorUrl = vscodeFileUrl(rowFix.fileFullPath, rowFix.line);
                          const rowLabel = rowFix.filePath
                            ? `${rowFix.filePath}${rowFix.line ? `:${rowFix.line}` : ''}`
                            : null;
                          const stillLocating = !row.appliedFix && !(key in locatedByKey);
                          return (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (rowEditorUrl) window.location.href = rowEditorUrl;
                              }}
                              disabled={!rowEditorUrl}
                              title={rowEditorUrl ? `Open ${rowLabel} in VS Code` : 'No local source file matched for this issue yet'}
                              className={`mt-3 inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-lg border transition-colors max-w-full ${rowEditorUrl
                                  ? 'text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 border-blue-200 dark:border-blue-900/50 bg-blue-50 dark:bg-blue-950/30 cursor-pointer'
                                  : 'text-slate-400 dark:text-slate-600 border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/30 cursor-not-allowed'
                                }`}
                            >
                              <Folder className="w-3.5 h-3.5 shrink-0" />
                              <span className="truncate">
                                {rowEditorUrl ? rowLabel : stillLocating ? 'Locating file…' : 'No matching file found'}
                              </span>
                            </button>
                          );
                        })()}
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

          <section className="hidden lg:flex lg:w-7/12 flex-col bg-white dark:bg-slate-800 overflow-y-auto">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between sticky top-0 bg-white dark:bg-slate-800 z-10 gap-3">
              <div className="min-w-0">
                <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm flex items-center gap-2 truncate">
                  <Ticket className="w-4 h-4 text-blue-500 shrink-0" />
                  Tickets — {selectedWebsite === 'all' ? 'All Scanned Sites' : selectedWebsite}
                </h3>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                  {visibleRows.length} ticket{visibleRows.length === 1 ? '' : 's'} in this view
                </p>
              </div>
              <TicketDownloadMenu
                rows={visibleRows}
                scopeLabel={selectedWebsite === 'all' ? 'All Sites' : selectedWebsite}
                memberById={memberById}
              />
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
              {visibleRows.length === 0 && (
                <div className="p-12 text-center text-sm font-medium text-slate-400 dark:text-slate-500">
                  No tickets match the current filters.
                </div>
              )}
              {visibleRows.map((row) => (
                <a
                  key={rowKey(row)}
                  href={`/tickets/${row.testId}/${row.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-3 px-6 py-3 hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors"
                >
                  <span className="text-xs font-mono text-slate-400 dark:text-slate-500 shrink-0 w-28 truncate">{row.repId}</span>
                  <span className={`text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded border shrink-0 ${severityBadge[row.severity] || severityBadge.low}`}>
                    {row.severity}
                  </span>
                  <span className={`text-sm font-semibold text-slate-800 dark:text-slate-200 truncate flex-1 ${row.resolved ? 'line-through text-slate-400 dark:text-slate-500' : ''}`}>
                    {row.title}
                  </span>
                  <ArrowSquareOut className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 shrink-0" />
                </a>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
};

/** One-click Excel export of every currently-assigned ticket — description, source line, and who owns it — across all sites, regardless of the phase/site filters above. */
const AssignedTicketsButton: React.FC<{
  rows: (IssueRow & { host: string })[];
  memberById: Map<string, BackendTeamMember>;
}> = ({ rows, memberById }) => {
  const { showToast } = useToast();
  const assignedRows = rows.filter((r) => r.assigneeIds.length > 0);

  const handleClick = async () => {
    if (assignedRows.length === 0) {
      showToast('No tickets are assigned yet', 'info');
      return;
    }
    let sNo = 0;
    const origin = window.location.origin;
    const exportRows: AssignedTicketExportRow[] = assignedRows.flatMap((r) =>
      r.assigneeIds.map((id) => ({
        sNo: ++sNo,
        website: r.host,
        repId: r.repId,
        ticketUrl: `${origin}/tickets/${r.testId}/${r.id}`,
        title: r.title,
        assignedTo: memberById.get(id)?.name || memberById.get(id)?.email || 'Unknown',
        severity: r.severity,
        status: r.resolved ? 'Resolved' : 'Open',
      }))
    );
    // Per-ticket (not per-assignee) so a ticket with 2 assignees isn't
    // double-counted in the priority pie chart.
    const priorityCounts: Record<string, number> = {};
    assignedRows.forEach((r) => {
      priorityCounts[r.severity] = (priorityCounts[r.severity] || 0) + 1;
    });
    try {
      await exportAssignedTicketsXLSX(exportRows, priorityCounts, 'All Sites');
    } catch {
      showToast('Could not export assigned tickets', 'error');
    }
  };

  return (
    <button
      onClick={handleClick}
      className="flex items-center gap-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 px-3 py-2 rounded-lg transition-colors cursor-pointer shadow-sm"
      title="Export a Bug Tracker Dashboard (.xlsx) of every assigned ticket, with a priority summary and charts"
    >
      <UsersThree className="w-4 h-4" /> Assigned Tickets
    </button>
  );
};

/** Download the current ticket list as PDF, Excel-compatible CSV, or Word — mirrors the DownloadMenu pattern already used for full scan reports (Phase2ResultsPage). */
const TicketDownloadMenu: React.FC<{
  rows: (IssueRow & { host: string })[];
  scopeLabel: string;
  memberById: Map<string, BackendTeamMember>;
}> = ({ rows, scopeLabel, memberById }) => {
  const [open, setOpen] = useState(false);
  const { showToast } = useToast();
  const menuRef = React.useRef<HTMLDivElement>(null);

  const exportRows: TicketExportRow[] = rows.map((r) => ({
    repId: r.repId,
    title: r.title,
    severity: r.severity,
    category: r.category,
    status: r.resolved ? 'Resolved' : 'Open',
    assignees: r.assigneeIds.length
      ? r.assigneeIds.map((id) => memberById.get(id)?.name || memberById.get(id)?.email || 'Unknown').join(', ')
      : 'Unassigned',
    url: r.url,
  }));

  const handle = async (fn: () => void | Promise<void>, label: string) => {
    try {
      await fn();
      setOpen(false);
    } catch {
      showToast(`Could not export ${label}`, 'error');
    }
  };

  return (
    <div className="relative shrink-0" ref={menuRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={rows.length === 0}
        className="flex items-center gap-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 dark:disabled:bg-blue-900 px-3 py-2 rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed"
      >
        <DownloadSimple className="w-4 h-4" /> Download
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-44 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-20 overflow-hidden">
            <button
              onClick={() => handle(() => exportTicketListPDF(exportRows, scopeLabel), 'PDF')}
              className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-slate-700 dark:text-slate-300 hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-600 dark:hover:text-red-400 transition-colors cursor-pointer"
            >
              <FilePdf className="w-4 h-4 text-red-500" /> PDF
            </button>
            <button
              onClick={() => handle(() => exportTicketListCSV(exportRows, scopeLabel), 'Excel')}
              className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-slate-700 dark:text-slate-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors border-t border-slate-100 dark:border-slate-800 cursor-pointer"
            >
              <FileCsv className="w-4 h-4 text-emerald-600" /> Excel (.csv)
            </button>
            <button
              onClick={() => handle(() => exportTicketListDocx(exportRows, scopeLabel), 'Word')}
              className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-slate-700 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-950/30 hover:text-blue-600 dark:hover:text-blue-400 transition-colors border-t border-slate-100 dark:border-slate-800 cursor-pointer"
            >
              <FileDoc className="w-4 h-4 text-blue-600" /> Word (.docx)
            </button>
          </div>
        </>
      )}
    </div>
  );
};
