'use client';
import React from 'react';
import { TestPipeline } from '../components/TestPipeline';
import { UnresolvedIssues } from '../components/UnresolvedIssues';
import { AiTestStudio } from '../components/ai-automation/AiTestStudio';
import { HeroBanner } from '../components/dashboard/HeroBanner';
import { IssueItem } from '../app/types/dashboard';
import { useQAData } from '../context/QADataContext';
import { categoryLabel } from '../lib/format';

export const DashboardView: React.FC = () => {
  const { pipeline, tests } = useQAData();

  // Group unresolved issues across all tests by category, most frequent first
  const issueMap = new Map<string, { count: number; severity: 'high' | 'medium' | 'low' | 'info' }>();
  tests.forEach((t) =>
    t.issues
      .filter((i) => !i.resolved)
      .forEach((i) => {
        const sev = i.severity === 'critical' ? 'high' : (i.severity as 'high' | 'medium' | 'low');
        const existing = issueMap.get(i.category);
        if (existing) existing.count += 1;
        else issueMap.set(i.category, { count: 1, severity: sev || 'info' });
      })
  );

  const activeIssues: IssueItem[] = Array.from(issueMap.entries())
    .map(([category, v], idx) => ({ id: String(idx), label: categoryLabel(category), count: v.count, severity: v.severity }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const latestTest = pipeline?.activeScans[0] ?? tests[0] ?? null;

  return (
    <div className="space-y-6 animate-fade-in w-full">
      <HeroBanner />

      <>
        {/* Top Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

          <div className="lg:col-span-2 self-start">
            <TestPipeline test={latestTest} />
          </div>

          <div className="self-start">
            <UnresolvedIssues issues={activeIssues} />
          </div>

        </div>


        <div className="mt-6">
          <AiTestStudio />
        </div>
      </>
    </div>
  );
};
