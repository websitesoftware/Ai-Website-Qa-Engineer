'use client';
import React from 'react';
import { useContent } from '../../context/ContentContext';

interface HeaderProps {
  onRunNewTest: () => void;
  search?: string;
  onSearchChange?: (value: string) => void;
}

export const Header: React.FC<HeaderProps> = ({ onRunNewTest, search = '', onSearchChange }) => {
  const title = useContent('tests.header.title', { text: 'Test Management' });
  const subtitle = useContent('tests.header.subtitle', { text: 'Run new tests or view previous analysis runs.' });
  const searchPlaceholder = useContent('tests.header.searchPlaceholder', { text: 'Search tests...' });
  const runButton = useContent('tests.header.runButton', { text: 'Run New Test', icon: 'ph-plus-bold' });

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white transition-colors duration-500">
          {title.text}
        </h2>

        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 transition-colors duration-300">
          {subtitle.text}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <div className="relative hidden sm:block">
          <i className="ph ph-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
          <input
            type="text"
            placeholder={searchPlaceholder.text}
            value={search}
            onChange={(e) => onSearchChange?.(e.target.value)}
            className="pl-10 pr-4 py-2 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm w-64 bg-white dark:bg-slate-950 dark:text-white transition-shadow"
          />
        </div>
        <button
          onClick={onRunNewTest}
          className="bg-indigo-500 hover:bg-indigo-600 text-white px-5 py-2.5 rounded-lg font-medium transition-colors shadow-sm flex items-center gap-2 shrink-0"
        >
          <i className={`ph ${runButton.icon}`}></i>
          {runButton.text}
        </button>
      </div>
    </div>
  );
};
