'use client';
import React, { useMemo, useState } from 'react';
import { PlayCircle, SpinnerGap } from '@phosphor-icons/react';
import { useQAData } from '../context/QADataContext';
import { BackendTest } from '../lib/types';
import { timeAgo } from '../lib/format';
import { FunctionalTestingPanel } from '../components/report/FunctionalTestingPanel';
import { ResultLaunchAnimation } from '../components/report/ResultLaunchAnimation';
import { EmptyState } from '../components/ui/EmptyState';
import { Skeleton } from '../components/ui/Skeleton';

function ranFunctionalTesting(test: BackendTest): boolean {
  return (test.options?.modules || []).includes('functional-testing');
}

export const Phase3ResultsPage: React.FC = () => {
  const { tests, loading } = useQAData();

  const phase3Tests = useMemo(
    () =>
      tests
        .filter(ranFunctionalTesting)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [tests]
  );

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const activeTest = phase3Tests.find((t) => t.id === selectedId) || phase3Tests[0] || null;
  const components = activeTest?.functionalTesting || [];

  return (
    <div className="space-y-6 w-full max-w-[1600px] mx-auto px-4 py-2 animate-fade-in">
      <div className="flex items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
        <div className="flex items-center gap-3.5">
          <div className="relative w-11 h-11 shrink-0 rounded-2xl bg-gradient-to-br from-[#7C5CFC] to-[#5B3FE0] flex items-center justify-center shadow-md shadow-purple-500/30">
            <PlayCircle className="text-white w-6 h-6" weight="fill" />
          </div>
          <div>
            <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              Functional Testing <span className="text-purple-500 dark:text-purple-400">(Phase 3)</span>
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Real functionality detected per page component, with generated steps actually executed and verified.
            </p>
          </div>
        </div>
      </div>

      {loading && phase3Tests.length === 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-4">
            <Skeleton className="h-[72vh] rounded-xl" />
          </div>
          <div className="lg:col-span-8">
            <Skeleton className="h-[72vh] rounded-xl" />
          </div>
        </div>
      ) : phase3Tests.length === 0 ? (
        <EmptyState
          icon="ph-play-circle"
          title="No Phase 3 scans yet"
          description="Run a new test and select the Functional Testing module to see component-level functionality results here."
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
                {phase3Tests.length} scan{phase3Tests.length === 1 ? '' : 's'} with Phase 3 data
              </span>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800 bg-white/85 dark:bg-slate-800 backdrop-blur-md">
              {phase3Tests.map((t, idx) => {
                const isSelected = activeTest?.id === t.id;
                const isActive = t.status === 'queued' || t.status === 'running';
                const compCount = t.functionalTesting?.length || 0;
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
                    {compCount > 0 && (
                      <span className="inline-flex items-center mt-2 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 border border-purple-100 dark:border-purple-900">
                        {compCount} component{compCount === 1 ? '' : 's'}
                      </span>
                    )}
                    {isActive && (
                      <span className="inline-flex items-center gap-1 mt-2 ml-2 text-[10px] font-bold text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/40 px-1.5 py-0.5 rounded">
                        <SpinnerGap className="w-2.5 h-2.5 animate-spin" weight="bold" />
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
                <div key={activeTest.id} className="bg-gradient-to-br from-blue-50 to-violet-50/60 dark:from-blue-950/30 dark:to-violet-950/20 border border-blue-100 dark:border-blue-900 rounded-2xl p-8 text-center animate-scale-in">
                  <div className="relative w-14 h-14 mx-auto mb-4">
                    <div className="absolute inset-0 rounded-full bg-blue-400/20 animate-soft-pulse" />
                    <SpinnerGap className="w-14 h-14 text-blue-500 animate-spin relative" weight="bold" />
                  </div>
                  <p className="font-semibold text-blue-700 dark:text-blue-400">Scan in progress — {activeTest.progress}% complete</p>
                  <div className="mt-4 h-2 w-full max-w-xs mx-auto bg-blue-100 dark:bg-blue-950/50 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-violet-500 rounded-full transition-all duration-700 ease-out"
                      style={{ width: `${activeTest.progress}%` }}
                    />
                  </div>
                </div>
              ) : components.length === 0 ? (
                <EmptyState
                  icon="ph-play-circle"
                  title="No components detected"
                  description="This scan didn't find any distinct, testable components on the page."
                />
              ) : (
                <div key={activeTest.id} className="animate-fade-in-up">
                  {(activeTest.status === 'passed' || activeTest.status === 'failed') && (
                    <ResultLaunchAnimation
                      key={activeTest.status}
                      passed={activeTest.status === 'passed'}
                      label={activeTest.status === 'passed' ? 'Pass' : 'Fail'}
                    />
                  )}
                  <FunctionalTestingPanel components={components} />
                </div>
              )
            ) : (
              <div className="h-full w-full flex items-center justify-center text-slate-400 dark:text-slate-500 text-sm font-medium">
                Select a scan from the list to view its Phase 3 results.
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
};
