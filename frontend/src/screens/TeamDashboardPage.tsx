'use client';
import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { StatCard } from '../components/StatCard';
import { EmptyState } from '../components/ui/EmptyState';
import { Skeleton } from '../components/ui/Skeleton';
import { useAuth } from '../context/AuthContext';
import { useQAData } from '../context/QADataContext';
import { useToast } from '../context/ToastContext';
import { api } from '../lib/api';
import { BackendTeamMember } from '../lib/types';
import { timeAgo, formatDate } from '../lib/format';
import { useContent, getContent } from '../context/ContentContext';

export const TeamDashboardPage: React.FC = () => {
  const { user } = useAuth();
  const { tests } = useQAData();
  const { showToast } = useToast();

  const [members, setMembers] = useState<BackendTeamMember[]>([]);
  const [loading, setLoading] = useState(true);

  const pageTitle = useContent('dashboard.team.title', { text: 'Team Dashboard' });
  const pageSubtitle = useContent('dashboard.team.subtitle', { text: "Who's on the team and what they've been scanning." });
  const statMembers = useContent('dashboard.team.stat.members', { text: 'Team Members', icon: 'ph-users-three' });
  const statScansThisWeek = useContent('dashboard.team.stat.scansThisWeek', { text: 'Scans This Week', icon: 'ph-chart-line-up' });
  const statContributors = useContent('dashboard.team.stat.contributors', { text: 'Contributors', icon: 'ph-user-focus' });
  const memberActivityTitle = useContent('dashboard.team.memberActivity.title', { text: 'Member Activity' });
  const memberActivitySubtitle = useContent('dashboard.team.memberActivity.subtitle', { text: 'Scans run per member, all time.' });
  const recentActivityTitle = useContent('dashboard.team.recentActivity.title', { text: 'Recent Activity' });
  const recentActivitySubtitle = useContent('dashboard.team.recentActivity.subtitle', { text: 'Latest attributed scans.' });

  useEffect(() => {
    // No fetch to make while signed out — the component renders its own
    // "sign in required" state below without ever reading `loading`.
    if (!user) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- kicks off the fetch below; mirrors QADataContext's fetch-on-mount pattern
    setLoading(true);
    api.team
      .listMembers()
      .then((data) => !cancelled && setMembers(data))
      .catch((err) => showToast(err instanceof Error ? err.message : 'Could not load team', 'error'))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Approximate "this week" window for a stat card — a stale render-to-render
  // value here has no real consequence, so a plain Date.now() read is fine.
  // eslint-disable-next-line react-hooks/purity
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const testsThisWeek = tests.filter((t) => new Date(t.createdAt).getTime() >= weekAgo);

  const activityByMember = useMemo(() => {
    const map = new Map<string, typeof tests>();
    tests.forEach((t) => {
      if (!t.createdBy) return;
      const list = map.get(t.createdBy) || [];
      list.push(t);
      map.set(t.createdBy, list);
    });
    return map;
  }, [tests]);

  const recentActivity = useMemo(
    () =>
      tests
        .filter((t) => t.createdBy)
        .slice(0, 15),
    [tests]
  );

  if (!user) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
        <EmptyState icon="ph-lock-key" title="Sign in required" description="Sign in from the Account menu to view your team's activity." />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in w-full">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{pageTitle.text}</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{pageSubtitle.text}</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard title={statMembers.text} value={members.length} icon={statMembers.icon} variant="primary" />
          <StatCard title={statScansThisWeek.text} value={testsThisWeek.length} icon={statScansThisWeek.icon} variant="success" />
          <StatCard
            title={statContributors.text}
            value={activityByMember.size}
            subValue="have run a scan"
            icon={statContributors.icon}
            variant="warning"
          />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-2 bg-white/85 dark:bg-slate-800 backdrop-blur-md rounded-2xl border border-slate-200/70 dark:border-slate-700 shadow-lg shadow-slate-900/5 overflow-hidden">
          <div className="p-6 border-b border-slate-100 dark:border-slate-800">
            <h3 className="font-display font-bold text-slate-900 dark:text-slate-100 text-base">{memberActivityTitle.text}</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{memberActivitySubtitle.text}</p>
          </div>
          <div className="p-6 space-y-3">
            {!loading && members.length === 0 && (
              <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-6">No team members yet.</p>
            )}
            {members
              .slice()
              .sort((a, b) => b.testCount - a.testCount)
              .map((m) => (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center justify-between gap-3 p-4 border border-slate-200 dark:border-slate-700 rounded-xl"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#FFD36E] to-[#FF9FC6] text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-sm">
                      {(m.name || m.email).slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <span className="font-bold text-slate-950 dark:text-slate-100 text-sm block truncate">{m.name || m.email}</span>
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {m.role} · {m.lastActive ? `active ${timeAgo(m.lastActive)}` : 'no scans yet'}
                      </span>
                    </div>
                  </div>
                  <span className="font-bold text-blue-600 dark:text-blue-400 text-lg shrink-0">{m.testCount}</span>
                </motion.div>
              ))}
          </div>
        </div>

        <div className="bg-white/85 dark:bg-slate-800 backdrop-blur-md rounded-2xl border border-slate-200/70 dark:border-slate-700 shadow-lg shadow-slate-900/5 overflow-hidden">
          <div className="p-6 border-b border-slate-100 dark:border-slate-800">
            <h3 className="font-display font-bold text-slate-900 dark:text-slate-100 text-base">{recentActivityTitle.text}</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{recentActivitySubtitle.text}</p>
          </div>
          <div className="p-4 space-y-1 max-h-[420px] overflow-y-auto">
            {recentActivity.length === 0 && (
              <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-6">No attributed scans yet.</p>
            )}
            {recentActivity.map((t) => (
              <div key={t.id} className="p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                <p className="text-sm text-slate-800 dark:text-slate-200 truncate">
                  <span className="font-semibold">{t.createdByName || 'Someone'}</span> scanned{' '}
                  <span className="text-blue-600 dark:text-blue-400 truncate">{t.url}</span>
                </p>
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  {timeAgo(t.createdAt)} · {formatDate(t.createdAt)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
