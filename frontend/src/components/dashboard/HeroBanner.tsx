'use client';
import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useQAData } from '../../context/QADataContext';

function healthMessage(score: number | null, critical: number): string {
  if (score === null) return 'Run your first scan to see your site health here.';
  if (critical > 0) {
    return `Your site health needs attention — ${critical} critical issue${critical === 1 ? '' : 's'} ${
      critical === 1 ? 'is' : 'are'
    } dragging the score down.`;
  }
  if (score >= 90) return 'Excellent — your site is in great shape.';
  if (score >= 70) return 'Good overall, with a few issues worth a look.';
  return 'Fair — some issues need attention to improve your score.';
}

export const HeroBanner: React.FC = () => {
  const { user } = useAuth();
  const { stats } = useQAData();
  const critical = stats?.issuesBySeverity.critical ?? 0;

  return (
    <div className="relative overflow-hidden rounded-3xl px-6 py-7 sm:px-8 sm:py-8 flex flex-col sm:flex-row gap-6 sm:items-center sm:justify-between bg-gradient-to-br from-[#4C93FF] via-[#1C56C9] to-[#12377C] shadow-xl shadow-blue-900/25 text-white">
      <div
        className="absolute -right-10 -top-16 w-56 h-56 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.2), transparent 70%)' }}
        aria-hidden="true"
      />

      <div className="relative z-10">
        <p className="text-[11px] font-bold uppercase tracking-wider opacity-85">
          Welcome back{user?.name ? `, ${user.name}` : ''}
        </p>
        <p className="font-display text-4xl sm:text-5xl font-extrabold leading-none mt-2">
          {stats?.avgScore ?? '—'}
          <span className="text-lg sm:text-xl font-semibold opacity-75 ml-1.5">/100 overall score</span>
        </p>
        <p className="text-sm opacity-90 mt-2 max-w-sm">{healthMessage(stats?.avgScore ?? null, critical)}</p>
      </div>

      <div className="relative z-10 flex flex-wrap gap-3">
        <div className="bg-white/15 backdrop-blur-sm border border-white/25 rounded-2xl px-5 py-4 min-w-[110px]">
          <p className="font-display text-2xl font-extrabold">{stats?.total ?? 0}</p>
          <p className="text-[11px] opacity-90 mt-1">Tests run</p>
        </div>
        <div className="bg-white/15 backdrop-blur-sm border border-white/25 rounded-2xl px-5 py-4 min-w-[110px]">
          <p className="font-display text-2xl font-extrabold">{stats?.totalIssues ?? 0}</p>
          <p className="text-[11px] opacity-90 mt-1">Issues found</p>
        </div>
        <div className="bg-white/15 backdrop-blur-sm border border-white/25 rounded-2xl px-5 py-4 min-w-[110px]">
          <p className="font-display text-2xl font-extrabold">{critical}</p>
          <p className="text-[11px] opacity-90 mt-1">Critical</p>
        </div>
      </div>
    </div>
  );
};
