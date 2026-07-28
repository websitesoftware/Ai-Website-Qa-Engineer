'use client';
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { IssuesPage } from './IssuesPage';
import { AIAutomationPage } from './AIAutomationPage';
import { useContent } from '../context/ContentContext';

type AutomationTab = 'issues' | 'ai-fixes';

export const AutomationPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AutomationTab>('issues');

  const issuesTab = useContent('automation.tab.issues', { text: 'Issue Tracker', icon: 'ph-flag' });
  const aiFixesTab = useContent('automation.tab.aiFixes', { text: 'AI Fixes', icon: 'ph-robot' });

  const TABS: { id: AutomationTab; label: string; icon: string }[] = [
    { id: 'issues', label: issuesTab.text, icon: issuesTab.icon },
    { id: 'ai-fixes', label: aiFixesTab.text, icon: aiFixesTab.icon },
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
                isSelected ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              {isSelected && (
                <motion.div
                  layoutId="activeAutomationTabIndicator"
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
          {activeTab === 'issues' && <IssuesPage />}
          {activeTab === 'ai-fixes' && <AIAutomationPage />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
