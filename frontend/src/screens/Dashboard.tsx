'use client';
import React from 'react';
import { StatCard } from '../components/StatCard';
import { TestPipeline } from '../components/TestPipeline';
import { UnresolvedIssues } from '../components/UnresolvedIssues';
import { AiTestStudio } from '../components/ai-automation/AiTestStudio';
import { StatCardProps, IssueItem } from '../app/types/dashboard';
import { useQAData } from '../context/QADataContext';
import { useContent } from '../context/ContentContext';
import { Skeleton } from '../components/ui/Skeleton';
import { categoryLabel } from '../lib/format';

export const DashboardView: React.FC = () => {
  const { stats, pipeline, tests, loading } = useQAData();

  const testsRun = useContent('dashboard.stat.testsRun.title', { text: 'Tests Run', icon: 'ph-squares-four' });
  const issuesFound = useContent('dashboard.stat.issuesFound.title', { text: 'Issues Found', icon: 'ph-warning' });
  const criticalIssues = useContent('dashboard.stat.criticalIssues.title', { text: 'Critical Issues', icon: 'ph-fire' });
  const overallScore = useContent('dashboard.stat.overallScore.title', { text: 'Overall Score', icon: 'ph-gauge' });

  const statsData: StatCardProps[] = [
    { title: testsRun.text, value: stats?.total ?? 0, icon: testsRun.icon, variant: 'primary' },
    { title: issuesFound.text, value: stats?.totalIssues ?? 0, icon: issuesFound.icon, variant: 'warning' },
    { title: criticalIssues.text, value: stats?.issuesBySeverity.critical ?? 0, icon: criticalIssues.icon, variant: 'danger' },
    { title: overallScore.text, value: stats?.avgScore ?? 0, subValue: ' /100', icon: overallScore.icon, variant: 'success' },
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
          <AiTestStudio />
        </div>
      </>
    </div>
  );
};
