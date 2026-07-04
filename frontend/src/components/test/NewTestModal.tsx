'use client';
import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

interface NewTestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartTest: (url: string) => Promise<void>;
}

export const NewTestModal: React.FC<NewTestModalProps> = ({ isOpen, onClose, onStartTest }) => {
  const [isInitializing, setIsInitializing] = useState<boolean>(false);
  const [url, setUrl] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;

    setIsInitializing(true);
    setError(null);
    try {
      await onStartTest(url);
      setUrl('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start the test. Is the backend running?');
    } finally {
      setIsInitializing(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden"
            initial={{ opacity: 0, y: 20, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 300, damping: 26 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="text-lg font-bold text-slate-900">Run New AI Test</h3>
              <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
                <i className="ph ph-x text-xl"></i>
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              {/* Modal Body */}
              <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
                {/* URL Input */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Target Website URL <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <i className="ph ph-link absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg"></i>
                    <input
                      type="url"
                      placeholder="https://example.com"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-shadow bg-slate-50 focus:bg-white"
                      required
                    />
                  </div>
                  <AnimatePresence>
                    {error && (
                      <motion.p
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="text-xs text-red-500 mt-2 flex items-center gap-1.5 overflow-hidden"
                      >
                        <i className="ph ph-warning-circle"></i> {error}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>

                {/* Test Configuration */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-3">
                    Test Configuration (Select modules to run)
                  </label>
                  <div className="space-y-3">
                    <label className="flex items-start gap-3 p-4 border border-indigo-500 bg-indigo-50/50 rounded-xl cursor-pointer">
                      <input
                        type="checkbox"
                        defaultChecked
                        className="mt-1 w-4 h-4 text-indigo-500 border-slate-300 rounded focus:ring-indigo-500"
                      />
                      <div>
                        <p className="font-semibold text-indigo-600">Phase 1: Foundation Analysis (MVP)</p>
                        <p className="text-xs text-slate-600 mt-1">
                          Crawling, Responsive checks, Broken links, Lighthouse, Console Errors.
                        </p>
                      </div>
                    </label>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2.5 text-slate-600 font-medium hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isInitializing}
                  className={`bg-indigo-500 hover:bg-indigo-600 text-white px-6 py-2.5 rounded-lg font-medium transition-colors shadow-sm flex items-center gap-2 ${
                    isInitializing ? 'opacity-80 cursor-not-allowed' : ''
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
