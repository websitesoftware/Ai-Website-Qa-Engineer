'use client';
import React from 'react';

export type StatusFilter = 'all' | 'passed' | 'failed' | 'running';
export type SortOption = 'newest' | 'oldest' | 'score-desc' | 'score-asc';

interface FiltersProps {
  status: StatusFilter;
  onStatusChange: (s: StatusFilter) => void;
  sort: SortOption;
  onSortChange: (s: SortOption) => void;
}

const tabs: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'All Tests' },
  { key: 'passed', label: 'Completed' },
  { key: 'running', label: 'Running' },
  { key: 'failed', label: 'Failed' },
];

export const Filters: React.FC<FiltersProps> = ({ status, onStatusChange, sort, onSortChange }) => {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div className="flex space-x-1 bg-white p-1 rounded-lg border border-slate-200">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => onStatusChange(tab.key)}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${
              status === tab.key ? 'bg-slate-100 text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
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
          className="border border-slate-200 text-slate-600 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-2 bg-white"
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
