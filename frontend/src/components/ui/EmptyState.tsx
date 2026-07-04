import React from 'react';

interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ icon = 'ph-tray', title, description, action }) => (
  <div className="flex flex-col items-center justify-center text-center py-16 px-6 animate-fade-in">
    <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-400 flex items-center justify-center text-3xl mb-4">
      <i className={`ph ${icon}`}></i>
    </div>
    <h3 className="font-semibold text-slate-800">{title}</h3>
    {description && <p className="text-sm text-slate-500 mt-1 max-w-sm">{description}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>
);
