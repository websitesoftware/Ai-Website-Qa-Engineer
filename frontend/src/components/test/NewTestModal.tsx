
'use client';
import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { PHASE2_MODULES, BackendPolicy } from '../../lib/types';
import { api } from '../../lib/api';
import { useContent } from '../../context/ContentContext';

interface NewTestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartTest: (url: string, modules: string[], policyId?: string) => Promise<void>;
  // Fires once the exit animation has actually finished (not a guessed
  // delay) — callers can safely mount another "fixed inset-0" overlay only
  // after this, avoiding two backdrop-blur layers stacking at once.
  onExited?: () => void;
}

export const NewTestModal: React.FC<NewTestModalProps> = ({ isOpen, onClose, onStartTest, onExited }) => {
  const [isInitializing, setIsInitializing] = useState<boolean>(false);
  const [url, setUrl] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [selectedModules, setSelectedModules] = useState<string[]>([]);
  const [policies, setPolicies] = useState<BackendPolicy[]>([]);
  const [selectedPolicyId, setSelectedPolicyId] = useState<string>('');
  const modalTitle = useContent('tests.newTestModal.title', { text: 'Run New AI Test' });

  useEffect(() => {
    if (!isOpen) return;
    api.policies.list().then(setPolicies).catch(() => setPolicies([]));
  }, [isOpen]);

  const toggleModule = (id: string) => {
    setSelectedModules((prev) => (prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;

    setIsInitializing(true);
    setError(null);
    try {
      await onStartTest(url, selectedModules, selectedPolicyId || undefined);
      setUrl('');
      setSelectedModules([]);
      setSelectedPolicyId('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start the test. Is the backend running?');
    } finally {
      setIsInitializing(false);
    }
  };

  return (
    <AnimatePresence onExitComplete={onExited}>
      {isOpen && (
        <motion.div
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden"
            initial={{ opacity: 0, y: 20, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 300, damping: 26 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">{modalTitle.text}</h3>
              <button onClick={onClose} className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                <i className="ph ph-x text-xl"></i>
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              {/* Modal Body */}
              <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
                {/* URL Input */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Target Website URL <span className="text-red-500 dark:text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <i className="ph ph-link absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 text-lg"></i>
                    <input
                      type="url"
                      placeholder="https://example.com"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-shadow bg-slate-50 dark:bg-slate-950 dark:text-white focus:bg-white dark:focus:bg-slate-950"
                      required
                    />
                  </div>
                  <AnimatePresence>
                    {error && (
                      <motion.p
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="text-xs text-red-500 dark:text-red-400 mt-2 flex items-center gap-1.5 overflow-hidden"
                      >
                        <i className="ph ph-warning-circle"></i> {error}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>

                {/* Test Configuration */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                    Test Configuration (Select modules to run)
                  </label>
                  <div className="space-y-3">
                    <label className="flex items-start gap-3 p-4 border border-blue-500 dark:border-blue-500 bg-blue-50/50 dark:bg-blue-950/30 rounded-xl cursor-pointer">
                      <input
                        type="checkbox"
                        checked
                        readOnly
                        className="mt-1 w-4 h-4 text-blue-500 border-slate-300 dark:border-slate-700 rounded focus:ring-blue-500"
                      />
                      <div>
                        <p className="font-semibold text-blue-600 dark:text-blue-400">Phase 1: Foundation Analysis (MVP)</p>
                        <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                          Crawling, Responsive checks, Broken links, Lighthouse, Console Errors.
                        </p>
                      </div>
                    </label>

                    {/* Phase 2 modules — opt-in */}
                    <div className="pt-1">
                      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
                        Phase 2: Intelligent QA (optional)
                      </p>
                      <div className="space-y-2">
                        {PHASE2_MODULES.map((mod) => {
                          const checked = selectedModules.includes(mod.id);
                          return (
                            <label
                              key={mod.id}
                              className={`flex items-start gap-3 p-3 border rounded-xl cursor-pointer transition-colors ${checked ? 'border-blue-400 dark:border-blue-500 bg-blue-50/40 dark:bg-blue-950/30' : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                                }`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleModule(mod.id)}
                                className="mt-1 w-4 h-4 text-blue-500 border-slate-300 dark:border-slate-700 rounded focus:ring-blue-500"
                              />
                              <div>
                                <p className="font-medium text-sm text-slate-800 dark:text-slate-200">{mod.label}</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{mod.description}</p>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Testing Policy */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Testing Policy (optional)
                  </label>
                  <select
                    value={selectedPolicyId}
                    onChange={(e) => setSelectedPolicyId(e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-800 rounded-xl text-sm bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
                  >
                    <option value="">No policy — default grading</option>
                    {policies.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                        {p.active ? ' (Active)' : ''}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1.5">
                    Passes only if Overall, Performance, Accessibility, SEO, and Best Practices each fall inside the
                    policy&apos;s configured range.
                  </p>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2.5 text-slate-600 dark:text-slate-300 font-medium hover:bg-slate-100 dark:hover:bg-slate-800/60 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isInitializing}
                  className={`bg-blue-500 hover:bg-blue-600 text-white px-6 py-2.5 rounded-lg font-medium transition-colors shadow-sm flex items-center gap-2 ${isInitializing ? 'opacity-80 cursor-not-allowed' : ''
                    }`}
                >
                  {isInitializing ? (
                    <>
                      <i className="ph ph-spinner-gap animate-spin text-lg"></i> Initializing AI...
                    </>
                  ) : (
                    <>
                      <i className="ph ph-play-circle text-lg"></i> Start Test
                    </>
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};