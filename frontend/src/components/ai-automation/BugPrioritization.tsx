import React, { useState } from 'react';
import { motion } from 'framer-motion';

interface PrioritizationProps {
  data: {
    bugId: string;
    title: string;
    category: string;
    severity: 'Critical' | 'High' | 'Medium' | 'Low';
    score: number;
    impactSummary: string;
  } | null;
  onEdit?: (fields: { title: string; severity: string; category: string }) => Promise<void> | void;
  onDelete?: () => Promise<void> | void;
}

const CATEGORY_OPTIONS = [
  'broken-link',
  'console-error',
  'cross-browser',
  'accessibility',
  'lighthouse',
  'visual-regression',
  'seo',
];

const SEVERITY_CHOICES = ['Critical', 'High', 'Medium', 'Low'];

export const BugPrioritization: React.FC<PrioritizationProps> = ({ data, onEdit, onDelete }) => {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState({ title: '', severity: 'Medium', category: 'lighthouse' });

  if (!data) {
    return (
      <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm animate-pulse mb-6">
        <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-1/3 mb-4"></div>
        <div className="h-10 bg-slate-100 dark:bg-slate-700/60 rounded mb-2"></div>
      </div>
    );
  }

  const severityStyles = {
    Critical: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-900',
    High: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900',
    Medium: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-900',
    Low: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900',
  };

  const startEdit = () => {
    setForm({ title: data.title, severity: data.severity, category: data.category });
    setEditing(true);
  };

  const save = async () => {
    if (!onEdit || !form.title.trim()) return;
    setSaving(true);
    try {
      await onEdit(form);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!onDelete) return;
    if (!window.confirm('Delete this issue? It will no longer be prioritized or tracked.')) return;
    setDeleting(true);
    try {
      await onDelete();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ duration: 0.2 }}
      className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md mb-6"
    >
      <div className="flex items-center justify-between mb-4 gap-2">
        <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <span>⚡</span> AI Bug Prioritization
        </h3>
        <div className="flex items-center gap-2">
          <motion.span
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.25 }}
            className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${severityStyles[data.severity]}`}
          >
            {data.severity} Severity
          </motion.span>
          {(onEdit || onDelete) && !editing && (
            <div className="flex items-center gap-1">
              {onEdit && (
                <button
                  onClick={startEdit}
                  title="Edit this issue"
                  className="w-7 h-7 flex items-center justify-center rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 dark:hover:text-blue-400 transition-colors cursor-pointer"
                >
                  ✏️
                </button>
              )}
              {onDelete && (
                <button
                  onClick={remove}
                  disabled={deleting}
                  title="Delete this issue"
                  className="w-7 h-7 flex items-center justify-center rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 dark:hover:text-red-400 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {deleting ? '…' : '🗑️'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {editing ? (
        <div className="space-y-3 bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg">
          <div>
            <label className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 block mb-1">Title</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className="w-full text-sm px-2.5 py-1.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 block mb-1">Category</label>
              <select
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                className="w-full text-sm px-2.5 py-1.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
              >
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c} value={c}>{c.replace(/-/g, ' ')}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 block mb-1">Severity</label>
              <select
                value={form.severity}
                onChange={(e) => setForm((f) => ({ ...f, severity: e.target.value }))}
                className="w-full text-sm px-2.5 py-1.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
              >
                {SEVERITY_CHOICES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={save}
              disabled={saving || !form.title.trim()}
              className="px-3 py-1.5 text-xs font-semibold rounded-md bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white transition-colors cursor-pointer"
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
            <button
              onClick={() => setEditing(false)}
              disabled={saving}
              className="px-3 py-1.5 text-xs font-semibold rounded-md text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 mb-4 bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg">
            <div>
              <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 block">Ticket ID</span>
              <span className="text-sm font-mono font-bold text-slate-700 dark:text-slate-300">{data.bugId}</span>
            </div>
            <div>
              <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 block">AI Priority Score</span>
              <span className="text-sm font-bold text-slate-900 dark:text-slate-100">{data.score} <span className="text-xs text-slate-400">/100</span></span>
              <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden mt-1.5">
                <motion.div
                  className="h-full bg-blue-600"
                  initial={{ width: 0 }}
                  animate={{ width: `${data.score}%` }}
                  transition={{ duration: 0.7, ease: 'easeOut', delay: 0.1 }}
                />
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 block mb-0.5">Bug Target</span>
              <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{data.title}</p>
            </div>
            <div>
              <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 block mb-0.5">AI Impact Assessment</span>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{data.impactSummary}</p>
            </div>
          </div>
        </>
      )}
    </motion.div>
  );
};
