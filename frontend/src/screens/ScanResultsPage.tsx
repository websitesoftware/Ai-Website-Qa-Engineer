'use client';
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ScanlinePhase1Report from './phase1page';
import { Phase2ResultsPage } from './Phase2ResultsPage';

type ResultsTab = 'phase1' | 'phase2';

const TABS: { id: ResultsTab; label: string; icon: string }[] = [
  { id: 'phase1', label: 'Phase 1 · Foundation', icon: 'ph-sparkle' },
  { id: 'phase2', label: 'Phase 2 · Intelligent QA', icon: 'ph-sparkle' },
];

export const ScanResultsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ResultsTab>('phase1');

  return (
    <div className="space-y-6 animate-fade-in w-full">
      <div className="flex gap-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-1.5 w-fit relative">
        {TABS.map((tab) => {
          const isSelected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 ${
                isSelected ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              {isSelected && (
                <motion.div
                  layoutId="activeScanResultsTabIndicator"
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

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.18 }}
        >
          {activeTab === 'phase1' && <ScanlinePhase1Report />}
          {activeTab === 'phase2' && <Phase2ResultsPage />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
