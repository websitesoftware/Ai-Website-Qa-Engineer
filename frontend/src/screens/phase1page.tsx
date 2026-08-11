'use client';

import React, { useMemo, useRef, useState } from 'react';
import { api } from '../lib/api';
import { fetchLogoAsset, fitLogoBox } from '../lib/exportReport';
import { useQAData } from '../context/QADataContext';
import { BackendTest } from '../lib/types';
import { EmptyState } from '../components/ui/EmptyState';
import { Skeleton } from '../components/ui/Skeleton';

// --- Types ---
interface StatCardProps {
  label: string;
  value: string | number;
  subtext: string;
  subType?: 'up' | 'down' | 'neutral';
}

interface GaugeProps {
  label: string;
  value: number;
  color: string;
}

interface IssueRowProps {
  title: string;
  fix: string;
  category: string;
  severity: 'high' | 'med' | 'low';
}

function formatDuration(startedAt: string | null, completedAt: string | null): string {
  if (!startedAt) return '-';
  const end = completedAt ? new Date(completedAt).getTime() : Date.now();
  const totalSec = Math.max(0, Math.floor((end - new Date(startedAt).getTime()) / 1000));
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return min > 0 ? `${min}m ${sec}s` : `${sec}s`;
}

export default function ScanlinePhase1Report() {
  const { tests, loading } = useQAData();
  const [isExporting, setIsExporting] = useState(false);

  const reportRef = useRef<HTMLDivElement>(null);

  const test: BackendTest | null = useMemo(
    () =>
      [...tests].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] || null,
    [tests]
  );

  if (loading && !test) {
    return <Skeleton className="h-[70vh] rounded-xl" />;
  }

  if (!test) {
    return (
      <EmptyState
        icon="ph-sparkle"
        title="No scans yet"
        description="Run a new test to see the Phase 1 foundation report here."
      />
    );
  }

  const isScanning = test.status === 'queued' || test.status === 'running';
  const pagesCrawled = test.pagesScanned;
  const issuesFound = test.issues.length;
  const brokenLinks = test.brokenLinks;
  const consoleErrors = test.consoleErrors;
  const scores = test.scores;
  const avgLighthouse = [scores.performance, scores.accessibility, scores.seo, scores.bestPractices]
    .filter((v): v is number => v != null)
    .reduce((sum, v, _i, arr) => sum + v / arr.length, 0);

  /**
   * BLOCK-AWARE PDF EXPORT
   *
   * Old approach: render the WHOLE page as one tall PNG, then chop it every
   * 297mm. jsPDF has no idea it's slicing through the middle of a card — that's
   * exactly why "Pricing table overflows viewport" got split across two pages.
   *
   * This version captures each [data-pdf-block] separately and flows them onto
   * pages. If a block doesn't fit in the space left on the current page, the
   * WHOLE block moves to the next page. Cards never get cut in half.
   *
   * Requires: npm i jspdf html2canvas-pro
   * (html2canvas-pro, NOT html2canvas — the original crashes on Tailwind's oklch())
   */
  const handleDownloadPDF = async () => {
    if (!reportRef.current || isExporting) return;
    setIsExporting(true);

    try {
      const [{ default: html2canvas }, { jsPDF }, branding] = await Promise.all([
        import('html2canvas-pro'),
        import('jspdf'),
        api.branding.get().catch(() => null),
      ]);
      const logo = branding ? await fetchLogoAsset(branding.logoUrl) : null;

      const pdf = new jsPDF('p', 'mm', 'a4');
      const PAGE_W = pdf.internal.pageSize.getWidth();   // 210mm
      const PAGE_H = pdf.internal.pageSize.getHeight();  // 297mm
      const MARGIN = 10;
      const USABLE_W = PAGE_W - MARGIN * 2;
      const USABLE_H = PAGE_H - MARGIN * 2;
      const GAP = 4; // mm between blocks

      const blocks = Array.from(
        reportRef.current.querySelectorAll<HTMLElement>('[data-pdf-block]')
      );

      if (blocks.length === 0) {
        throw new Error('No [data-pdf-block] elements found.');
      }

      // White-label header — logo + header text reserved at the top of
      // page 1 only, above the captured report blocks.
      const HEADER_H = branding ? 16 : 0;
      if (branding) {
        let textX = MARGIN;
        if (logo) {
          const { w, h } = fitLogoBox(logo, 20, 12);
          pdf.addImage(logo.dataUrl, logo.type.toUpperCase(), MARGIN, MARGIN, w, h);
          textX = MARGIN + w + 4;
        }
        pdf.setFontSize(branding.headerFontSize);
        const [r, g, b] = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i
          .exec(branding.primaryColor)
          ?.slice(1)
          .map((c) => parseInt(c, 16)) ?? [79, 70, 229];
        pdf.setTextColor(r, g, b);
        pdf.text(branding.headerText, textX, MARGIN + 7);
      }

      let cursorY = MARGIN + HEADER_H; // vertical position on the current page (mm)
      let pageIsEmpty = true;

      for (const block of blocks) {
        const canvas = await html2canvas(block, {
          scale: 2,
          backgroundColor: '#ffffff',
          useCORS: true,
        });

        const imgData = canvas.toDataURL('image/png');
        const imgH = (canvas.height * USABLE_W) / canvas.width; // mm

        // CASE A: block is taller than a full page — has to be sliced,
        // but at least it starts on a clean page.
        if (imgH > USABLE_H) {
          if (!pageIsEmpty) {
            pdf.addPage();
            cursorY = MARGIN;
          }

          let remaining = imgH;
          let offset = 0;

          while (remaining > 0) {
            pdf.addImage(imgData, 'PNG', MARGIN, MARGIN - offset, USABLE_W, imgH);
            remaining -= USABLE_H;
            offset += USABLE_H;
            if (remaining > 0) pdf.addPage();
          }

          pdf.addPage();          // next block starts fresh
          cursorY = MARGIN;
          pageIsEmpty = true;
          continue;
        }

        // CASE B: doesn't fit in what's left of this page -> push whole block down
        if (!pageIsEmpty && cursorY + imgH > PAGE_H - MARGIN) {
          pdf.addPage();
          cursorY = MARGIN;
          pageIsEmpty = true;
        }

        pdf.addImage(imgData, 'PNG', MARGIN, cursorY, USABLE_W, imgH);
        cursorY += imgH + GAP;
        pageIsEmpty = false;
      }

      // Kill a trailing blank page if Case A left one behind
      const totalPages = pdf.getNumberOfPages();
      if (pageIsEmpty && totalPages > 1) {
        pdf.deletePage(totalPages);
      }

      // White-label stamp — same footer text every export in the tool uses
      // (see Settings → White-label Reports), applied on every page.
      if (branding?.footerText) {
        const pageCount = pdf.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
          pdf.setPage(i);
          pdf.setFontSize(8);
          pdf.setTextColor(150);
          pdf.text(branding.footerText, MARGIN, PAGE_H - 5);
        }
      }

      const domain = test.url.replace(/^https?:\/\//, '').replace(/\/$/, '').replace(/[^a-zA-Z0-9.-]/g, '_');
      const dateStamp = new Date(test.createdAt).toISOString().slice(0, 10);
      pdf.save(`Scanline_Report_${domain}_${dateStamp}.pdf`);
    } catch (err) {
      console.error('[Scanline] PDF export failed:', err);
      alert('PDF export failed. Check the console for details.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="text-slate-800 dark:text-slate-200 font-sans selection:bg-purple-500 selection:text-white antialiased">

      {/* ===== Report header (outside reportRef, so never in the PDF) ===== */}
      <header className="mb-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9.5 h-9.5 rounded-xl bg-gradient-to-br from-[#7C5CFC] to-[#5B3FE0] shadow-md shadow-purple-500/35 flex items-center justify-center">
              <i className="ph ph-sparkle text-white text-lg"></i>
            </div>
            <div>
              <div className="font-display font-bold text-slate-900 dark:text-slate-100 text-base tracking-tight">Scanline</div>
              <div className="text-[11.5px] text-slate-500 dark:text-slate-400">AI QA Engineer — Phase 1</div>
            </div>
          </div>

          <div className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[11.5px] font-bold transition-colors ${isScanning
            ? 'bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400'
            : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
            }`}>
            <span className={`w-1.75 h-1.75 rounded-full ${isScanning ? 'bg-orange-500 animate-pulse' : 'bg-emerald-500'}`} />
            {isScanning ? 'SCANNING SYSTEM...' : 'SCAN COMPLETE'}
          </div>
        </div>
      </header>

      {/* ===== MAIN — export scans this subtree for [data-pdf-block] ===== */}
      <main ref={reportRef}>

        {/* BLOCK 1: run metadata */}
        <div
          data-pdf-block
          className="flex flex-wrap gap-x-6 gap-y-2 items-baseline mb-6 font-mono text-sm border-b border-slate-200/70 dark:border-slate-800 pb-4"
        >
          <div className="text-[#1C56C9] dark:text-blue-400 font-semibold">scan → {test.url}</div>
          <div className="text-slate-500 dark:text-slate-400 text-xs"><b>{pagesCrawled}</b> pages crawled</div>
          <div className="text-slate-500 dark:text-slate-400 text-xs"><b>{formatDuration(test.startedAt, test.completedAt)}</b> duration</div>
          <div className="text-slate-500 dark:text-slate-400 text-xs ml-auto">run <b>#{test.id.slice(-4)}</b> · {new Date(test.createdAt).toLocaleString('en-US', { month: 'short', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
        </div>

        {/* BLOCK 2: stat cards */}
        <div
          data-pdf-block
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8"
        >
          <StatCard
            label="Pages Crawled"
            value={pagesCrawled}
            subtext={isScanning ? 'Crawling map tree...' : `${test.screenshots.filter((s) => s.error).length} unreachable`}
          />
          <StatCard
            label="Issues Found"
            value={issuesFound}
            subtext={`${test.issues.filter((i) => i.severity === 'critical' || i.severity === 'high').length} high/critical`}
            subType={issuesFound > 0 ? 'down' : 'neutral'}
          />
          <StatCard
            label="Broken Links"
            value={brokenLinks.length}
            subtext={`${brokenLinks.filter((b) => b.statusCode >= 500).length} are 500s`}
          />
          <StatCard
            label="Avg Lighthouse"
            value={isScanning ? '--' : Math.round(avgLighthouse)}
            subtext={scores.performance != null ? `Performance: ${scores.performance}` : 'Pending'}
            subType="up"
          />
        </div>

        {/* BLOCK 3: lighthouse + viewport (kept as one block so they stay side-by-side) */}
        <div
          data-pdf-block
          className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8"
        >
          <section className="lg:col-span-2 bg-white/85 dark:bg-slate-800 backdrop-blur-md rounded-xl border border-slate-200/70 dark:border-slate-700 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-[13px] font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <span className="bg-purple-100 dark:bg-purple-950/40 text-purple-700 dark:text-purple-400 text-[9.5px] font-extrabold px-1.5 py-0.5 rounded">01</span> Lighthouse Scores
              </h2>
              <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500">avg across {pagesCrawled} pages</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
              <Gauge label="Performance" value={scores.performance ?? 0} color={(scores.performance ?? 0) >= 80 ? 'text-emerald-500' : 'text-orange-500'} />
              <Gauge label="Accessibility" value={scores.accessibility ?? 0} color={(scores.accessibility ?? 0) >= 80 ? 'text-emerald-500' : 'text-orange-500'} />
              <Gauge label="Best Practices" value={scores.bestPractices ?? 0} color={(scores.bestPractices ?? 0) >= 80 ? 'text-emerald-500' : 'text-orange-500'} />
              <Gauge label="SEO" value={scores.seo ?? 0} color={(scores.seo ?? 0) >= 80 ? 'text-emerald-500' : 'text-orange-500'} />
            </div>
          </section>

          <section className="bg-white/85 dark:bg-slate-800 backdrop-blur-md rounded-xl border border-slate-200/70 dark:border-slate-700 p-5 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-display text-[13px] font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <span className="bg-purple-100 dark:bg-purple-950/40 text-purple-700 dark:text-purple-400 text-[9.5px] font-extrabold px-1.5 py-0.5 rounded">02</span> Viewport Testing
                </h2>
                <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500">{test.options?.device || 'multi-device'}</span>
              </div>
              <div className="space-y-2.5">
                {test.screenshots.length === 0 && (
                  <p className="text-xs text-slate-400 dark:text-slate-500 py-2">No viewport captures yet.</p>
                )}
                {test.screenshots.map((shot, i) => (
                  <div
                    key={`${shot.viewport}-${i}`}
                    className={`flex items-center justify-between py-2.5 text-xs ${i < test.screenshots.length - 1 ? 'border-b border-slate-100 dark:border-slate-800' : ''}`}
                  >
                    <div>
                      <span className="font-semibold text-slate-700 dark:text-slate-300">{shot.viewport}</span>{' '}
                      {shot.width && shot.height && (
                        <span className="text-[11px] text-slate-400 dark:text-slate-500">{shot.width}×{shot.height}</span>
                      )}
                    </div>
                    <span
                      className={`px-2.5 py-1 text-[10px] font-extrabold rounded-md ${
                        shot.error
                          ? 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400'
                          : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                      }`}
                    >
                      {shot.error ? 'ISSUE' : 'PASS'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>

        {/* BLOCK 4: broken links */}
        <section
          data-pdf-block
          className="bg-white/85 dark:bg-slate-800 backdrop-blur-md rounded-xl border border-slate-200/70 dark:border-slate-700 p-5 shadow-sm mb-8 overflow-hidden"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-[13px] font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span className="bg-purple-100 dark:bg-purple-950/40 text-purple-700 dark:text-purple-400 text-[9.5px] font-extrabold px-1.5 py-0.5 rounded">03</span> Broken Links Detected
            </h2>
            <span className="text-[11px] font-mono text-red-500 dark:text-red-400 font-semibold bg-red-50 dark:bg-red-950/40 border border-red-100 dark:border-red-900 px-2 py-0.5 rounded">{brokenLinks.length} total exceptions</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="text-slate-400 dark:text-slate-500 uppercase tracking-wider font-mono text-[10px] bg-slate-50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800">
                  <th className="py-2.5 px-3">Target URL</th>
                  <th className="py-2.5 px-3">Status Code</th>
                  <th className="py-2.5 px-3 text-right">Exception Type</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                {brokenLinks.length === 0 && (
                  <tr>
                    <td colSpan={3} className="py-4 px-3 text-center text-slate-400 dark:text-slate-500">No broken links detected.</td>
                  </tr>
                )}
                {brokenLinks.map((link, i) => {
                  const isServerError = link.statusCode >= 500;
                  const isRedirect = link.statusCode >= 300 && link.statusCode < 400;
                  const exceptionType = link.error || (isServerError ? 'Server Error' : isRedirect ? 'Redirect' : 'Not Found');
                  const colorClasses = isServerError
                    ? 'text-red-600 dark:text-red-400'
                    : isRedirect
                    ? 'text-orange-600 dark:text-orange-400'
                    : 'text-red-500 dark:text-red-400';
                  const badgeClasses = isRedirect
                    ? 'bg-orange-50 border-orange-200 text-orange-700 dark:bg-orange-950/40 dark:border-orange-900 dark:text-orange-400'
                    : 'bg-red-50 border-red-200 text-red-700 dark:bg-red-950/40 dark:border-red-900 dark:text-red-400';
                  return (
                    <tr key={`${link.url}-${i}`}>
                      <td className="py-3 px-3 text-slate-700 dark:text-slate-300 font-medium">{link.url}</td>
                      <td className={`py-3 px-3 font-bold ${colorClasses}`}>{link.statusCode}</td>
                      <td className="py-3 px-3 text-right"><span className={`border px-2 py-0.5 rounded text-[10px] font-bold ${badgeClasses}`}>{exceptionType}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* BLOCK 5: console exceptions */}
        <section
          data-pdf-block
          className="bg-white/85 dark:bg-slate-800 backdrop-blur-md rounded-xl border border-slate-200/70 dark:border-slate-700 p-5 shadow-sm mb-8"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-[13px] font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span className="bg-purple-100 dark:bg-purple-950/40 text-purple-700 dark:text-purple-400 text-[9.5px] font-extrabold px-1.5 py-0.5 rounded">04</span> Live Console Stream Exceptions
            </h2>
            <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500">Captured in pipeline</span>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800 font-mono text-xs">
            {consoleErrors.length === 0 && (
              <p className="py-3 text-slate-400 dark:text-slate-500">No console exceptions captured.</p>
            )}
            {consoleErrors.map((err, i) => {
              const isError = err.type === 'error';
              const location =
                typeof err.location === 'string'
                  ? err.location
                  : err.location && typeof err.location === 'object'
                  ? JSON.stringify(err.location)
                  : '-';
              return (
                <div key={i} className="py-2.5 flex items-start gap-4">
                  <span
                    className={`font-bold w-5 h-5 flex items-center justify-center rounded-md text-[10px] border ${
                      isError
                        ? 'text-red-500 dark:text-red-400 bg-red-50 border-red-100 dark:bg-red-950/40 dark:border-red-900'
                        : 'text-orange-600 dark:text-orange-400 bg-orange-50 border-orange-100 dark:bg-orange-950/40 dark:border-orange-900'
                    }`}
                  >
                    {isError ? '✕' : '!'}
                  </span>
                  <span className="text-slate-800 dark:text-slate-200 flex-1">{err.text}</span>
                  <span className="text-slate-400 dark:text-slate-500 text-right text-[11px]">{location}</span>
                </div>
              );
            })}
          </div>
        </section>

        {/* BLOCK 6: QA actions header + export button (button excluded from capture) */}
        <section
          data-pdf-block
          className="bg-white/85 dark:bg-slate-800 backdrop-blur-md rounded-xl border border-slate-200/70 dark:border-slate-700 p-5 shadow-sm mb-3"
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-[13px] font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <span className="bg-purple-100 dark:bg-purple-950/40 text-purple-700 dark:text-purple-400 text-[9.5px] font-extrabold px-1.5 py-0.5 rounded">05</span> QA Actions &amp; Prescriptions
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Automated AI recommended code changes</p>
            </div>

            <button
              onClick={handleDownloadPDF}
              disabled={isExporting}
              data-html2canvas-ignore
              className="px-4.5 py-2.5 bg-[#1C56C9] hover:bg-[#164aac] dark:bg-blue-600 dark:hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-900/25 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 cursor-pointer"
            >
              {isExporting ? 'Exporting…' : 'Export PDF Report'}
            </button>
          </div>
        </section>

        {/*
          BLOCKS 7-9: each issue row is its OWN block.
          This is the whole point of the rewrite — "Pricing table overflows
          viewport" can no longer be sliced down the middle. It either fits on
          the current page, or it moves to the next page in one piece.
        */}
        <div className="space-y-3">
          {test.issues.length === 0 && (
            <div data-pdf-block className="bg-white/85 dark:bg-slate-800 backdrop-blur-md rounded-xl p-4 text-sm text-slate-400 dark:text-slate-500 text-center">
              No open issues on this scan.
            </div>
          )}
          {test.issues.map((issue) => (
            <div key={issue.id} data-pdf-block className="bg-white/85 dark:bg-slate-800 backdrop-blur-md rounded-xl">
              <IssueRow
                title={issue.title}
                fix={issue.suggestion || issue.description}
                category={issue.category.replace(/-/g, ' ').toUpperCase()}
                severity={issue.severity === 'critical' || issue.severity === 'high' ? 'high' : issue.severity === 'medium' ? 'med' : 'low'}
              />
            </div>
          ))}
        </div>

      </main>
    </div>
  );
}

// --- Stat Cards ---
function StatCard({ label, value, subtext, subType = 'neutral' }: StatCardProps) {
  return (
    <div className="bg-white/85 dark:bg-slate-800 backdrop-blur-md rounded-2xl border border-slate-200/70 dark:border-slate-700 p-4.5 shadow-sm hover:shadow-md transition-shadow">
      <div className="text-[10.5px] uppercase tracking-wider font-bold text-slate-400 dark:text-slate-500 mb-1.5">{label}</div>
      <div className="font-display text-2xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">{value}</div>
      <div className={`text-[11px] font-semibold mt-1 ${subType === 'up' ? 'text-emerald-600 dark:text-emerald-400' : subType === 'down' ? 'text-red-600 dark:text-red-400' : 'text-slate-400 dark:text-slate-500'
        }`}>
        {subtext}
      </div>
    </div>
  );
}

// --- Lighthouse Gauges ---
function Gauge({ label, value, color }: GaugeProps) {
  return (
    <div className="text-center p-2 border border-slate-100 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-900/50">
      <div className="relative w-20 h-20 mx-auto flex items-center justify-center">
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
          <path className="text-slate-100 dark:text-slate-700" strokeWidth="3" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
          <path className={color} strokeDasharray={`${value}, 100`} strokeWidth="3" strokeLinecap="round" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
        </svg>
        <span className={`absolute font-mono font-bold text-base ${color}`}>{value}</span>
      </div>
      <div className="text-xs font-semibold text-slate-600 dark:text-slate-400 mt-2">{label}</div>
    </div>
  );
}

// --- Issue Rows ---
function IssueRow({ title, fix, category, severity }: IssueRowProps) {
  const sevColors = {
    high: 'bg-red-500',
    med: 'bg-orange-500',
    low: 'bg-blue-500',
  };

  return (
    <div className="flex items-start gap-4 p-3 rounded-xl bg-slate-50/60 dark:bg-slate-900/40 border border-slate-200/70 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors">
      <div className={`w-1.5 h-10 rounded-full self-center shrink-0 ${sevColors[severity]}`} />
      <div className="flex-1 min-w-0">
        <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">{title}</h4>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5"><b>Fix:</b> {fix}</p>
      </div>
      <span className="text-[10px] font-mono font-semibold px-2 py-1 bg-white/85 dark:bg-slate-800 backdrop-blur-md border border-slate-200/70 dark:border-slate-700 text-slate-500 dark:text-slate-400 rounded-md shrink-0 uppercase tracking-wider">
        {category}
      </span>
    </div>
  );
}