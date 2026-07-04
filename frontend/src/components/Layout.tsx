'use client';

import React from 'react';
import { useQAData } from '../context/QADataContext';
import { ThemeToggle } from './ThemeToggle';
import { useTheme } from '../context/ThemeContext';

export type TabType =
  | 'Dashboard'
  | 'Tests'
  | 'Reports'
  | 'Issues'
  | 'Settings';

interface LayoutProps {
  children: React.ReactNode;
  currentUser?: string;
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  onNewTestClick: () => void;
}

export const Layout: React.FC<LayoutProps> = ({
  children,
  currentUser = 'Rajat',
  activeTab,
  setActiveTab,
  onNewTestClick,
}) => {
  const { error } = useQAData();
  const { resolvedTheme } = useTheme();

  const navItems = [
    { label: 'Dashboard' as TabType, icon: 'ph-squares-four' },
    { label: 'Tests' as TabType, icon: 'ph-check-circle' },
    { label: 'Reports' as TabType, icon: 'ph-chart-bar' },
    { label: 'Issues' as TabType, icon: 'ph-flag' },
    { label: 'Settings' as TabType, icon: 'ph-gear' },
  ];

  return (
    <div
      className={`h-screen overflow-hidden flex transition-all duration-300 ${resolvedTheme === 'dark'
        ? 'bg-slate-950 text-white'
        : 'bg-[#F8FAFC] text-slate-800'
        }`}
    >
      {/* Sidebar */}

      <aside
        className={`w-64 h-full hidden md:flex flex-col shrink-0 transition-all duration-300
        ${resolvedTheme === 'dark'
            ? 'bg-slate-900 border-r border-slate-800'
            : 'bg-white border-r border-slate-200'
          }`}
      >
        <div
          className={`h-20 flex items-center px-6 border-b
          ${resolvedTheme === 'dark'
              ? 'border-slate-800'
              : 'border-slate-100'
            }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold text-xl">
              Q
            </div>

            <div>
              <h1
                className={`font-bold ${resolvedTheme === 'dark'
                  ? 'text-white'
                  : 'text-slate-900'
                  }`}
              >
                AI QA Engineer
              </h1>

              <p
                className={`text-xs ${resolvedTheme === 'dark'
                  ? 'text-slate-400'
                  : 'text-slate-500'
                  }`}
              >
                Website Assistant
              </p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
          {navItems.map((item) => (
            <button
              key={item.label}
              onClick={() => setActiveTab(item.label)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all

              ${activeTab === item.label
                  ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600'
                  : resolvedTheme === 'dark'
                    ? 'text-slate-300 hover:bg-slate-800'
                    : 'text-slate-600 hover:bg-slate-50'
                }
              `}
            >
              <i className={`ph ${item.icon} text-xl`} />
              {item.label}
            </button>
          ))}
        </nav>

        <div
          className={`px-6 py-4 border-t flex items-center gap-2 text-xs
          ${resolvedTheme === 'dark'
              ? 'border-slate-800'
              : 'border-slate-100'
            }`}
        >
          <span
            className={`w-2 h-2 rounded-full ${error
              ? 'bg-red-500'
              : 'bg-emerald-500 animate-pulse'
              }`}
          />

          <span
            className={
              error
                ? 'text-red-500'
                : resolvedTheme === 'dark'
                  ? 'text-slate-400'
                  : 'text-slate-500'
            }
          >
            {error ? 'Backend Offline' : 'Backend Connected'}
          </span>
        </div>
      </aside>
      {/* ================= Main Content ================= */}

      <main
        className={`flex-1 flex flex-col h-full overflow-hidden transition-all duration-300 ${resolvedTheme === 'dark'
          ? 'bg-slate-950'
          : 'bg-[#F8FAFC]'
          }`}
      >
        {/* Header */}

        <header
          className={`h-20 px-8 flex items-center justify-between shrink-0 transition-all duration-300
          ${resolvedTheme === 'dark'
              ? 'border-b border-slate-800'
              : 'border-b border-slate-200'
            }`}
        >
          {/* Welcome */}

          <div>
            <h2
              className={`text-2xl font-bold ${resolvedTheme === 'dark'
                ? 'text-white'
                : 'text-slate-900'
                }`}
            >
              Welcome back, {currentUser} 👋
            </h2>

            <p
              className={`text-sm mt-1 ${resolvedTheme === 'dark'
                ? 'text-slate-400'
                : 'text-slate-500'
                }`}
            >
              Here's the current QA and performance status of your
              websites.
            </p>
          </div>

          {/* Right Side */}

          <div className="flex items-center gap-4">



            {/* Theme Switch */}

            <ThemeToggle />

          </div>
        </header>

        {/* ================= Dashboard Body ================= */}

        <div
          className={`flex-1 overflow-y-auto px-8 py-6 space-y-6 transition-all duration-300 ${resolvedTheme === 'dark'
            ? 'bg-slate-950'
            : 'bg-[#F8FAFC]'
            }`}
        >
          {children}
        </div>
      </main>
    </div>
  );
};