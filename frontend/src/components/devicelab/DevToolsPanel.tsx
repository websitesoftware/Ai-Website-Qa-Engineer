'use client';
import React, { useEffect, useRef, useState } from 'react';
import { Terminal, Globe, Code, ArrowsClockwise, WarningCircle, Info } from '@phosphor-icons/react';
import { ConsoleLogEntry, NetworkRequestEntry } from '../../hooks/useDeviceLabSession';
import { DomTreeView } from './DomTreeView';

type DevToolsTab = 'console' | 'network' | 'elements';

interface DevToolsPanelProps {
  consoleLogs: ConsoleLogEntry[];
  networkRequests: NetworkRequestEntry[];
  domHtml: string;
  onInspectDom: () => void;
  onClose: () => void;
}

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString('en-US', { hour12: false });
}

const LEVEL_STYLES: Record<string, string> = {
  error: 'text-red-500 dark:text-red-400',
  warning: 'text-amber-500 dark:text-amber-400',
  warn: 'text-amber-500 dark:text-amber-400',
  info: 'text-blue-500 dark:text-blue-400',
};

export const DevToolsPanel: React.FC<DevToolsPanelProps> = ({ consoleLogs, networkRequests, domHtml, onInspectDom, onClose }) => {
  const [tab, setTab] = useState<DevToolsTab>('console');
  const consoleEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (tab === 'console') consoleEndRef.current?.scrollIntoView({ block: 'end' });
  }, [consoleLogs, tab]);

  useEffect(() => {
    if (tab === 'elements') onInspectDom();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const errorCount = consoleLogs.filter((l) => l.level === 'error').length;
  const warnCount = consoleLogs.filter((l) => l.level === 'warning' || l.level === 'warn').length;

  return (
    <div className="h-64 shrink-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl flex flex-col overflow-hidden mt-4">
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-2">
        <div className="flex items-center">
          <TabButton active={tab === 'console'} onClick={() => setTab('console')} icon={<Terminal className="w-3.5 h-3.5" />} label="Console" badge={errorCount || warnCount ? errorCount + warnCount : undefined} badgeColor={errorCount ? 'bg-red-500' : 'bg-amber-500'} />
          <TabButton active={tab === 'network'} onClick={() => setTab('network')} icon={<Globe className="w-3.5 h-3.5" />} label="Network" badge={networkRequests.length || undefined} />
          <TabButton active={tab === 'elements'} onClick={() => setTab('elements')} icon={<Code className="w-3.5 h-3.5" />} label="Elements" />
        </div>
        <button onClick={onClose} className="px-2 py-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs cursor-pointer" title="Close DevTools">
          ✕
        </button>
      </div>

      <div className="flex-1 overflow-auto font-mono text-xs">
        {tab === 'console' && (
          <div className="p-2">
            {consoleLogs.length === 0 && <p className="text-slate-400 font-sans p-2">No console output yet.</p>}
            {consoleLogs.map((log, i) => (
              <div key={i} className={`flex items-start gap-2 px-2 py-1 border-b border-slate-50 dark:border-slate-800/60 ${LEVEL_STYLES[log.level] || 'text-slate-700 dark:text-slate-300'}`}>
                {log.level === 'error' ? (
                  <WarningCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" weight="fill" />
                ) : log.level === 'warning' || log.level === 'warn' ? (
                  <WarningCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                ) : (
                  <Info className="w-3.5 h-3.5 mt-0.5 shrink-0 opacity-50" />
                )}
                <span className="text-slate-400 shrink-0">{formatTime(log.ts)}</span>
                <span className="whitespace-pre-wrap break-all">{log.text}</span>
              </div>
            ))}
            <div ref={consoleEndRef} />
          </div>
        )}

        {tab === 'network' && (
          <table className="w-full text-left">
            <thead className="sticky top-0 bg-white dark:bg-slate-900 text-slate-400 font-sans">
              <tr>
                <th className="px-2 py-1 font-semibold">Status</th>
                <th className="px-2 py-1 font-semibold">Method</th>
                <th className="px-2 py-1 font-semibold">Type</th>
                <th className="px-2 py-1 font-semibold">URL</th>
              </tr>
            </thead>
            <tbody>
              {networkRequests.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-slate-400 font-sans p-3">No requests captured yet.</td>
                </tr>
              )}
              {networkRequests.map((req) => (
                <tr key={req.id} className="border-b border-slate-50 dark:border-slate-800/60">
                  <td className={`px-2 py-1 shrink-0 ${req.errorText ? 'text-red-500' : req.status && req.status >= 400 ? 'text-amber-500' : 'text-emerald-500'}`}>
                    {req.errorText ? 'FAIL' : req.status ?? '…'}
                  </td>
                  <td className="px-2 py-1 text-slate-500 dark:text-slate-400">{req.method}</td>
                  <td className="px-2 py-1 text-slate-500 dark:text-slate-400">{req.resourceType}</td>
                  <td className="px-2 py-1 text-slate-700 dark:text-slate-300 truncate max-w-0 w-full" title={req.url}>{req.url}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {tab === 'elements' && (
          <div>
            <div className="sticky top-0 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 px-2 py-1 flex justify-end">
              <button onClick={onInspectDom} className="flex items-center gap-1 text-slate-500 dark:text-slate-400 hover:text-indigo-500 font-sans cursor-pointer">
                <ArrowsClockwise className="w-3.5 h-3.5" /> Refresh
              </button>
            </div>
            <DomTreeView html={domHtml} />
          </div>
        )}
      </div>
    </div>
  );
};

const TabButton: React.FC<{ active: boolean; onClick: () => void; icon: React.ReactNode; label: string; badge?: number; badgeColor?: string }> = ({
  active,
  onClick,
  icon,
  label,
  badge,
  badgeColor = 'bg-slate-400',
}) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold font-sans border-b-2 cursor-pointer transition-colors ${
      active ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
    }`}
  >
    {icon}
    {label}
    {!!badge && <span className={`text-[10px] text-white rounded-full px-1.5 ${badgeColor}`}>{badge}</span>}
  </button>
);
