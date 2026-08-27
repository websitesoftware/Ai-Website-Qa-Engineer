'use client';
import React, { useMemo, useRef, useState } from 'react';
import { Sparkle, DownloadSimple, FilePdf, FileCsv, FileDoc, SpinnerGap } from '@phosphor-icons/react';
import { useQAData } from '../context/QADataContext';
import { PHASE2_MODULES, BackendTest } from '../lib/types';
import { timeAgo } from '../lib/format';
import { Phase2ResultsPanel } from '../components/report/Phase2ResultsPanel';
import { ResultLaunchAnimation } from '../components/report/ResultLaunchAnimation';
import { EmptyState } from '../components/ui/EmptyState';
import { Skeleton } from '../components/ui/Skeleton';
import { exportReportCSV, exportReportPDF, exportReportDocx } from '../lib/exportReport';
import { useToast } from '../context/ToastContext';
import { useContent, getContent } from '../context/ContentContext';

function ranModules(test: BackendTest): string[] {
  return test.options?.modules || [];
}

const DownloadMenu: React.FC<{ test: BackendTest }> = ({ test }) => {
  const [open, setOpen] = useState(false);
  const { showToast } = useToast();
  const menuRef = useRef<HTMLDivElement>(null);
  const downloadReportLabel = useContent('phase2.downloadReport', { text: 'Download Report' });
  const pdfLabel = useContent('phase2.download.pdf', { text: 'PDF' });
  const csvLabel = useContent('phase2.download.csv', { text: 'CSV' });
  const wordLabel = useContent('phase2.download.word', { text: 'Word (.docx)' });

  const handle = async (fn: () => void | Promise<void>, label: string) => {
    try {
      await fn();
      showToast(getContent('phase2.download.success', { text: 'Report downloaded as {label}' }, { label }).text, 'success');
    } catch {
      showToast(getContent('phase2.download.failure', { text: 'Could not generate the {label} file' }, { label }).text, 'error');
    } finally {
      setOpen(false);
    }
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="group flex items-center gap-2 text-xs font-bold text-white bg-[#1C56C9] hover:bg-[#164aac] dark:bg-blue-600 dark:hover:bg-blue-500 px-4.5 py-3 rounded-xl transition-all duration-300 shadow-md shadow-blue-900/25 cursor-pointer"
      >
        <DownloadSimple className="w-4 h-4 transition-transform duration-300 group-hover:translate-y-0.5" /> {downloadReportLabel.text}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-48 bg-white/85 dark:bg-slate-800 backdrop-blur-md border border-slate-200/70 dark:border-slate-700 rounded-xl shadow-xl shadow-slate-900/10 dark:shadow-black/40 z-20 overflow-hidden animate-scale-in origin-top-right">
            <button
              onClick={() => handle(() => exportReportPDF(test), 'PDF')}
              className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-slate-700 dark:text-slate-300 hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-600 dark:hover:text-red-400 transition-colors"
            >
              <FilePdf className="w-4 h-4 text-red-500" /> {pdfLabel.text}
            </button>
            <button
              onClick={() => handle(() => exportReportCSV(test), 'CSV')}
              className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-slate-700 dark:text-slate-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors border-t border-slate-100 dark:border-slate-800"
            >
              <FileCsv className="w-4 h-4 text-emerald-600" /> {csvLabel.text}
            </button>
            <button
              onClick={() => handle(() => exportReportDocx(test), 'Word')}
              className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-slate-700 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-950/30 hover:text-blue-600 dark:hover:text-blue-400 transition-colors border-t border-slate-100 dark:border-slate-800"
            >
              <FileDoc className="w-4 h-4 text-blue-600" /> {wordLabel.text}
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export const Phase2ResultsPage: React.FC = () => {
  const { tests, loading } = useQAData();
  const heading = useContent('phase2.heading', { text: 'Intelligent QA' });
  const headingSuffix = useContent('phase2.headingSuffix', { text: '(Phase 2)' });
  const subtitle = useContent('phase2.subtitle', {
    text: 'Accessibility, SEO, visual regression, cross-browser, and performance benchmark results across your scans.',
  });
  const emptyTitle = useContent('phase2.empty.title', { text: 'No Phase 2 scans yet' });
  const emptyDescription = useContent('phase2.empty.description', {
    text: 'Run a new test and select at least one Phase 2 module (Accessibility, SEO, Visual Regression, Cross-Browser, or Performance Benchmark) to see results here.',
  });
  const selectPromptText = useContent('phase2.selectPrompt', { text: 'Select a scan from the list to view its Phase 2 results.' });
  const resultPass = useContent('phase2.result.pass', { text: 'Pass' });
  const resultFail = useContent('phase2.result.fail', { text: 'Fail' });

  const phase2Tests = useMemo(
    () =>
      tests
        .filter((t) => ranModules(t).length > 0)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [tests]
  );

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const activeTest = phase2Tests.find((t) => t.id === selectedId) || phase2Tests[0] || null;
  const canDownload = activeTest && (activeTest.status === 'passed' || activeTest.status === 'failed');

  return (
    <div className="space-y-6 w-full max-w-[1600px] mx-auto px-4 py-2 animate-fade-in">
      <div className="flex items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
        <div className="flex items-center gap-3.5">
          <div className="relative w-11 h-11 shrink-0 rounded-2xl bg-gradient-to-br from-[#7C5CFC] to-[#5B3FE0] flex items-center justify-center shadow-md shadow-purple-500/30">
            <Sparkle className="text-white w-6 h-6" weight="fill" />
          </div>
          <div>
            <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              {heading.text} <span className="text-purple-500 dark:text-purple-400">{headingSuffix.text}</span>
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              {subtitle.text}
            </p>
          </div>
        </div>
        {canDownload && <DownloadMenu test={activeTest!} />}
      </div>

      {loading && phase2Tests.length === 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-4">
            <Skeleton className="h-[72vh] rounded-xl" />
          </div>
          <div className="lg:col-span-8">
            <Skeleton className="h-[72vh] rounded-xl" />
          </div>
        </div>
      ) : phase2Tests.length === 0 ? (
        <EmptyState
          icon="ph-sparkle"
          title={emptyTitle.text}
          description={emptyDescription.text}
        />
      ) : (
        <div
          className="bg-white/85 dark:bg-slate-800 backdrop-blur-md rounded-2xl border border-slate-200/70 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow duration-500 overflow-hidden flex flex-col lg:flex-row animate-fade-in-up"
          style={{ height: '75vh' }}
        >
          {/* Left list */}
          <section className="w-full lg:w-4/12 border-r border-slate-200/70 dark:border-slate-700 overflow-y-auto bg-slate-50/40 dark:bg-slate-900/50 min-w-[300px]">
            <div className="px-5 py-4 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm border-b border-slate-200/70 dark:border-slate-700 sticky top-0 z-10">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                {getContent('phase2.scanCount', { text: '{count} scan{plural} with Phase 2 data' }, { count: phase2Tests.length, plural: phase2Tests.length === 1 ? '' : 's' }).text}
              </span>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800 bg-white/85 dark:bg-slate-800 backdrop-blur-md">
              {phase2Tests.map((t, idx) => {
                const isSelected = activeTest?.id === t.id;
                const modules = ranModules(t);
                const isActive = t.status === 'queued' || t.status === 'running';
                return (
                  <div
                    key={t.id}
                    onClick={() => setSelectedId(t.id)}
                    style={{ animationDelay: `${Math.min(idx, 12) * 35}ms` }}
                    className={`relative p-4 cursor-pointer transition-all duration-200 animate-fade-in-up group ${
                      isSelected
                        ? 'bg-purple-50 dark:bg-purple-950/30'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    <span
                      className={`absolute left-0 top-0 bottom-0 w-[3px] rounded-r-full bg-purple-500 transition-transform duration-300 origin-top ${
                        isSelected ? 'scale-y-100' : 'scale-y-0'
                      }`}
                    />
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate transition-colors group-hover:text-purple-600 dark:group-hover:text-purple-400">
                      {t.url}
                    </p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{timeAgo(t.completedAt || t.createdAt)}</p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {modules.map((m) => {
                        const meta = PHASE2_MODULES.find((p) => p.id === m);
                        return (
                          <span
                            key={m}
                            className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900 transition-colors group-hover:border-blue-300 dark:group-hover:border-blue-700"
                          >
                            {meta?.label || m}
                          </span>
                        );
                      })}
                    </div>
                    {isActive && (
                      <span className="inline-flex items-center gap-1 mt-2 text-[10px] font-bold text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/40 px-1.5 py-0.5 rounded">
                        <SpinnerGap className="w-2.5 h-2.5 animate-spin" weight="bold" />
                        {getContent('phase2.scanInProgress', { text: 'Scan in progress — {progress}%' }, { progress: t.progress }).text}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* Right detail panel */}
          <section className="hidden lg:block lg:w-8/12 overflow-y-auto p-6">
            {activeTest ? (
              activeTest.status === 'queued' || activeTest.status === 'running' ? (
                <div key={activeTest.id} className="bg-gradient-to-br from-blue-50 to-violet-50/60 dark:from-blue-950/30 dark:to-violet-950/20 border border-blue-100 dark:border-blue-900 rounded-2xl p-8 text-center animate-scale-in">
                  <div className="relative w-14 h-14 mx-auto mb-4">
                    <div className="absolute inset-0 rounded-full bg-blue-400/20 animate-soft-pulse" />
                    <SpinnerGap className="w-14 h-14 text-blue-500 animate-spin relative" weight="bold" />
                  </div>
                  <p className="font-semibold text-blue-700 dark:text-blue-400">
                    {getContent('phase2.scanInProgressComplete', { text: 'Scan in progress — {progress}% complete' }, { progress: activeTest.progress }).text}
                  </p>
                  <div className="mt-4 h-2 w-full max-w-xs mx-auto bg-blue-100 dark:bg-blue-950/50 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-violet-500 rounded-full transition-all duration-700 ease-out"
                      style={{ width: `${activeTest.progress}%` }}
                    />
                  </div>
                </div>
              ) : (
                <div key={activeTest.id} className="animate-fade-in-up">
                  {(activeTest.status === 'passed' || activeTest.status === 'failed') && (
                    <ResultLaunchAnimation
                      key={activeTest.status}
                      passed={activeTest.status === 'passed'}
                      label={activeTest.status === 'passed' ? resultPass.text : resultFail.text}
                    />
                  )}
                  <Phase2ResultsPanel test={activeTest} />
                </div>
              )
            ) : (
              <div className="h-full w-full flex items-center justify-center text-slate-400 dark:text-slate-500 text-sm font-medium">
                {selectPromptText.text}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
};
