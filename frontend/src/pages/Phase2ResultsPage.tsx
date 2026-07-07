
'use client';
import React, { useMemo, useRef, useState } from 'react';
import { Sparkle, DownloadSimple, FilePdf, FileCsv, FileDoc } from '@phosphor-icons/react';
import { useQAData } from '../context/QADataContext';
import { PHASE2_MODULES, BackendTest } from '../lib/types';
import { timeAgo } from '../lib/format';
import { Phase2ResultsPanel } from '../components/report/Phase2ResultsPanel';
import { EmptyState } from '../components/ui/EmptyState';
import { Skeleton } from '../components/ui/Skeleton';
import { exportReportCSV, exportReportPDF, exportReportDocx } from '../lib/exportReport';
import { useToast } from '../context/ToastContext';

function ranModules(test: BackendTest): string[] {
  return test.options?.modules || [];
}

const DownloadMenu: React.FC<{ test: BackendTest }> = ({ test }) => {
  const [open, setOpen] = useState(false);
  const { showToast } = useToast();
  const menuRef = useRef<HTMLDivElement>(null);

  const handle = async (fn: () => void | Promise<void>, label: string) => {
    try {
      await fn();
      showToast(`Report downloaded as ${label}`, 'success');
    } catch {
      showToast(`Could not generate the ${label} file`, 'error');
    } finally {
      setOpen(false);
    }
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 px-3.5 py-2 rounded-lg transition-colors shadow-sm"
      >
        <DownloadSimple className="w-4 h-4" /> Download Report
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-44 bg-white border border-slate-200 rounded-lg shadow-lg z-20 overflow-hidden">
            <button
              onClick={() => handle(() => exportReportPDF(test), 'PDF')}
              className="w-full flex items-center gap-2 px-3.5 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <FilePdf className="w-4 h-4 text-red-500" /> PDF
            </button>
            <button
              onClick={() => handle(() => exportReportCSV(test), 'CSV')}
              className="w-full flex items-center gap-2 px-3.5 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors border-t border-slate-100"
            >
              <FileCsv className="w-4 h-4 text-emerald-600" /> CSV
            </button>
            <button
              onClick={() => handle(() => exportReportDocx(test), 'Word')}
              className="w-full flex items-center gap-2 px-3.5 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors border-t border-slate-100"
            >
              <FileDoc className="w-4 h-4 text-blue-600" /> Word (.docx)
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export const Phase2ResultsPage: React.FC = () => {
  const { tests, loading } = useQAData();

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
      <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Sparkle className="text-indigo-600 w-7 h-7" /> Intelligent QA (Phase 2)
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Accessibility, SEO, visual regression, cross-browser, and performance benchmark results across your scans.
          </p>
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
          title="No Phase 2 scans yet"
          description="Run a new test and select at least one Phase 2 module (Accessibility, SEO, Visual Regression, Cross-Browser, or Performance Benchmark) to see results here."
        />
      ) : (
        <div
          className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col lg:flex-row"
          style={{ height: '75vh' }}
        >
          {/* Left list */}
          <section className="w-full lg:w-4/12 border-r border-slate-200 overflow-y-auto bg-slate-50/40 min-w-[300px]">
            <div className="px-5 py-4 bg-white border-b border-slate-200 sticky top-0 z-10">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                {phase2Tests.length} scan{phase2Tests.length === 1 ? '' : 's'} with Phase 2 data
              </span>
            </div>
            <div className="divide-y divide-slate-100 bg-white">
              {phase2Tests.map((t) => {
                const isSelected = activeTest?.id === t.id;
                const modules = ranModules(t);
                return (
                  <div
                    key={t.id}
                    onClick={() => setSelectedId(t.id)}
                    className={`p-4 cursor-pointer transition-colors ${isSelected ? 'bg-indigo-50/50 border-l-4 border-indigo-500' : 'hover:bg-slate-50 border-l-4 border-transparent'
                      }`}
                  >
                    <p className="text-sm font-semibold text-slate-800 truncate">{t.url}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{timeAgo(t.completedAt || t.createdAt)}</p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {modules.map((m) => {
                        const meta = PHASE2_MODULES.find((p) => p.id === m);
                        return (
                          <span
                            key={m}
                            className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600 border border-indigo-100"
                          >
                            {meta?.label || m}
                          </span>
                        );
                      })}
                    </div>
                    {(t.status === 'queued' || t.status === 'running') && (
                      <span className="inline-block mt-2 text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-100 px-1.5 py-0.5 rounded">
                        Scan in progress — {t.progress}%
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
                <div className="bg-indigo-50/60 border border-indigo-100 rounded-xl p-6 text-center">
                  <i className="ph ph-spinner-gap animate-spin text-3xl text-indigo-500 block mb-3"></i>
                  <p className="font-semibold text-indigo-700">Scan in progress — {activeTest.progress}% complete</p>
                </div>
              ) : (
                <Phase2ResultsPanel test={activeTest} />
              )
            ) : (
              <div className="h-full w-full flex items-center justify-center text-slate-400 text-sm font-medium">
                Select a scan from the list to view its Phase 2 results.
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
};