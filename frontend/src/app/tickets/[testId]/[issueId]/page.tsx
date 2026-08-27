'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  Globe,
  Image as ImageIcon,
  UserPlus,
  Check,
  X,
  PaperPlaneRight,
  Lightbulb,
  Folder,
  Copy,
  ArrowsCounterClockwise,
} from '@phosphor-icons/react';
import { useQAData } from '../../../../context/QADataContext';
import { useToast } from '../../../../context/ToastContext';
import { useContent, getContent } from '../../../../context/ContentContext';
import { api } from '../../../../lib/api';
import { BackendTeamMember } from '../../../../lib/types';
import { buildIssueRows } from '../../../../lib/adapters';
import { getPhase, getEffort, PHASES, severityBadge } from '../../../../lib/phases';
import { getDynamicFixCode } from '../../../../lib/fixTemplates';
import { timeAgo, formatDate } from '../../../../lib/format';
import { initials } from '../../../../screens/IssuesPage';

interface LocatedFile {
  filePath: string | null;
  fileFullPath: string | null;
  line: number | null;
  grounded: boolean;
  aiSuggested: boolean;
  explanation: string | null;
}

export default function TicketPage() {
  const params = useParams<{ testId: string; issueId: string }>();
  const { tests, loading, updateIssue, assignIssue, assignIssueByEmail, addIssueComment, rerunTest } = useQAData();
  const { showToast } = useToast();

  const loadingText = useContent('ticket.loading', { text: 'Loading ticket…' });
  const notFoundText = useContent('ticket.notFound', { text: "This ticket couldn't be found — it may have been cleared by a new scan." });
  const backToDashboard = useContent('ticket.backToDashboard', { text: '← Back to dashboard' });
  const backToDashboardPlain = useContent('ticket.backToDashboardPlain', { text: 'Back to dashboard' });
  const formerTeamMember = useContent('ticket.formerTeamMember', { text: 'Former team member' });
  const retestLabel = useContent('ticket.retest', { text: 'Re-test' });
  const reopenLabel = useContent('ticket.reopen', { text: 'Reopen' });
  const markFixedLabel = useContent('ticket.markFixed', { text: 'Mark As Fixed' });
  const effortUnknownSuffix = useContent('ticket.effortUnknown', { text: ' · Effort could not be estimated from this issue type.' });
  const noScreenshotText = useContent('ticket.noScreenshot', { text: 'No screenshot was captured for this scan.' });
  const screenshotAlt = useContent('ticket.screenshotAlt', { text: 'Page screenshot at time of scan' });
  const problemDetailsHeading = useContent('ticket.problemDetails', { text: 'Problem Details' });
  const resolutionBlueprintHeading = useContent('ticket.resolutionBlueprint', { text: 'Resolution Blueprint & Code Implementation' });
  const goToFileLabel = useContent('ticket.goToFile', { text: 'Go to File' });
  const locatingFileLabel = useContent('ticket.locatingFile', { text: 'Locating file…' });
  const noSourceMatchedTooltip = useContent('ticket.noSourceMatched', { text: 'No local source file matched for this issue yet' });
  const copyForAutomationLabel = useContent('ticket.copyForAutomation', { text: 'Copy for AI Automation' });
  const copyForAutomationTooltip = useContent('ticket.copyForAutomationTooltip', { text: 'Copy this issue, then paste it into the AI Automation page to auto-generate a PR' });
  const viewPRLabel = useContent('ticket.viewPR', { text: 'View the pull request that carries this fix →' });
  const copySolutionLabel = useContent('ticket.copySolution', { text: 'Copy Solution Code' });
  const assignedToHeading = useContent('ticket.assignedTo', { text: 'Assigned To' });
  const closeLabel = useContent('ticket.close', { text: 'Close' });
  const assignLabel = useContent('ticket.assign', { text: 'Assign' });
  const unassignedText = useContent('ticket.unassigned', { text: 'Unassigned.' });
  const removeAssigneeTooltip = useContent('ticket.removeAssignee', { text: 'Remove assignee' });
  const assignEmailPlaceholder = useContent('ticket.emailPlaceholder', { text: "Paste a teammate's email…" });
  const assigningLabel = useContent('ticket.assigning', { text: 'Assigning…' });
  const noCommentsText = useContent('ticket.noComments', { text: 'No comments yet.' });
  const commentEmailPlaceholder = useContent('ticket.commentEmailPlaceholder', { text: 'Your email (shown next to your comment)…' });
  const commentPlaceholder = useContent('ticket.commentPlaceholder', { text: 'Add a comment…' });
  const addCommentTooltip = useContent('ticket.addComment', { text: 'Add comment' });

  const [teamMembers, setTeamMembers] = useState<BackendTeamMember[]>([]);
  const refreshTeamMembers = () => api.team.listMembers().then(setTeamMembers).catch(() => setTeamMembers([]));
  useEffect(() => {
    refreshTeamMembers();
  }, []);
  const memberById = useMemo(() => new Map(teamMembers.map((m) => [m.id, m])), [teamMembers]);

  const [assignOpen, setAssignOpen] = useState(false);
  const [assignEmail, setAssignEmail] = useState('');
  const [comment, setComment] = useState('');
  const [posting, setPosting] = useState(false);
  // Remembered locally (not tied to login) so a repeat commenter doesn't
  // have to retype their email every time on this device.
  const [commentEmail, setCommentEmail] = useState(() =>
    typeof window === 'undefined' ? '' : localStorage.getItem('qa_comment_email') || ''
  );

  const row = useMemo(() => {
    const rows = buildIssueRows(tests);
    return rows.find((r) => r.testId === params.testId && r.id === params.issueId) || null;
  }, [tests, params.testId, params.issueId]);

  const phase = row ? getPhase(row) : null;

  // Cheap, read-only file/line lookup (no LLM, no PR) so the ticket can point
  // at the real source location even before AI Automation runs — same
  // behavior the Issue Tracker's list cards use, just for this one issue.
  const [located, setLocated] = useState<LocatedFile | null>(null);
  useEffect(() => {
    if (!row || row.appliedFix) return;
    let cancelled = false;
    api
      .locateIssue(row.testId, row.id)
      .then((result) => {
        if (!cancelled) setLocated(result);
      })
      .catch(() => {
        if (!cancelled) setLocated({ filePath: null, fileFullPath: null, line: null, grounded: false, aiSuggested: false, explanation: null });
      });
    return () => {
      cancelled = true;
    };
  }, [row]);

  // The real applied patch when the AI Automation pipeline grounded and
  // (optionally) auto-applied one — falls back to the generic keyword-
  // matched template only when no real fix exists yet for this issue.
  const fixDisplay = useMemo(() => {
    if (!row) return null;
    const applied = row.appliedFix;
    if (applied) {
      const location = applied.filePath ? (applied.line ? `${applied.filePath}:${applied.line}` : applied.filePath) : null;
      const header = location
        ? `// ${location}${applied.autoFixable ? ' (applied)' : ' (suggested — review before applying)'}`
        : '// Guidance only — no exact source line matched in your repo';
      return {
        code: `${header}\n\n--- before\n${applied.original}\n\n+++ after\n${applied.patched}`,
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

    const location = located?.filePath ? (located.line ? `${located.filePath}:${located.line}` : located.filePath) : null;
    const header = !location
      ? '// Guidance only — no local repo linked, or no exact source line matched'
      : located?.aiSuggested
        ? `// ${location} (AI-suggested — not an exact match, verify before applying)`
        : `// ${location} (found in your local repo — review before applying)`;
    const explanationBlock = located?.aiSuggested && located.explanation ? `\n\n// What to change:\n// ${located.explanation}` : '';
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
  }, [row, located]);

  /** vscode://file/<absolute-path>:<line> opens VS Code desktop at the exact location, when registered as a URL handler. */
  const vscodeFileUrl = (fileFullPath: string | null, line: number | null) => {
    if (!fileFullPath) return null;
    const normalized = fileFullPath.replace(/\\/g, '/');
    const prefixed = normalized.startsWith('/') ? normalized : `/${normalized}`;
    return `vscode://file${prefixed}${line ? `:${line}` : ''}`;
  };

  const handleCopySolution = async () => {
    if (!row || !fixDisplay) return;
    const text =
      `[${row.severity.toUpperCase()}] ${row.title}\n` +
      `URL: ${row.url}\n\nAnalysis: ${row.analysis}\n\nCode Fix Snippet:\n${fixDisplay.code}`;
    try {
      await navigator.clipboard.writeText(text);
      showToast(getContent('ticket.toast.copiedFix', { text: 'Issue details and fix logic copied!' }).text, 'success');
    } catch {
      showToast(getContent('ticket.toast.clipboardUnavailable', { text: 'Clipboard unavailable — copy manually' }).text, 'error');
    }
  };

  // Copies a reference the AI Automation page's paste box can look up exactly
  // (testId+issueId), plus a human-readable summary as a fallback.
  const handleCopyForAutomation = async () => {
    if (!row) return;
    const text =
      `QA-ISSUE-REF testId=${row.testId} issueId=${row.id}\n` +
      `[${row.severity.toUpperCase()}] ${row.title}\n` +
      `URL: ${row.url}\n` +
      `Category: ${row.category}\n\n` +
      `Analysis: ${row.analysis}` +
      (row.suggestion ? `\n\nSuggestion: ${row.suggestion}` : '');
    try {
      await navigator.clipboard.writeText(text);
      showToast(getContent('ticket.toast.copiedForAutomation', { text: 'Issue copied — paste it into AI Automation to auto-generate a PR' }).text, 'success');
    } catch {
      showToast(getContent('ticket.toast.clipboardUnavailable', { text: 'Clipboard unavailable — copy manually' }).text, 'error');
    }
  };

  const handleRetest = async () => {
    if (!row) return;
    showToast(getContent('ticket.toast.retestTriggered', { text: 'Triggering a fresh scan for this site...' }).text, 'info');
    try {
      await rerunTest(row.testId);
    } catch (err) {
      showToast(err instanceof Error ? err.message : getContent('ticket.toast.retestFailed', { text: 'Could not start re-test' }).text, 'error');
    }
  };

  const handleToggleAssignee = async (memberId: string) => {
    if (!row) return;
    const current = row.assigneeIds;
    const next = current.includes(memberId) ? current.filter((id) => id !== memberId) : [...current, memberId];
    try {
      await assignIssue(row.testId, row.id, next);
      showToast(
        current.includes(memberId)
          ? getContent('ticket.toast.unassigned', { text: 'Unassigned' }).text
          : getContent('ticket.toast.assigned', { text: 'Assigned' }).text,
        'success'
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : getContent('ticket.toast.assignFailed', { text: 'Could not update assignment' }).text, 'error');
    }
  };

  const [assigningByEmail, setAssigningByEmail] = useState(false);

  // Assigns straight from an email — no team-admin rights needed. The
  // backend reuses the account if that email already exists, otherwise
  // creates a pending-invite stub so the ticket has a real assignee.
  const handleAssignByEmail = async () => {
    if (!row) return;
    const email = assignEmail.trim().toLowerCase();
    if (!email) return;

    setAssigningByEmail(true);
    try {
      await assignIssueByEmail(row.testId, row.id, email);
      showToast(getContent('ticket.toast.assignedToEmail', { text: 'Assigned to {email}' }, { email }).text, 'success');
      setAssignEmail('');
      refreshTeamMembers();
    } catch (err) {
      showToast(err instanceof Error ? err.message : getContent('ticket.toast.assignEmailFailed', { text: 'Could not assign that email' }).text, 'error');
    } finally {
      setAssigningByEmail(false);
    }
  };

  const handleResolveToggle = async () => {
    if (!row) return;
    try {
      await updateIssue(row.testId, row.id, !row.resolved);
      showToast(
        row.resolved
          ? getContent('ticket.toast.reopened', { text: 'Reopened' }).text
          : getContent('ticket.toast.markedResolved', { text: 'Marked as resolved' }).text,
        'success'
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : getContent('ticket.toast.resolveFailed', { text: 'Could not update issue' }).text, 'error');
    }
  };

  const handleAddComment = async () => {
    if (!row || !comment.trim()) return;
    const email = commentEmail.trim().toLowerCase();
    if (!email) {
      showToast(getContent('ticket.toast.needEmail', { text: 'Enter your email so others know who commented' }).text, 'error');
      return;
    }
    setPosting(true);
    try {
      await addIssueComment(row.testId, row.id, comment.trim(), email);
      localStorage.setItem('qa_comment_email', email);
      setComment('');
    } catch (err) {
      showToast(err instanceof Error ? err.message : getContent('ticket.toast.commentFailed', { text: 'Could not add comment' }).text, 'error');
    } finally {
      setPosting(false);
    }
  };

  if (loading && !row) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-400 text-sm font-medium">
        {loadingText.text}
      </div>
    );
  }

  if (!row) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-slate-50 dark:bg-slate-950 px-4 text-center">
        <p className="text-slate-500 dark:text-slate-400 font-medium">{notFoundText.text}</p>
        <Link href="/" className="text-blue-600 dark:text-blue-400 font-bold text-sm hover:underline">
          {backToDashboard.text}
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 mb-5">
          <ArrowLeft className="w-4 h-4" /> {backToDashboardPlain.text}
        </Link>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
          {/* Header band, colored by severity */}
          <div className={`px-6 py-5 border-b ${severityBadge[row.severity] || severityBadge.low}`}>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded border border-current/30 bg-white/40 dark:bg-black/20">
                  {getContent('ticket.severitySuffix', { text: '{severity} severity' }, { severity: row.severity }).text}
                </span>
                {phase !== null && (
                  <span className={`text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded border ${PHASES[phase].badge}`}>
                    {PHASES[phase].label}
                  </span>
                )}
                <span className="text-xs font-mono font-bold opacity-70">{row.repId}</span>
                {row.assigneeIds.length > 0 && (
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded border border-current/30 bg-white/40 dark:bg-black/20">
                    <UserPlus className="w-3 h-3" />
                    {row.assigneeIds
                      .map((id) => {
                        const m = memberById.get(id);
                        return m?.name || m?.email || formerTeamMember.text;
                      })
                      .join(', ')}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleRetest}
                  className="px-3.5 py-1.5 rounded-lg font-bold text-xs shadow-sm flex items-center gap-1.5 bg-white/60 dark:bg-black/25 hover:bg-white/80 dark:hover:bg-black/40 cursor-pointer"
                >
                  <ArrowsCounterClockwise className="w-3.5 h-3.5" /> {retestLabel.text}
                </button>
                <button
                  onClick={handleResolveToggle}
                  className={`px-3.5 py-1.5 rounded-lg font-bold text-xs shadow-sm flex items-center gap-1.5 text-white cursor-pointer ${
                    row.resolved ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  <Check className="w-3.5 h-3.5" /> {row.resolved ? reopenLabel.text : markFixedLabel.text}
                </button>
              </div>
            </div>
            <h1 className="text-xl font-extrabold text-slate-950 dark:text-white tracking-tight mt-3">{row.title}</h1>
            <p className="text-xs opacity-70 font-medium mt-1">
              {phase !== null ? PHASES[phase].blurb : ''}
              {getEffort(row.title)
                ? getContent('ticket.effortEstimated', { text: ' · Estimated effort: {effort}.' }, { effort: getEffort(row.title) ?? '' }).text
                : effortUnknownSuffix.text}
            </p>
            <div className="flex items-center gap-2 text-xs font-mono bg-white/50 dark:bg-black/20 px-3 py-1.5 rounded-lg w-fit max-w-full truncate mt-3">
              <Globe className="w-4 h-4 shrink-0 opacity-70" />
              <span className="truncate">{row.url}</span>
            </div>
          </div>

          {/* Image — real page screenshot from the scan, when captured */}
          <div className="bg-slate-100 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800">
            {row.screenshotPath ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={api.screenshotUrl(row.screenshotPath)} alt={screenshotAlt.text} className="w-full max-h-96 object-contain object-top mx-auto" />
            ) : (
              <div className="h-40 flex flex-col items-center justify-center gap-2 text-slate-400 dark:text-slate-600">
                <ImageIcon className="w-8 h-8" />
                <p className="text-xs font-medium">{noScreenshotText.text}</p>
              </div>
            )}
          </div>

          <div className="p-6 space-y-6">
            {/* Details */}
            <div>
              <h2 className="font-bold text-sm text-slate-900 dark:text-slate-100 mb-2">{problemDetailsHeading.text}</h2>
              <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{row.analysis}</p>
              {row.suggestion && (
                <div className="mt-3 flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300 bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/40 rounded-lg p-3">
                  <Lightbulb className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <span>{row.suggestion}</span>
                </div>
              )}
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-3">
                {getContent('ticket.categoryDetected', { text: 'Category: {category} · Detected {date}' }, { category: row.category, date: formatDate(row.detectedAt) }).text}
              </p>
            </div>

            {/* Resolution Blueprint & Code */}
            {fixDisplay && (
              <div className="border-t border-slate-100 dark:border-slate-800 pt-5">
                <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
                  <h2 className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <Lightbulb className="w-4 h-4 text-amber-500" /> {resolutionBlueprintHeading.text}
                  </h2>
                  <span
                    className={`text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded border ${
                      fixDisplay.grounded
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900'
                        : fixDisplay.aiSuggested
                          ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-900'
                          : 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                    }`}
                  >
                    {fixDisplay.label}
                  </span>
                </div>

                <div className="flex items-center gap-2 mb-3">
                  {(() => {
                    const editorUrl = vscodeFileUrl(fixDisplay.fileFullPath, fixDisplay.line);
                    const label = fixDisplay.filePath ? `${fixDisplay.filePath}${fixDisplay.line ? `:${fixDisplay.line}` : ''}` : null;
                    return (
                      <button
                        onClick={() => {
                          if (editorUrl) window.location.href = editorUrl;
                        }}
                        disabled={!editorUrl}
                        title={
                          editorUrl
                            ? getContent('ticket.openInVSCode', { text: 'Open {label} in VS Code' }, { label: label ?? '' }).text
                            : noSourceMatchedTooltip.text
                        }
                        className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-lg border transition-colors ${
                          editorUrl
                            ? 'text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 border-blue-200 dark:border-blue-900/50 bg-blue-50 dark:bg-blue-950/30 cursor-pointer'
                            : 'text-slate-400 dark:text-slate-600 border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/30 cursor-not-allowed'
                        }`}
                      >
                        <Folder className="w-3.5 h-3.5" /> {editorUrl ? goToFileLabel.text : locatingFileLabel.text}
                      </button>
                    );
                  })()}
                  <button
                    onClick={handleCopyForAutomation}
                    title={copyForAutomationTooltip.text}
                    className="inline-flex items-center gap-1.5 text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 border border-blue-200 dark:border-blue-900/50 bg-blue-50 dark:bg-blue-950/30 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" /> {copyForAutomationLabel.text}
                  </button>
                </div>

                {row.appliedFix?.prUrl && (
                  <a href={row.appliedFix.prUrl} target="_blank" rel="noreferrer" className="block text-xs text-blue-600 dark:text-blue-400 hover:underline mb-2">
                    {viewPRLabel.text}
                  </a>
                )}

                <div className="rounded-xl overflow-hidden bg-slate-950 shadow-md border border-slate-900 flex flex-col">
                  <div className="flex items-center justify-between px-4 py-2 bg-slate-900 text-slate-400 text-xs font-mono border-b border-slate-900">
                    <span className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-red-500/80 inline-block" />
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80 inline-block" />
                      <span className="w-2.5 h-2.5 rounded-full bg-green-500/80 inline-block" />
                      <span className="ml-1 text-slate-500 font-sans font-semibold">
                        {fixDisplay.filePath
                          ? `${fixDisplay.filePath}${fixDisplay.line ? `:${fixDisplay.line}` : ''}`
                          : getContent('ticket.categoryFix', { text: '{category} fix' }, { category: row.category }).text}
                      </span>
                    </span>
                    <button onClick={handleCopySolution} className="hover:text-white transition-colors flex items-center gap-1.5 cursor-pointer font-sans font-bold">
                      <Copy className="text-xs" /> {copySolutionLabel.text}
                    </button>
                  </div>
                  <div className="p-4 overflow-x-auto font-mono text-xs text-blue-200/90 leading-relaxed whitespace-pre bg-slate-950/95">
                    {fixDisplay.code}
                  </div>
                </div>
              </div>
            )}

            {/* Assign */}
            <div className="border-t border-slate-100 dark:border-slate-800 pt-5">
              <div className="flex items-center justify-between gap-2 mb-3">
                <h2 className="font-bold text-sm text-slate-900 dark:text-slate-100">{assignedToHeading.text}</h2>
                <button
                  onClick={() => {
                    setAssignOpen((v) => !v);
                    setAssignEmail('');
                  }}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 border border-blue-200 dark:border-blue-900/50 bg-blue-50 dark:bg-blue-950/30 px-2.5 py-1.5 rounded-lg cursor-pointer"
                >
                  {assignOpen ? <X className="w-3.5 h-3.5" /> : <UserPlus className="w-3.5 h-3.5" />}
                  {assignOpen ? closeLabel.text : assignLabel.text}
                </button>
              </div>

              {row.assigneeIds.length === 0 && !assignOpen && (
                <p className="text-sm text-slate-400 dark:text-slate-500">{unassignedText.text}</p>
              )}
              {row.assigneeIds.length > 0 && (
                <ul className="flex flex-wrap gap-2 mb-1">
                  {row.assigneeIds.map((id) => {
                    const m = memberById.get(id);
                    return (
                      <li key={id} className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-full pl-1 pr-1.5 py-1">
                        <span className="w-6 h-6 rounded-full bg-blue-500 text-white text-[10px] font-bold flex items-center justify-center">
                          {initials(m?.name, m?.email || '?')}
                        </span>
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{m?.name || m?.email || formerTeamMember.text}</span>
                        <button
                          onClick={() => handleToggleAssignee(id)}
                          title={removeAssigneeTooltip.text}
                          className="w-4 h-4 rounded-full flex items-center justify-center text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer shrink-0"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}

              {assignOpen && (
                <div className="mt-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="email"
                      value={assignEmail}
                      onChange={(e) => setAssignEmail(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && assignEmail.trim() && !assigningByEmail) handleAssignByEmail();
                      }}
                      placeholder={assignEmailPlaceholder.text}
                      autoFocus
                      className="flex-1 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-950 text-slate-800 dark:text-white focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500"
                    />
                    <button
                      onClick={handleAssignByEmail}
                      disabled={!assignEmail.trim() || assigningByEmail}
                      className="shrink-0 px-3.5 py-2 rounded-lg font-bold text-xs text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 dark:disabled:bg-blue-900 cursor-pointer"
                    >
                      {assigningByEmail ? assigningLabel.text : assignLabel.text}
                    </button>
                  </div>

                  {teamMembers.length > 0 && (
                    <div className="mt-3 border border-slate-200 dark:border-slate-700 rounded-lg divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
                      {teamMembers.map((m) => {
                        const isAssigned = row.assigneeIds.includes(m.id);
                        return (
                          <button
                            key={m.id}
                            onClick={() => handleToggleAssignee(m.id)}
                            className={`w-full flex items-center gap-2.5 px-3 py-2 text-left cursor-pointer transition-colors ${
                              isAssigned ? 'bg-blue-50 dark:bg-blue-950/40' : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
                            }`}
                          >
                            <span className="w-7 h-7 rounded-full bg-blue-500 text-white text-xs font-bold flex items-center justify-center shrink-0">
                              {initials(m.name, m.email)}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">{m.name || m.email}</p>
                              <p className="text-xs text-slate-400 dark:text-slate-500 truncate">{m.email} · {m.role}</p>
                            </div>
                            {isAssigned && <Check className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Comments */}
            <div className="border-t border-slate-100 dark:border-slate-800 pt-5">
              <h2 className="font-bold text-sm text-slate-900 dark:text-slate-100 mb-3">
                {getContent('ticket.commentsHeading', { text: 'Comments ({count})' }, { count: row.comments.length }).text}
              </h2>
              <div className="space-y-4 mb-4">
                {row.comments.length === 0 && <p className="text-sm text-slate-400 dark:text-slate-500">{noCommentsText.text}</p>}
                {row.comments.map((c) => (
                  <div key={c.id} className="flex items-start gap-2.5">
                    <span className="w-7 h-7 rounded-full bg-slate-400 dark:bg-slate-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
                      {initials(c.authorName, '?')}
                    </span>
                    <div className="min-w-0 flex-1 bg-slate-50 dark:bg-slate-800/60 rounded-lg px-3.5 py-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{c.authorName}</span>
                          {c.authorEmail && c.authorEmail !== c.authorName && (
                            <span className="text-[11px] text-slate-400 dark:text-slate-500 ml-1.5">{c.authorEmail}</span>
                          )}
                        </div>
                        <span className="text-[11px] text-slate-400 dark:text-slate-500 shrink-0">{timeAgo(c.createdAt)}</span>
                      </div>
                      <p className="text-sm text-slate-700 dark:text-slate-300 mt-0.5 whitespace-pre-wrap wrap-break-word">{c.text}</p>
                    </div>
                  </div>
                ))}
              </div>

              <input
                type="email"
                value={commentEmail}
                onChange={(e) => setCommentEmail(e.target.value)}
                placeholder={commentEmailPlaceholder.text}
                className="w-full mb-2 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-950 text-slate-800 dark:text-white focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500"
              />
              <div className="flex items-start gap-2.5">
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder={commentPlaceholder.text}
                  rows={2}
                  className="flex-1 resize-none border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-950 text-slate-800 dark:text-white focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500"
                />
                <button
                  onClick={handleAddComment}
                  disabled={posting || !comment.trim() || !commentEmail.trim()}
                  className="shrink-0 p-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 dark:disabled:bg-blue-900 text-white cursor-pointer"
                  title={addCommentTooltip.text}
                >
                  <PaperPlaneRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
