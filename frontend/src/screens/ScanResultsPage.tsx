'use client';
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ScanlinePhase1Report from './phase1page';
import { Phase2ResultsPage } from './Phase2ResultsPage';
import { DeviceLabPage } from './DeviceLabPage';
import { useContent } from '../context/ContentContext';

type ResultsTab = 'phase1' | 'phase2' | 'device-lab';

export const ScanResultsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ResultsTab>('phase1');

  const phase1Tab = useContent('scanResults.tab.phase1', { text: 'Phase 1 · Foundation', icon: 'ph-sparkle' });
  const phase2Tab = useContent('scanResults.tab.phase2', { text: 'Phase 2 · Intelligent QA', icon: 'ph-sparkle' });
  const deviceLabTab = useContent('scanResults.tab.deviceLab', { text: 'Device Lab', icon: 'ph-device-mobile' });

  const TABS: { id: ResultsTab; label: string; icon: string }[] = [
    { id: 'phase1', label: phase1Tab.text, icon: phase1Tab.icon },
    { id: 'phase2', label: phase2Tab.text, icon: phase2Tab.icon },
    { id: 'device-lab', label: deviceLabTab.text, icon: deviceLabTab.icon },
  ];

  return (
    <div className="space-y-6 animate-fade-in w-full">
      <div className="flex gap-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-1.5 w-full sm:w-fit relative overflow-x-auto">
        {TABS.map((tab) => {
          const isSelected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 shrink-0 whitespace-nowrap ${
                isSelected ? 'text-[#1C56C9] dark:text-blue-400 font-bold' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              {isSelected && (
                <motion.div
                  layoutId="activeScanResultsTabIndicator"
                  className="absolute inset-0 bg-white dark:bg-slate-700 shadow-sm rounded-lg -z-10"
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
          className={activeTab === 'device-lab' ? 'h-[75vh] min-h-140' : undefined}
        >
          {activeTab === 'phase1' && <ScanlinePhase1Report />}
          {activeTab === 'phase2' && <Phase2ResultsPage />}
          {activeTab === 'device-lab' && <DeviceLabPage />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
