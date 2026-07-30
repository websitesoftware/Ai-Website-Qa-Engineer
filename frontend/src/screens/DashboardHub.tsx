'use client';
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DashboardView } from './Dashboard';
import { TeamDashboardPage } from './TeamDashboardPage';
import { AnalyticsPage } from './AnalyticsPage';

type DashboardTab = 'overview' | 'team' | 'trends';

const TABS: { id: DashboardTab; label: string; icon: string }[] = [
  { id: 'overview', label: 'Overview', icon: 'ph-squares-four' },
  { id: 'team', label: 'Team', icon: 'ph-users-three' },
  { id: 'trends', label: 'Trends', icon: 'ph-chart-line-up' },
];

export const DashboardHub: React.FC = () => {
  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');

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
                  layoutId="activeDashboardTabIndicator"
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
        >
          {activeTab === 'overview' && <DashboardView />}
          {activeTab === 'team' && <TeamDashboardPage />}
          {activeTab === 'trends' && <AnalyticsPage />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
