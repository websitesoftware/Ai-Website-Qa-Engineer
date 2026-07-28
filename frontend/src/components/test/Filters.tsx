'use client';
import React from 'react';
import { useContent } from '../../context/ContentContext';

export type StatusFilter = 'all' | 'passed' | 'failed' | 'running';
export type SortOption = 'newest' | 'oldest' | 'score-desc' | 'score-asc';

interface FiltersProps {
  status: StatusFilter;
  onStatusChange: (s: StatusFilter) => void;
  sort: SortOption;
  onSortChange: (s: SortOption) => void;
}

export const Filters: React.FC<FiltersProps> = ({ status, onStatusChange, sort, onSortChange }) => {
  const all = useContent('tests.filter.all', { text: 'All Tests' });
  const passed = useContent('tests.filter.passed', { text: 'Completed' });
  const running = useContent('tests.filter.running', { text: 'Running' });
  const failed = useContent('tests.filter.failed', { text: 'Failed' });

  const tabs: { key: StatusFilter; label: string }[] = [
    { key: 'all', label: all.text },
    { key: 'passed', label: passed.text },
    { key: 'running', label: running.text },
    { key: 'failed', label: failed.text },
  ];

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div className="flex space-x-1 bg-white dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => onStatusChange(tab.key)}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${
              status === tab.key ? 'bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <select
          value={sort}
          onChange={(e) => onSortChange(e.target.value as SortOption)}
          className="border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-2 bg-white dark:bg-slate-950"
        >
          <option value="newest">Sort by: Newest</option>
          <option value="oldest">Sort by: Oldest</option>
          <option value="score-desc">Sort by: Score (High-Low)</option>
          <option value="score-asc">Sort by: Score (Low-High)</option>
        </select>
      </div>
    </div>
  );
};
