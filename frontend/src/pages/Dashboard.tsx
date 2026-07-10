'use client';
import React from 'react';
import { StatCard } from '../components/StatCard';
import { TestPipeline } from '../components/TestPipeline';
import { UnresolvedIssues } from '../components/UnresolvedIssues';
import { AiTestStudio } from '../components/ai-automation/AiTestStudio';
import { StatCardProps, IssueItem } from '../app/types/dashboard';
import { useQAData } from '../context/QADataContext';
import { Skeleton } from '../components/ui/Skeleton';
import { categoryLabel } from '../lib/format';

export const DashboardView: React.FC = () => {
  const { stats, pipeline, tests, loading } = useQAData();

  const statsData: StatCardProps[] = [
    { title: 'Tests Run', value: stats?.total ?? 0, icon: 'ph-squares-four', variant: 'primary' },
    { title: 'Issues Found', value: stats?.totalIssues ?? 0, icon: 'ph-warning', variant: 'warning' },
    { title: 'Critical Issues', value: stats?.issuesBySeverity.critical ?? 0, icon: 'ph-fire', variant: 'danger' },
    { title: 'Overall Score', value: stats?.avgScore ?? 0, subValue: ' /100', icon: 'ph-gauge', variant: 'success' },
  ];

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
      {/* Metrics Row Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {loading && !stats
          ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)
          : statsData.map((stat, idx) => <StatCard key={idx} {...stat} />)}
      </div>


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
          <AiTestStudio test={latestTest} />
        </div>
      </>
    </div>
  );
};
