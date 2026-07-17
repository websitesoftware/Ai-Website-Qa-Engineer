'use client';
import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQAData } from '../context/QADataContext';
import { useToast } from '../context/ToastContext';
import { formatDate } from '../lib/format';

type SettingsTab = 'general' | 'domains' | 'automation' | 'integrations';

interface TrackedDomain {
  id: string;
  url: string;
}

export const SettingsPage: React.FC = () => {
  const { tests } = useQAData();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<SettingsTab>('general');

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
  const [testFrequency, setTestFrequency] = useState('daily');
  const [criticalAlerts, setCriticalAlerts] = useState(true);
  const [digestReports, setDigestReports] = useState(true);

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

  return (
    <div className="space-y-6 animate-fade-in w-full">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Settings</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Configure target domains, testing frequency, alerts, and team profiles.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        {/* Sidebar tabs */}
        <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-1">
          {(
            [
              { id: 'general', label: 'General Profile', icon: 'ph-user-circle' },
              { id: 'domains', label: 'Target Domains', icon: 'ph-globe' },
              { id: 'automation', label: 'Automation Schedules', icon: 'ph-alarm' },
              { id: 'integrations', label: 'Integrations', icon: 'ph-plugs' },
            ] as const
          ).map((tab) => {
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
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Manage personal user settings and organization identity details.</p>
                </div>
                <div className="p-6 space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">First Name</label>
                      <input type="text" defaultValue="Rajat" className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-800 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:outline-none focus:border-indigo-500 text-sm bg-slate-50/50 dark:bg-slate-950 text-slate-800 dark:text-white" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Last Name</label>
                      <input type="text" defaultValue="Sharma" className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-800 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:outline-none focus:border-indigo-500 text-sm bg-slate-50/50 dark:bg-slate-950 text-slate-800 dark:text-white" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Corporate Email Address</label>
                    <input type="email" defaultValue="rajat@websitesoft.co.uk" className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-800 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:outline-none focus:border-indigo-500 text-sm bg-slate-50/50 dark:bg-slate-950 text-slate-800 dark:text-white" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Organization Name</label>
                    <input type="text" defaultValue="WebsiteSoft" className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-800 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:outline-none focus:border-indigo-500 text-sm bg-slate-50/50 dark:bg-slate-950 text-slate-800 dark:text-white" />
                  </div>
                </div>
                <div className="px-6 py-4 bg-slate-50/50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                  <button
                    onClick={() => showToast('Profile settings saved for this session', 'success')}
                    className="bg-indigo-500 hover:bg-indigo-600 text-white px-5 py-2 rounded-lg font-medium text-sm transition-colors shadow-sm"
                  >
                    Save Changes
                  </button>
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
                className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden"
              >
                <div className="p-6 border-b border-slate-100 dark:border-slate-800">
                  <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">Automation Schedules</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Fine-tune crawling schedules, periodic audits, and automated notifications. (Scheduling isn&apos;t wired to the
                    Phase 1 backend yet — this is where it will live.)
                  </p>
                </div>
                <div className="p-6 space-y-6">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Continuous Test Frequency</label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <label className={`p-4 border rounded-xl cursor-pointer block transition-all ${testFrequency === 'daily' ? 'border-indigo-500 bg-indigo-50/40 dark:bg-indigo-950/30' : 'border-slate-200 dark:border-slate-700 hover:border-indigo-500/40'}`}>
                        <input type="radio" name="freq" checked={testFrequency === 'daily'} onChange={() => setTestFrequency('daily')} className="w-4 h-4 text-indigo-600" />
                        <span className="font-semibold text-slate-950 dark:text-slate-100 text-sm block mt-2">Daily Audit</span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">Crawls every 24 hrs at midnight</span>
                      </label>
                      <label className={`p-4 border rounded-xl cursor-pointer block transition-all ${testFrequency === 'weekly' ? 'border-indigo-500 bg-indigo-50/40 dark:bg-indigo-950/30' : 'border-slate-200 dark:border-slate-700 hover:border-indigo-500/40'}`}>
                        <input type="radio" name="freq" checked={testFrequency === 'weekly'} onChange={() => setTestFrequency('weekly')} className="w-4 h-4 text-indigo-600" />
                        <span className="font-semibold text-slate-950 dark:text-slate-100 text-sm block mt-2">Weekly Pipeline</span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">Every Sunday at 3:00 AM UTC</span>
                      </label>
                      <label className="p-4 border border-slate-200 dark:border-slate-700 rounded-xl block opacity-50 cursor-not-allowed">
                        <input type="radio" disabled className="w-4 h-4 text-indigo-600" />
                        <span className="font-semibold text-slate-900 dark:text-slate-100 text-sm block mt-2">Real-time Push</span>
                        <span className="text-xs text-indigo-600 dark:text-indigo-400 font-bold">PRO PLAN ONLY</span>
                      </label>
                    </div>
                  </div>

                  <div className="space-y-4 pt-2">
                    <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Automated Notification Rules</h4>

                    <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg">
                      <div>
                        <span className="text-sm font-semibold text-slate-950 dark:text-slate-100 block">Alert on Critical regressions</span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">Send instant alerts via Slack/Email on priority 1 issues.</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setCriticalAlerts(!criticalAlerts)}
                        className={`w-11 h-6 rounded-full p-0.5 transition-colors relative focus:outline-none ${criticalAlerts ? 'bg-indigo-500' : 'bg-slate-200 dark:bg-slate-700'}`}
                      >
                        <motion.div
                          className="w-5 h-5 bg-white rounded-full shadow-sm"
                          animate={{ x: criticalAlerts ? 20 : 0 }}
                          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                        />
                      </button>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg">
                      <div>
                        <span className="text-sm font-semibold text-slate-950 dark:text-slate-100 block">Digest Summary Reports</span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">Send a weekly overview report to your inbox.</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setDigestReports(!digestReports)}
                        className={`w-11 h-6 rounded-full p-0.5 transition-colors relative focus:outline-none ${digestReports ? 'bg-indigo-500' : 'bg-slate-200 dark:bg-slate-700'}`}
                      >
                        <motion.div
                          className="w-5 h-5 bg-white rounded-full shadow-sm"
                          animate={{ x: digestReports ? 20 : 0 }}
                          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                        />
                      </button>
                    </div>
                  </div>
                </div>
                <div className="px-6 py-4 bg-slate-50/50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                  <button
                    onClick={() => showToast('Schedule preferences saved for this session', 'success')}
                    className="bg-indigo-500 hover:bg-indigo-600 text-white px-5 py-2 rounded-lg font-medium text-sm transition-colors shadow-sm"
                  >
                    Save Rules
                  </button>
                </div>
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