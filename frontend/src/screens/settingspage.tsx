'use client';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQAData } from '../context/QADataContext';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { formatDate, timeAgo } from '../lib/format';
import { api, API_ORIGIN } from '../lib/api';
import { useContent } from '../context/ContentContext';
import {
  BackendPolicy,
  BackendBranding,
  BackendMonitor,
  BackendTeamMember,
  PolicyScoreRanges,
  MonitorFrequency,
  TeamRole,
} from '../lib/types';

const SCORE_RANGE_KEYS: { key: keyof PolicyScoreRanges; label: string }[] = [
  { key: 'overallScore', label: 'Overall' },
  { key: 'performance', label: 'Performance' },
  { key: 'accessibility', label: 'Accessibility' },
  { key: 'seo', label: 'SEO' },
  { key: 'bestPractices', label: 'Best Practices' },
];

const DEFAULT_SCORE_RANGES: PolicyScoreRanges = {
  overallScore: { min: 0, max: 100 },
  performance: { min: 0, max: 100 },
  accessibility: { min: 0, max: 100 },
  seo: { min: 0, max: 100 },
  bestPractices: { min: 0, max: 100 },
};

type SettingsTab = 'general' | 'domains' | 'automation' | 'policies' | 'branding' | 'team' | 'integrations';

interface TrackedDomain {
  id: string;
  url: string;
}

const SignInNotice: React.FC<{ what: string }> = ({ what }) => (
  <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
    <i className="ph ph-lock-key text-3xl mb-2 block text-slate-300 dark:text-slate-600"></i>
    Sign in from the Account menu to manage {what}.
  </div>
);

export const SettingsPage: React.FC = () => {
  const { tests } = useQAData();
  const { showToast } = useToast();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<SettingsTab>('general');

  const pageTitle = useContent('settings.header.title', { text: 'Settings' });
  const pageSubtitle = useContent('settings.header.subtitle', {
    text: 'Configure target domains, testing frequency, alerts, and team profiles.',
  });
  const navGeneral = useContent('settings.nav.general', { text: 'General Profile', icon: 'ph-user-circle' });
  const navDomains = useContent('settings.nav.domains', { text: 'Target Domains', icon: 'ph-globe' });
  const navAutomation = useContent('settings.nav.automation', { text: 'Continuous Monitoring', icon: 'ph-alarm' });
  const navPolicies = useContent('settings.nav.policies', { text: 'Testing Policies', icon: 'ph-shield-check' });
  const navBranding = useContent('settings.nav.branding', { text: 'White-label Reports', icon: 'ph-paint-bucket' });
  const navTeam = useContent('settings.nav.team', { text: 'Team', icon: 'ph-users-three' });
  const navIntegrations = useContent('settings.nav.integrations', { text: 'Integrations', icon: 'ph-plugs' });

  const settingsNavItems: { id: SettingsTab; label: string; icon: string }[] = [
    { id: 'general', label: navGeneral.text, icon: navGeneral.icon },
    { id: 'domains', label: navDomains.text, icon: navDomains.icon },
    { id: 'automation', label: navAutomation.text, icon: navAutomation.icon },
    { id: 'policies', label: navPolicies.text, icon: navPolicies.icon },
    { id: 'branding', label: navBranding.text, icon: navBranding.icon },
    { id: 'team', label: navTeam.text, icon: navTeam.icon },
    { id: 'integrations', label: navIntegrations.text, icon: navIntegrations.icon },
  ];

  // Domains actually seen from real scans (read-only, derived from backend data)
  const scannedDomains = useMemo(() => {
    const byUrl = new Map<string, { url: string; lastScan: string; score: number | null }>();
    tests.forEach((t) => {
      const existing = byUrl.get(t.url);
      if (!existing || new Date(t.createdAt) > new Date(existing.lastScan)) {
        byUrl.set(t.url, { url: t.url, lastScan: t.createdAt, score: t.score });
      }
    });
    return Array.from(byUrl.values()).sort((a, b) => new Date(b.lastScan).getTime() - new Date(a.lastScan).getTime());
  }, [tests]);

  // Manually tracked domains — local-only reminder list (Phase 1 backend has no domains API yet)
  const [trackedDomains, setTrackedDomains] = useState<TrackedDomain[]>([]);
  const [newDomainUrl, setNewDomainUrl] = useState('');

  const handleAddDomain = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDomainUrl) return;
    setTrackedDomains((prev) => [...prev, { id: Date.now().toString(), url: newDomainUrl }]);
    setNewDomainUrl('');
    showToast('Added to your tracked domains list', 'success');
  };

  const handleDeleteDomain = (id: string, url: string) => {
    setTrackedDomains((prev) => prev.filter((d) => d.id !== id));
    showToast(`Removed ${url} from tracked domains`, 'info');
  };

  // ---------------------------------------------------------------------
  // Continuous Monitoring (real backend, /api/monitors)
  // ---------------------------------------------------------------------
  const [monitors, setMonitors] = useState<BackendMonitor[]>([]);
  const [monitorsLoading, setMonitorsLoading] = useState(false);
  const [newMonitorUrls, setNewMonitorUrls] = useState('');
  const [newMonitorFrequency, setNewMonitorFrequency] = useState<MonitorFrequency>('daily');
  const [monitorSaving, setMonitorSaving] = useState(false);

  const fetchMonitors = useCallback(async () => {
    if (!user) return;
    try {
      setMonitors(await api.monitors.list());
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not load monitors', 'error');
    }
  }, [user, showToast]);

  useEffect(() => {
    if (activeTab !== 'automation') return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- tab-triggered fetch, mirrors QADataContext's fetch-on-mount pattern
    setMonitorsLoading(true);
    fetchMonitors().finally(() => setMonitorsLoading(false));

    // A monitor's scan can be triggered by the backend scheduler at any
    // moment, not just from this screen — poll while the tab is open so the
    // "scanning now" indicator and last-run timestamps reflect reality
    // instead of going stale until the user manually reopens the tab.
    const interval = setInterval(fetchMonitors, 8000);
    return () => clearInterval(interval);
  }, [activeTab, fetchMonitors]);

  // One monitor per line (or comma-separated) so a whole list of sites can
  // be dropped in at once and each starts its own independent schedule.
  const parseMonitorUrls = (raw: string): string[] => {
    const candidates = raw
      .split(/[\n,]/)
      .map((s) => s.trim())
      .filter(Boolean);
    const seen = new Set<string>();
    const valid: string[] = [];
    for (const candidate of candidates) {
      try {
        const u = new URL(candidate);
        if ((u.protocol === 'http:' || u.protocol === 'https:') && !seen.has(candidate)) {
          seen.add(candidate);
          valid.push(candidate);
        }
      } catch {
        // not a valid absolute URL — skip it
      }
    }
    return valid;
  };

  const handleCreateMonitor = async (e: React.FormEvent) => {
    e.preventDefault();
    const urls = parseMonitorUrls(newMonitorUrls);
    if (urls.length === 0) {
      showToast('Enter at least one valid URL (e.g. https://example.com or http://localhost:3000)', 'error');
      return;
    }
    setMonitorSaving(true);
    try {
      const results = await Promise.allSettled(
        urls.map((url) => api.monitors.create({ url, frequency: newMonitorFrequency }))
      );
      const succeeded = results.filter((r) => r.status === 'fulfilled').length;
      const failed = results.length - succeeded;
      if (succeeded > 0) {
        setNewMonitorUrls('');
        showToast(
          failed === 0
            ? `${succeeded} monitor${succeeded > 1 ? 's' : ''} created — Phase 1 + Phase 2 scans on schedule`
            : `${succeeded} monitor${succeeded > 1 ? 's' : ''} created, ${failed} failed`,
          failed === 0 ? 'success' : 'error'
        );
      } else {
        showToast('Could not create any monitors', 'error');
      }
      await fetchMonitors();
    } finally {
      setMonitorSaving(false);
    }
  };

  const toggleMonitor = async (m: BackendMonitor) => {
    try {
      await api.monitors.update(m.id, { enabled: !m.enabled });
      await fetchMonitors();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not update monitor', 'error');
    }
  };

  const runMonitorNow = async (m: BackendMonitor) => {
    try {
      await api.monitors.runNow(m.id);
      showToast(`Scan triggered for ${m.url}`, 'success');
      await fetchMonitors();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not trigger scan', 'error');
    }
  };

  const deleteMonitor = async (m: BackendMonitor) => {
    try {
      await api.monitors.remove(m.id);
      showToast('Monitor removed', 'info');
      await fetchMonitors();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not remove monitor', 'error');
    }
  };

  // ---------------------------------------------------------------------
  // Custom Testing Policies (real backend, /api/policies)
  // ---------------------------------------------------------------------
  const [policies, setPolicies] = useState<BackendPolicy[]>([]);
  const [policiesLoading, setPoliciesLoading] = useState(false);
  const [newPolicyName, setNewPolicyName] = useState('');
  const [newPolicyRanges, setNewPolicyRanges] = useState<PolicyScoreRanges>(DEFAULT_SCORE_RANGES);
  const [policySaving, setPolicySaving] = useState(false);

  const fetchPolicies = useCallback(async () => {
    if (!user) return;
    setPoliciesLoading(true);
    try {
      setPolicies(await api.policies.list());
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not load policies', 'error');
    } finally {
      setPoliciesLoading(false);
    }
  }, [user, showToast]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- tab-triggered fetch, mirrors QADataContext's fetch-on-mount pattern
    if (activeTab === 'policies') fetchPolicies();
  }, [activeTab, fetchPolicies]);

  const handleCreatePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPolicyName) return;
    setPolicySaving(true);
    try {
      await api.policies.create({ name: newPolicyName, scoreRanges: newPolicyRanges });
      setNewPolicyName('');
      setNewPolicyRanges(DEFAULT_SCORE_RANGES);
      showToast('Policy created', 'success');
      await fetchPolicies();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not create policy', 'error');
    } finally {
      setPolicySaving(false);
    }
  };

  const activatePolicy = async (p: BackendPolicy) => {
    try {
      await api.policies.setActive(p.id);
      showToast(`"${p.name}" is now the active policy`, 'success');
      await fetchPolicies();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not activate policy', 'error');
    }
  };

  const deletePolicy = async (p: BackendPolicy) => {
    try {
      await api.policies.remove(p.id);
      showToast('Policy deleted', 'info');
      await fetchPolicies();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not delete policy', 'error');
    }
  };

  // ---------------------------------------------------------------------
  // White-label Branding (real backend, /api/branding)
  // ---------------------------------------------------------------------
  const [branding, setBranding] = useState<BackendBranding | null>(null);
  const [brandingForm, setBrandingForm] = useState({
    primaryColor: '#4f46e5',
    footerText: '',
    headerText: '',
    headerFontSize: 16,
    footerFontSize: 8,
    logoWidth: 84,
    logoHeight: 54,
  });
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [brandingSaving, setBrandingSaving] = useState(false);

  const fetchBranding = useCallback(async () => {
    try {
      const b = await api.branding.get();
      setBranding(b);
      setBrandingForm({
        primaryColor: b.primaryColor,
        footerText: b.footerText,
        headerText: b.headerText,
        headerFontSize: b.headerFontSize,
        footerFontSize: b.footerFontSize,
        logoWidth: b.logoWidth,
        logoHeight: b.logoHeight,
      });
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not load branding', 'error');
    }
  }, [showToast]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- tab-triggered fetch, mirrors QADataContext's fetch-on-mount pattern
    if (activeTab === 'branding') fetchBranding();
  }, [activeTab, fetchBranding]);

  const handleLogoFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => setLogoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSaveBranding = async (e: React.FormEvent) => {
    e.preventDefault();
    setBrandingSaving(true);
    try {
      const updated = await api.branding.update({
        ...brandingForm,
        ...(logoPreview ? { logoBase64: logoPreview } : {}),
      });
      setBranding(updated);
      setLogoPreview(null);
      showToast('Branding saved', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not save branding', 'error');
    } finally {
      setBrandingSaving(false);
    }
  };

  // ---------------------------------------------------------------------
  // Team (real backend, /api/team)
  // ---------------------------------------------------------------------
  const [teamMembers, setTeamMembers] = useState<BackendTeamMember[]>([]);
  const [teamLoading, setTeamLoading] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<TeamRole>('viewer');
  const [inviteSaving, setInviteSaving] = useState(false);

  const fetchTeam = useCallback(async () => {
    if (!user) return;
    setTeamLoading(true);
    try {
      setTeamMembers(await api.team.listMembers());
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not load team members', 'error');
    } finally {
      setTeamLoading(false);
    }
  }, [user, showToast]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- tab-triggered fetch, mirrors QADataContext's fetch-on-mount pattern
    if (activeTab === 'team') fetchTeam();
  }, [activeTab, fetchTeam]);

  const currentMember = teamMembers.find((m) => m.id === user?.id);
  const canManageTeam = currentMember?.role === 'owner' || currentMember?.role === 'admin';

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) return;
    setInviteSaving(true);
    try {
      const result = await api.team.invite(inviteEmail, inviteRole);
      setInviteEmail('');
      if (result.teamStatus === 'invited') {
        showToast(
          result.emailSent
            ? `Invite emailed to ${result.email}`
            : `Invite created, but the email couldn't be sent — share this link: ${result.devInviteLink ?? '(none)'}`,
          result.emailSent ? 'success' : 'info'
        );
      } else {
        showToast('Member added to the team', 'success');
      }
      await fetchTeam();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not add member', 'error');
    } finally {
      setInviteSaving(false);
    }
  };

  const changeRole = async (memberId: string, role: TeamRole) => {
    try {
      await api.team.updateRole(memberId, role);
      showToast('Role updated', 'success');
      await fetchTeam();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not update role', 'error');
    }
  };

  const removeMember = async (memberId: string) => {
    try {
      await api.team.remove(memberId);
      showToast('Member removed from the team', 'info');
      await fetchTeam();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not remove member', 'error');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in w-full">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{pageTitle.text}</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{pageSubtitle.text}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        {/* Sidebar tabs */}
        <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-1">
          {settingsNavItems.map((tab) => {
            const isSelected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 relative ${
                  isSelected ? 'text-indigo-600 dark:text-indigo-400 font-semibold' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                }`}
              >
                {isSelected && (
                  <motion.div
                    layoutId="activeSettingsTabIndicator"
                    className="absolute inset-0 bg-indigo-50 dark:bg-indigo-950/30 rounded-lg -z-10"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
                <i className={`ph ${tab.icon} text-lg`}></i>
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Panel */}
        <div className="lg:col-span-3">
          <AnimatePresence mode="wait">
            {activeTab === 'general' && (
              <motion.div
                key="general"
                initial={{ opacity: 0, x: 15 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -15 }}
                transition={{ duration: 0.18 }}
                className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden"
              >
                <div className="p-6 border-b border-slate-100 dark:border-slate-800">
                  <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">General Profile</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Your signed-in account details.</p>
                </div>
                <div className="p-6 space-y-5">
                  {user ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Name</label>
                        <input type="text" value={user.name} disabled className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-800 rounded-lg text-sm bg-slate-100 dark:bg-slate-900 text-slate-500 dark:text-slate-400" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Email</label>
                        <input type="email" value={user.email} disabled className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-800 rounded-lg text-sm bg-slate-100 dark:bg-slate-900 text-slate-500 dark:text-slate-400" />
                      </div>
                    </div>
                  ) : (
                    <SignInNotice what="your profile" />
                  )}
                </div>
              </motion.div>
            )}

            {activeTab === 'domains' && (
              <motion.div
                key="domains"
                initial={{ opacity: 0, x: 15 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -15 }}
                transition={{ duration: 0.18 }}
                className="space-y-6"
              >
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                  <div className="p-6 border-b border-slate-100 dark:border-slate-800">
                    <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">Recently Scanned Domains</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Live from your scan history — no setup needed.</p>
                  </div>
                  <div className="p-6 space-y-3">
                    {scannedDomains.length === 0 && (
                      <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-6">
                        Nothing scanned yet — run your first test to see it appear here.
                      </p>
                    )}
                    {scannedDomains.map((d) => (
                      <div
                        key={d.url}
                        className="flex items-center justify-between p-4 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-lg flex items-center justify-center text-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 shrink-0">
                            <i className="ph ph-globe-hemisphere-west"></i>
                          </div>
                          <div className="min-w-0">
                            <span className="font-bold text-slate-950 dark:text-slate-100 text-sm block truncate">{d.url}</span>
                            <span className="text-xs text-slate-500 dark:text-slate-400">Last scanned {formatDate(d.lastScan)}</span>
                          </div>
                        </div>
                        {d.score !== null && (
                          <span
                            className={`font-bold text-sm shrink-0 ${
                              d.score >= 90 ? 'text-emerald-600 dark:text-emerald-400' : d.score >= 70 ? 'text-indigo-600 dark:text-indigo-400' : d.score >= 50 ? 'text-amber-500 dark:text-amber-400' : 'text-red-500 dark:text-red-400'
                            }`}
                          >
                            {d.score}/100
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                  <div className="p-6 border-b border-slate-100 dark:border-slate-800">
                    <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">Manually Tracked Domains</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      A personal reminder list of URLs you plan to test. Kept for this session only.
                    </p>
                  </div>
                  <div className="p-6 space-y-4">
                    <div className="space-y-3">
                      <AnimatePresence initial={false}>
                        {trackedDomains.map((domain) => (
                          <motion.div
                            key={domain.id}
                            initial={{ opacity: 0, height: 0, y: -10 }}
                            animate={{ opacity: 1, height: 'auto', y: 0 }}
                            exit={{ opacity: 0, height: 0, y: 10 }}
                            transition={{ type: 'spring', duration: 0.3 }}
                            className="flex items-center justify-between p-4 border border-slate-200 dark:border-slate-700 rounded-xl hover:border-slate-300 dark:hover:border-slate-600 transition-colors bg-white dark:bg-slate-800 overflow-hidden"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-10 h-10 rounded-lg flex items-center justify-center text-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 shrink-0">
                                <i className="ph ph-git-branch"></i>
                              </div>
                              <span className="font-bold text-slate-950 dark:text-slate-100 text-sm block truncate">{domain.url}</span>
                            </div>
                            <button
                              onClick={() => handleDeleteDomain(domain.id, domain.url)}
                              className="text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 p-2 transition-colors cursor-pointer shrink-0"
                            >
                              <i className="ph ph-trash text-lg"></i>
                            </button>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                      {trackedDomains.length === 0 && (
                        <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-4">No domains added yet.</p>
                      )}
                    </div>

                    <form onSubmit={handleAddDomain} className="pt-2">
                      <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Add a URL to remember</label>
                      <div className="flex gap-2">
                        <input
                          type="url"
                          required
                          placeholder="https://dev.example.com"
                          value={newDomainUrl}
                          onChange={(e) => setNewDomainUrl(e.target.value)}
                          className="flex-1 px-4 py-2.5 border border-slate-200 dark:border-slate-800 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:outline-none focus:border-indigo-500 text-sm bg-slate-50/50 dark:bg-slate-950 text-slate-800 dark:text-white"
                        />
                        <button type="submit" className="bg-indigo-500 hover:bg-indigo-600 text-white px-5 py-2.5 rounded-lg font-medium text-sm transition-colors shadow-sm shrink-0">
                          Add
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'automation' && (
              <motion.div
                key="automation"
                initial={{ opacity: 0, x: 15 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -15 }}
                transition={{ duration: 0.18 }}
                className="space-y-6"
              >
                {!user ? (
                  <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                    <SignInNotice what="continuous monitoring" />
                  </div>
                ) : (
                  <>
                    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                      <div className="p-6 border-b border-slate-100 dark:border-slate-800">
                        <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">Continuous Monitoring</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                          Automatically runs Phase 1 (crawl, links, Lighthouse) + Phase 2 (accessibility, SEO, visual
                          regression, cross-browser, performance) on a schedule. Runs are real — a scheduler on the
                          backend checks every minute and queues a scan when a monitor is due. Works with live URLs or
                          http://localhost addresses.
                        </p>
                      </div>
                      <form onSubmit={handleCreateMonitor} className="p-6 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row gap-3">
                        <textarea
                          required
                          rows={2}
                          placeholder={'https://example.com\nhttp://localhost:3000\n(one URL per line — add as many as you like)'}
                          value={newMonitorUrls}
                          onChange={(e) => setNewMonitorUrls(e.target.value)}
                          className="flex-1 px-4 py-2.5 border border-slate-200 dark:border-slate-800 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:outline-none focus:border-indigo-500 text-sm bg-slate-50/50 dark:bg-slate-950 text-slate-800 dark:text-white resize-y"
                        />
                        <div className="flex sm:flex-col gap-3 shrink-0">
                          <select
                            value={newMonitorFrequency}
                            onChange={(e) => setNewMonitorFrequency(e.target.value as MonitorFrequency)}
                            className="px-4 py-2.5 border border-slate-200 dark:border-slate-800 rounded-lg text-sm bg-slate-50/50 dark:bg-slate-950 text-slate-800 dark:text-white"
                          >
                            <option value="hourly">Every hour</option>
                            <option value="daily">Every day</option>
                            <option value="weekly">Every week</option>
                          </select>
                          <button
                            type="submit"
                            disabled={monitorSaving}
                            className="bg-indigo-500 hover:bg-indigo-600 disabled:opacity-60 text-white px-5 py-2.5 rounded-lg font-medium text-sm transition-colors shadow-sm whitespace-nowrap"
                          >
                            {monitorSaving ? 'Creating...' : 'Create Monitor'}
                          </button>
                        </div>
                      </form>

                      <div className="p-6 space-y-3">
                        {monitorsLoading && <p className="text-sm text-slate-400 text-center py-4">Loading monitors...</p>}
                        {!monitorsLoading && monitors.length === 0 && (
                          <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-6">
                            No monitors yet — add a domain above to start continuous scanning.
                          </p>
                        )}
                        {monitors.map((m) => (
                          <div key={m.id} className="p-4 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800">
                            <div className="flex items-center justify-between gap-3 flex-wrap">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-bold text-slate-950 dark:text-slate-100 text-sm truncate">{m.url}</span>
                                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-900 text-slate-500 dark:text-slate-400">
                                    {m.frequency}
                                  </span>
                                  {m.lastTestId && !m.lastRunReconciled && (
                                    <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">
                                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                                      Scanning now
                                    </span>
                                  )}
                                  {m.lastRunHadCriticalIssues && (
                                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400">
                                      Critical issues found
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                  Last run {m.lastRunAt ? timeAgo(m.lastRunAt) : 'never'} · Next run {timeAgo(new Date(m.nextRunAt).toISOString())}
                                </p>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <button
                                  onClick={() => runMonitorNow(m)}
                                  className="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100/60 dark:hover:bg-indigo-900/50 font-bold text-xs rounded-lg transition-colors"
                                >
                                  Run Now
                                </button>
                                <button
                                  type="button"
                                  onClick={() => toggleMonitor(m)}
                                  className={`w-11 h-6 rounded-full p-0.5 transition-colors relative focus:outline-none ${m.enabled ? 'bg-indigo-500' : 'bg-slate-200 dark:bg-slate-700'}`}
                                  title={m.enabled ? 'Enabled' : 'Disabled'}
                                >
                                  <motion.div
                                    className="w-5 h-5 bg-white rounded-full shadow-sm"
                                    animate={{ x: m.enabled ? 20 : 0 }}
                                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                                  />
                                </button>
                                <button onClick={() => deleteMonitor(m)} className="text-slate-400 hover:text-red-500 p-1.5 transition-colors">
                                  <i className="ph ph-trash text-lg"></i>
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </motion.div>
            )}

            {activeTab === 'policies' && (
              <motion.div
                key="policies"
                initial={{ opacity: 0, x: 15 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -15 }}
                transition={{ duration: 0.18 }}
                className="space-y-6"
              >
                {!user ? (
                  <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                    <SignInNotice what="testing policies" />
                  </div>
                ) : (
                  <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-slate-100 dark:border-slate-800">
                      <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">Custom Testing Policies</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        Set a min–max passing range for each score. A scan graded against this policy only{' '}
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">Passes</span> when every
                        one of Overall, Performance, Accessibility, SEO, and Best Practices falls inside its range —
                        otherwise it&apos;s a <span className="font-semibold text-red-500 dark:text-red-400">Fail</span>.
                        Create named policies here, then pick one when starting a new test (or leave the active one as
                        the default).
                      </p>
                    </div>

                    <form onSubmit={handleCreatePolicy} className="p-6 border-b border-slate-100 dark:border-slate-800 space-y-4">
                      <input
                        type="text"
                        required
                        placeholder="Policy name (e.g. Production Gate)"
                        value={newPolicyName}
                        onChange={(e) => setNewPolicyName(e.target.value)}
                        className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-800 rounded-lg text-sm bg-slate-50/50 dark:bg-slate-950 text-slate-800 dark:text-white"
                      />
                      <div className="space-y-2.5">
                        {SCORE_RANGE_KEYS.map(({ key, label }) => (
                          <div key={key} className="flex items-center gap-3">
                            <label className="w-28 shrink-0 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                              {label}
                            </label>
                            <input
                              type="number"
                              min={0}
                              max={100}
                              required
                              placeholder="Min"
                              value={newPolicyRanges[key].min}
                              onChange={(e) =>
                                setNewPolicyRanges((prev) => ({
                                  ...prev,
                                  [key]: { ...prev[key], min: Number(e.target.value) },
                                }))
                              }
                              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-lg text-sm bg-slate-50/50 dark:bg-slate-950 text-slate-800 dark:text-white"
                            />
                            <span className="text-slate-400 text-xs shrink-0">to</span>
                            <input
                              type="number"
                              min={0}
                              max={100}
                              required
                              placeholder="Max"
                              value={newPolicyRanges[key].max}
                              onChange={(e) =>
                                setNewPolicyRanges((prev) => ({
                                  ...prev,
                                  [key]: { ...prev[key], max: Number(e.target.value) },
                                }))
                              }
                              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-lg text-sm bg-slate-50/50 dark:bg-slate-950 text-slate-800 dark:text-white"
                            />
                          </div>
                        ))}
                      </div>
                      <div className="flex justify-end">
                        <button
                          type="submit"
                          disabled={policySaving}
                          className="bg-indigo-500 hover:bg-indigo-600 disabled:opacity-60 text-white px-5 py-2.5 rounded-lg font-medium text-sm transition-colors shadow-sm shrink-0"
                        >
                          {policySaving ? 'Creating...' : 'Create Policy'}
                        </button>
                      </div>
                    </form>

                    <div className="p-6 space-y-3">
                      {policiesLoading && <p className="text-sm text-slate-400 text-center py-4">Loading policies...</p>}
                      {!policiesLoading && policies.length === 0 && (
                        <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-6">
                          No policies yet — create one to select it when starting a test, or leave tests ungraded.
                        </p>
                      )}
                      {policies.map((p) => (
                        <div key={p.id} className="p-4 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800">
                          <div className="flex items-center justify-between gap-3 flex-wrap">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-950 dark:text-slate-100 text-sm">{p.name}</span>
                                {p.active && (
                                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
                                    Active
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                {SCORE_RANGE_KEYS.map(
                                  ({ key, label }) => `${label} ${p.scoreRanges[key].min}-${p.scoreRanges[key].max}`
                                ).join(' · ')}
                                {p.active && ' · default for tests that don’t explicitly pick one'}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {!p.active && (
                                <button
                                  onClick={() => activatePolicy(p)}
                                  className="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100/60 dark:hover:bg-indigo-900/50 font-bold text-xs rounded-lg transition-colors"
                                >
                                  Set Active
                                </button>
                              )}
                              <button onClick={() => deletePolicy(p)} className="text-slate-400 hover:text-red-500 p-1.5 transition-colors">
                                <i className="ph ph-trash text-lg"></i>
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === 'branding' && (
              <motion.div
                key="branding"
                initial={{ opacity: 0, x: 15 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -15 }}
                transition={{ duration: 0.18 }}
                className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden"
              >
                {!user ? (
                  <SignInNotice what="branding" />
                ) : (
                  <>
                    <div className="p-6 border-b border-slate-100 dark:border-slate-800">
                      <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">White-label Reports</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        Your logo and header text form a banner (divided by a rule) at the top of exported PDF/DOCX
                        reports, with your footer text (divided by a rule) at the bottom.
                      </p>
                    </div>
                    <form onSubmit={handleSaveBranding} className="p-6 space-y-5">
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Primary Color</label>
                        <div className="flex items-center gap-2 max-w-xs">
                          <input
                            type="color"
                            value={brandingForm.primaryColor}
                            onChange={(e) => setBrandingForm((f) => ({ ...f, primaryColor: e.target.value }))}
                            className="w-11 h-10 rounded-lg border border-slate-200 dark:border-slate-800 cursor-pointer bg-transparent"
                          />
                          <input
                            type="text"
                            value={brandingForm.primaryColor}
                            onChange={(e) => setBrandingForm((f) => ({ ...f, primaryColor: e.target.value }))}
                            className="flex-1 px-4 py-2.5 border border-slate-200 dark:border-slate-800 rounded-lg text-sm bg-slate-50/50 dark:bg-slate-950 text-slate-800 dark:text-white"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                          Header Text
                        </label>
                        <input
                          type="text"
                          placeholder="Shown on the right of the logo, in exported reports"
                          value={brandingForm.headerText}
                          onChange={(e) => setBrandingForm((f) => ({ ...f, headerText: e.target.value }))}
                          className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-800 rounded-lg text-sm bg-slate-50/50 dark:bg-slate-950 text-slate-800 dark:text-white"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                            Header Font Size (pt)
                          </label>
                          <input
                            type="number"
                            min={6}
                            max={32}
                            value={brandingForm.headerFontSize}
                            onChange={(e) => setBrandingForm((f) => ({ ...f, headerFontSize: Number(e.target.value) }))}
                            className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-800 rounded-lg text-sm bg-slate-50/50 dark:bg-slate-950 text-slate-800 dark:text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                            Footer Font Size (pt)
                          </label>
                          <input
                            type="number"
                            min={6}
                            max={32}
                            value={brandingForm.footerFontSize}
                            onChange={(e) => setBrandingForm((f) => ({ ...f, footerFontSize: Number(e.target.value) }))}
                            className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-800 rounded-lg text-sm bg-slate-50/50 dark:bg-slate-950 text-slate-800 dark:text-white"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Footer Text</label>
                        <textarea
                          value={brandingForm.footerText}
                          onChange={(e) => setBrandingForm((f) => ({ ...f, footerText: e.target.value }))}
                          rows={2}
                          className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-800 rounded-lg text-sm bg-slate-50/50 dark:bg-slate-950 text-slate-800 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Logo</label>
                        <div className="flex items-center gap-4">
                          <div className="w-16 h-16 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center justify-center overflow-hidden shrink-0">
                            {logoPreview || branding?.logoUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={logoPreview ?? `${API_ORIGIN}${branding?.logoUrl}`}
                                alt="Logo preview"
                                className="w-full h-full object-contain"
                              />
                            ) : (
                              <i className="ph ph-image text-2xl text-slate-300 dark:text-slate-700"></i>
                            )}
                          </div>
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/svg+xml"
                            onChange={(e) => e.target.files?.[0] && handleLogoFile(e.target.files[0])}
                            className="text-sm text-slate-600 dark:text-slate-300"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4 mt-3 max-w-xs">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                              Logo Width (px)
                            </label>
                            <input
                              type="number"
                              min={16}
                              max={400}
                              value={brandingForm.logoWidth}
                              onChange={(e) => setBrandingForm((f) => ({ ...f, logoWidth: Number(e.target.value) }))}
                              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-lg text-sm bg-slate-50/50 dark:bg-slate-950 text-slate-800 dark:text-white"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                              Logo Height (px)
                            </label>
                            <input
                              type="number"
                              min={16}
                              max={400}
                              value={brandingForm.logoHeight}
                              onChange={(e) => setBrandingForm((f) => ({ ...f, logoHeight: Number(e.target.value) }))}
                              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-lg text-sm bg-slate-50/50 dark:bg-slate-950 text-slate-800 dark:text-white"
                            />
                          </div>
                        </div>
                      </div>
                      <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
                        <button
                          type="submit"
                          disabled={brandingSaving}
                          className="bg-indigo-500 hover:bg-indigo-600 disabled:opacity-60 text-white px-5 py-2 rounded-lg font-medium text-sm transition-colors shadow-sm"
                        >
                          {brandingSaving ? 'Saving...' : 'Save Branding'}
                        </button>
                      </div>
                    </form>
                  </>
                )}
              </motion.div>
            )}

            {activeTab === 'team' && (
              <motion.div
                key="team"
                initial={{ opacity: 0, x: 15 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -15 }}
                transition={{ duration: 0.18 }}
                className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden"
              >
                {!user ? (
                  <SignInNotice what="your team" />
                ) : (
                  <>
                    <div className="p-6 border-b border-slate-100 dark:border-slate-800">
                      <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">Team Members</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        Invite anyone by email. Existing accounts are added immediately; new addresses get an email
                        invite to join. The earliest registered account is the workspace owner.
                      </p>
                    </div>

                    {canManageTeam && (
                      <form onSubmit={handleInvite} className="p-6 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row gap-3">
                        <input
                          type="email"
                          required
                          placeholder="teammate@company.com"
                          value={inviteEmail}
                          onChange={(e) => setInviteEmail(e.target.value)}
                          className="flex-1 px-4 py-2.5 border border-slate-200 dark:border-slate-800 rounded-lg text-sm bg-slate-50/50 dark:bg-slate-950 text-slate-800 dark:text-white"
                        />
                        <select
                          value={inviteRole}
                          onChange={(e) => setInviteRole(e.target.value as TeamRole)}
                          className="px-4 py-2.5 border border-slate-200 dark:border-slate-800 rounded-lg text-sm bg-slate-50/50 dark:bg-slate-950 text-slate-800 dark:text-white"
                        >
                          <option value="viewer">Viewer</option>
                          <option value="editor">Editor</option>
                          <option value="admin">Admin</option>
                        </select>
                        <button
                          type="submit"
                          disabled={inviteSaving}
                          className="bg-indigo-500 hover:bg-indigo-600 disabled:opacity-60 text-white px-5 py-2.5 rounded-lg font-medium text-sm transition-colors shadow-sm shrink-0"
                        >
                          {inviteSaving ? 'Adding...' : 'Add to Team'}
                        </button>
                      </form>
                    )}

                    <div className="p-6 space-y-3">
                      {teamLoading && <p className="text-sm text-slate-400 text-center py-4">Loading team...</p>}
                      {!teamLoading &&
                        teamMembers.map((m) => (
                          <div key={m.id} className="flex items-center justify-between gap-3 p-4 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 flex-wrap">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-950 dark:text-slate-100 text-sm truncate">{m.name || m.email}</span>
                                {m.id === user.id && (
                                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-900 text-slate-500 dark:text-slate-400">You</span>
                                )}
                                {m.teamStatus === 'invited' && (
                                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400">Pending</span>
                                )}
                              </div>
                              <p className="text-xs text-slate-500 dark:text-slate-400">{m.email}</p>
                              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                                {m.teamStatus === 'invited'
                                  ? `Invited ${timeAgo(m.createdAt)} · awaiting signup`
                                  : `${m.testCount} test${m.testCount === 1 ? '' : 's'} run · joined ${formatDate(m.createdAt)}${m.lastActive ? ` · last active ${timeAgo(m.lastActive)}` : ''}`}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {canManageTeam && m.role !== 'owner' ? (
                                <select
                                  value={m.role}
                                  onChange={(e) => changeRole(m.id, e.target.value as TeamRole)}
                                  className="px-3 py-1.5 border border-slate-200 dark:border-slate-800 rounded-lg text-xs bg-slate-50/50 dark:bg-slate-950 text-slate-800 dark:text-white"
                                >
                                  <option value="viewer">Viewer</option>
                                  <option value="editor">Editor</option>
                                  <option value="admin">Admin</option>
                                </select>
                              ) : (
                                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">
                                  {m.role}
                                </span>
                              )}
                              {canManageTeam && m.role !== 'owner' && (
                                <button onClick={() => removeMember(m.id)} className="text-slate-400 hover:text-red-500 p-1.5 transition-colors">
                                  <i className="ph ph-trash text-lg"></i>
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                    </div>
                  </>
                )}
              </motion.div>
            )}

            {activeTab === 'integrations' && (
              <motion.div
                key="integrations"
                initial={{ opacity: 0, x: 15 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -15 }}
                transition={{ duration: 0.18 }}
                className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden"
              >
                <div className="p-6 border-b border-slate-100 dark:border-slate-800">
                  <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">Connected Apps & Webhooks</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Connect the QA crawler with repository pipelines and communication channels. (Not part of the Phase 1
                    backend yet.)
                  </p>
                </div>
                <div className="p-6 space-y-4">
                  <div className="flex items-center justify-between p-5 border border-slate-200 dark:border-slate-700 rounded-xl hover:shadow-sm transition-all bg-white dark:bg-slate-800">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-orange-50 dark:bg-orange-950/40 text-orange-500 dark:text-orange-400 flex items-center justify-center text-2xl">
                        <i className="ph ph-slack-logo"></i>
                      </div>
                      <div>
                        <span className="font-bold text-slate-950 dark:text-slate-100 text-sm block">Slack Workspace Notifications</span>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Post test scores and regression summaries into QA channels.</p>
                      </div>
                    </div>
                    <button
                      onClick={() => showToast('Slack integration is planned for a later phase', 'info')}
                      className="px-4 py-2 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100/60 dark:hover:bg-indigo-900/50 font-bold text-xs rounded-lg transition-colors cursor-pointer"
                    >
                      Configure
                    </button>
                  </div>

                  <div className="flex items-center justify-between p-5 border border-slate-200 dark:border-slate-700 rounded-xl hover:shadow-sm transition-all bg-white dark:bg-slate-800">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-slate-900 dark:bg-slate-950 text-white flex items-center justify-center text-2xl">
                        <i className="ph ph-github-logo"></i>
                      </div>
                      <div>
                        <span className="font-bold text-slate-950 dark:text-slate-100 text-sm block">GitHub CI/CD Actions Plugin</span>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Run a Phase 1 audit crawl on every pull request.</p>
                      </div>
                    </div>
                    <button
                      onClick={() => showToast('GitHub Actions integration is planned for a later phase', 'info')}
                      className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 font-bold text-xs rounded-lg transition-colors cursor-pointer"
                    >
                      Connect
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};
