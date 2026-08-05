import React from 'react';
import { ScoreGauge } from '../ui/ScoreGauge';
import { formatDate } from '../../lib/format';

interface TicketOverviewProps {
  bugId: string;
  title: string;
  severity: string;
  confidence: number | null;
  scanDate: string | null;
}

const SEVERITY_PILL: Record<string, string> = {
  Critical: 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400',
  High: 'bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-400',
  Medium: 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400',
  Low: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
};

export const TicketOverviewCard: React.FC<TicketOverviewProps> = ({ bugId, title, severity, confidence, scanDate }) => {
  const confidencePct = confidence !== null ? Math.round(confidence * 100) : null;
  const confidenceLabel = confidencePct === null ? 'n/a' : confidencePct >= 80 ? 'High Confidence' : confidencePct >= 50 ? 'Moderate Confidence' : 'Low Confidence';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[2fr_auto_auto] gap-4 items-stretch">
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-6">
        <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 mb-3">
          <span>🎫</span> Bug Ticket
        </h3>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 block">Ticket ID</span>
            <code className="text-sm font-mono font-bold text-slate-800 dark:text-slate-200">{bugId}</code>
          </div>
          <div className="flex-1 min-w-[160px]">
            <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 block">Issue Title</span>
            <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{title}</span>
          </div>
          <span className={`text-xs font-bold px-3 py-1.5 rounded-full whitespace-nowrap ${SEVERITY_PILL[severity] || SEVERITY_PILL.Low}`}>
            {severity === 'Critical' || severity === 'High' ? '🔥 ' : ''}
            {severity} Priority
          </span>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-6 flex flex-col items-center justify-center gap-2 min-w-[180px]">
        <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-400">AI Confidence Score</span>
        <ScoreGauge score={confidencePct} size={80} strokeWidth={7} />
        <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">{confidenceLabel}</span>
        <span className="text-[10px] text-slate-400 dark:text-slate-500">Based on AI Analysis</span>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-6 flex flex-col justify-center gap-1 min-w-[160px]">
        <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 flex items-center gap-1.5">
          <i className="ph ph-calendar" /> Scan Date
        </span>
        <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{scanDate ? formatDate(scanDate) : 'n/a'}</span>
      </div>
    </div>
  );
};
