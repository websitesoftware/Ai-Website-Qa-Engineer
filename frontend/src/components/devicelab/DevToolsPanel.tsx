'use client';
import React, { useEffect, useRef, useState } from 'react';
import { ArrowsClockwise, WarningCircle, Info, Crosshair, X, CaretRight, File } from '@phosphor-icons/react';
import {
  ConsoleLogEntry,
  NetworkRequestEntry,
  InspectedElement,
  StorageSnapshot,
  PerformanceMetrics,
  MemoryInfo,
  SourceFile,
} from '../../hooks/useDeviceLabSession';
import { DomTreeView } from './DomTreeView';

type DevToolsTab = 'console' | 'network' | 'elements' | 'sources' | 'performance' | 'memory' | 'application';

interface DevToolsPanelProps {
  consoleLogs: ConsoleLogEntry[];
  networkRequests: NetworkRequestEntry[];
  domHtml: string;
  onInspectDom: () => void;
  onClose: () => void;
  inspectMode: boolean;
  onToggleInspect: () => void;
  inspected: InspectedElement | null;
  storage: StorageSnapshot | null;
  onInspectStorage: () => void;
  performanceMetrics: PerformanceMetrics | null;
  onInspectPerformance: () => void;
  memory: MemoryInfo | null;
  onInspectMemory: () => void;
  source: SourceFile | null;
  sourceLoading: boolean;
  onFetchSource: (url: string) => void;
}

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString('en-US', { hour12: false });
}

function crumbLabel(c: { tag: string; id: string | null; classes: string[] }) {
  return `${c.tag}${c.id ? `#${c.id}` : ''}${c.classes.length ? `.${c.classes[0]}` : ''}`;
}

function buildSelector(el: { tag: string; id: string | null; classes: string[] }) {
  if (el.id) return `#${CSS.escape(el.id)}`;
  return `${el.tag}${el.classes.map((c) => `.${CSS.escape(c)}`).join('')}`;
}

const LEVEL_STYLES: Record<string, string> = {
  error: 'text-red-500 dark:text-red-400',
  warning: 'text-amber-500 dark:text-amber-400',
  warn: 'text-amber-500 dark:text-amber-400',
  info: 'text-blue-500 dark:text-blue-400',
};

export const DevToolsPanel: React.FC<DevToolsPanelProps> = ({
  consoleLogs,
  networkRequests,
  domHtml,
  onInspectDom,
  onClose,
  inspectMode,
  onToggleInspect,
  inspected,
  storage,
  onInspectStorage,
  performanceMetrics,
  onInspectPerformance,
  memory,
  onInspectMemory,
  source,
  sourceLoading,
  onFetchSource,
}) => {
  const [tab, setTab] = useState<DevToolsTab>('console');
  const consoleEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (tab === 'console') consoleEndRef.current?.scrollIntoView({ block: 'end' });
  }, [consoleLogs, tab]);

  useEffect(() => {
    if (tab === 'elements') onInspectDom();
    if (tab === 'application') onInspectStorage();
    if (tab === 'performance') onInspectPerformance();
    if (tab === 'memory') onInspectMemory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // Picking an element on the device (the crosshair tool) is the same
  // "jump to Elements and show it" behavior real DevTools has. Adjusting
  // state during render (React's documented pattern for "reset/react to a
  // prop change") instead of inside an effect avoids the extra render pass
  // an effect-triggered setState would cause.
  const [prevInspected, setPrevInspected] = useState(inspected);
  if (inspected !== prevInspected) {
    setPrevInspected(inspected);
    if (inspected) setTab('elements');
  }

  const errorCount = consoleLogs.filter((l) => l.level === 'error').length;
  const warnCount = consoleLogs.filter((l) => l.level === 'warning' || l.level === 'warn').length;

  return (
    <div className="h-96 shrink-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl flex flex-col overflow-hidden mt-4 font-sans">
      {/* Chrome DevTools' top bar: device toolbar icon, tabs, and a
          right-hand cluster of error/warning counters + settings/overflow —
          the same layout real DevTools uses. */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 px-1.5">
        <div className="flex items-center overflow-x-auto">
          <button
            onClick={onToggleInspect}
            title="Inspect element (pick an element on the device)"
            className={`p-2 mr-0.5 rounded cursor-pointer shrink-0 ${
              inspectMode
                ? 'bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400'
                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800'
            }`}
          >
            <Crosshair className="w-3.5 h-3.5" />
          </button>
          <TabButton active={tab === 'elements'} onClick={() => setTab('elements')} label="Elements" />
          <TabButton active={tab === 'console'} onClick={() => setTab('console')} label="Console" badge={errorCount || warnCount ? errorCount + warnCount : undefined} badgeColor={errorCount ? 'bg-red-500' : 'bg-amber-500'} />
          <TabButton active={tab === 'network'} onClick={() => setTab('network')} label="Network" badge={networkRequests.length || undefined} />
          <TabButton active={tab === 'sources'} onClick={() => setTab('sources')} label="Sources" />
          <TabButton active={tab === 'performance'} onClick={() => setTab('performance')} label="Performance" />
          <TabButton active={tab === 'memory'} onClick={() => setTab('memory')} label="Memory" />
          <TabButton active={tab === 'application'} onClick={() => setTab('application')} label="Application" />
        </div>
        <div className="flex items-center gap-2 pl-2 shrink-0">
          {errorCount > 0 && (
            <span className="flex items-center gap-1 text-red-600 dark:text-red-400 text-[11px] font-semibold">
              <WarningCircle className="w-3.5 h-3.5" weight="fill" /> {errorCount}
            </span>
          )}
          {warnCount > 0 && (
            <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 text-[11px] font-semibold">
              <WarningCircle className="w-3.5 h-3.5" /> {warnCount}
            </span>
          )}
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer" title="Close DevTools">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
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
          <div className="flex flex-col h-full">
            <div className="flex flex-1 min-h-0">
              <div className="flex-1 min-w-0 overflow-auto">
                <div className="sticky top-0 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 px-2 py-1 flex items-center justify-between">
                  <span className="text-slate-400 font-sans">
                    {inspectMode ? 'Click an element on the device…' : ''}
                  </span>
                  <button onClick={onInspectDom} className="flex items-center gap-1 text-slate-500 dark:text-slate-400 hover:text-blue-500 font-sans cursor-pointer shrink-0">
                    <ArrowsClockwise className="w-3.5 h-3.5" /> Refresh
                  </button>
                </div>
                <DomTreeView html={domHtml} selector={inspected ? buildSelector(inspected) : null} />
              </div>
              {inspected && <StylesPane element={inspected} />}
            </div>

            {/* Breadcrumb trail along the bottom, same as real DevTools —
                shows the selected element's full ancestor chain. */}
            {inspected && (
              <div className="shrink-0 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 px-2 py-1 flex items-center gap-0.5 overflow-x-auto font-sans text-[10px] text-slate-500 dark:text-slate-400">
                {inspected.ancestors.map((c, i) => (
                  <React.Fragment key={i}>
                    <span className="shrink-0 whitespace-nowrap">{crumbLabel(c)}</span>
                    <CaretRight className="w-2.5 h-2.5 shrink-0 opacity-50" />
                  </React.Fragment>
                ))}
                <span className="shrink-0 whitespace-nowrap font-semibold text-slate-800 dark:text-slate-200 bg-slate-200/70 dark:bg-slate-800 rounded px-1">
                  {crumbLabel(inspected)}
                </span>
              </div>
            )}
          </div>
        )}

        {tab === 'sources' && <SourcesTab networkRequests={networkRequests} source={source} sourceLoading={sourceLoading} onFetchSource={onFetchSource} />}
        {tab === 'performance' && <PerformanceTab metrics={performanceMetrics} onRefresh={onInspectPerformance} />}
        {tab === 'memory' && <MemoryTab memory={memory} onRefresh={onInspectMemory} />}
        {tab === 'application' && <ApplicationTab storage={storage} onRefresh={onInspectStorage} />}
      </div>
    </div>
  );
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const SourcesTab: React.FC<{
  networkRequests: NetworkRequestEntry[];
  source: SourceFile | null;
  sourceLoading: boolean;
  onFetchSource: (url: string) => void;
}> = ({ networkRequests, source, sourceLoading, onFetchSource }) => {
  const files = networkRequests.filter((r) => ['document', 'script', 'stylesheet'].includes(r.resourceType));
  const [selectedUrl, setSelectedUrl] = useState<string | null>(null);

  return (
    <div className="flex h-full font-sans">
      <div className="w-56 shrink-0 border-r border-slate-100 dark:border-slate-800 overflow-y-auto">
        {files.length === 0 && <p className="text-slate-400 p-3 text-[11px]">No documents/scripts/stylesheets captured yet.</p>}
        {files.map((f) => (
          <button
            key={f.id}
            onClick={() => {
              setSelectedUrl(f.url);
              onFetchSource(f.url);
            }}
            className={`w-full flex items-center gap-1.5 px-2 py-1.5 text-left text-[11px] cursor-pointer border-b border-slate-50 dark:border-slate-800/60 ${
              selectedUrl === f.url ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60'
            }`}
          >
            <File className="w-3 h-3 shrink-0" />
            <span className="truncate" title={f.url}>{f.url.split('/').pop() || f.url}</span>
          </button>
        ))}
      </div>
      <div className="flex-1 min-w-0 overflow-auto p-2 font-mono text-[11px] whitespace-pre-wrap break-all">
        {!selectedUrl && <p className="text-slate-400 font-sans p-2">Pick a file on the left to view its source.</p>}
        {selectedUrl && sourceLoading && <p className="text-slate-400 font-sans p-2">Loading…</p>}
        {selectedUrl && !sourceLoading && source && source.url === selectedUrl && (
          <>
            <p className="text-slate-400 font-sans mb-1">{source.status} · {source.contentType}</p>
            {source.text}
          </>
        )}
      </div>
    </div>
  );
};

const PerformanceTab: React.FC<{ metrics: PerformanceMetrics | null; onRefresh: () => void }> = ({ metrics, onRefresh }) => (
  <div className="p-3 font-sans text-xs">
    <div className="flex justify-end mb-2">
      <button onClick={onRefresh} className="flex items-center gap-1 text-slate-500 dark:text-slate-400 hover:text-blue-500 cursor-pointer">
        <ArrowsClockwise className="w-3.5 h-3.5" /> Refresh
      </button>
    </div>
    {!metrics ? (
      <p className="text-slate-400">Loading performance metrics…</p>
    ) : (
      <>
        <div className="grid grid-cols-2 gap-2 mb-3">
          <MetricCard label="Time to first byte" value={metrics.ttfb !== null ? `${metrics.ttfb} ms` : '—'} />
          <MetricCard label="First paint" value={metrics.firstPaint !== null ? `${metrics.firstPaint} ms` : '—'} />
          <MetricCard label="First contentful paint" value={metrics.firstContentfulPaint !== null ? `${metrics.firstContentfulPaint} ms` : '—'} />
          <MetricCard label="DOMContentLoaded" value={metrics.domContentLoaded !== null ? `${metrics.domContentLoaded} ms` : '—'} />
          <MetricCard label="Load event" value={metrics.loadEvent !== null ? `${metrics.loadEvent} ms` : '—'} />
          <MetricCard label="Total transferred" value={formatBytes(metrics.totalTransferBytes)} />
        </div>
        <p className="font-semibold text-slate-500 dark:text-slate-400 mb-1">Requests by type ({metrics.resourceCount} total)</p>
        <div className="space-y-1">
          {Object.entries(metrics.byType).map(([type, count]) => (
            <div key={type} className="flex items-center gap-2">
              <span className="w-24 shrink-0 text-slate-500 dark:text-slate-400">{type}</span>
              <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-blue-400" style={{ width: `${Math.min(100, (count / metrics.resourceCount) * 100)}%` }} />
              </div>
              <span className="w-6 text-right text-slate-500 dark:text-slate-400">{count}</span>
            </div>
          ))}
        </div>
      </>
    )}
  </div>
);

const MetricCard: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="border border-slate-100 dark:border-slate-800 rounded-lg px-3 py-2">
    <p className="text-slate-400 text-[10px] mb-0.5">{label}</p>
    <p className="font-bold text-slate-800 dark:text-slate-100">{value}</p>
  </div>
);

const MemoryTab: React.FC<{ memory: MemoryInfo | null; onRefresh: () => void }> = ({ memory, onRefresh }) => (
  <div className="p-3 font-sans text-xs">
    <div className="flex justify-end mb-2">
      <button onClick={onRefresh} className="flex items-center gap-1 text-slate-500 dark:text-slate-400 hover:text-blue-500 cursor-pointer">
        <ArrowsClockwise className="w-3.5 h-3.5" /> Refresh
      </button>
    </div>
    {!memory ? (
      <p className="text-slate-400">Loading memory info…</p>
    ) : !memory.available ? (
      <p className="text-slate-400">JS heap memory isn&apos;t exposed by this browser engine (Chromium only) — try switching the engine to Chromium.</p>
    ) : (
      <>
        <div className="grid grid-cols-3 gap-2 mb-3">
          <MetricCard label="Used JS heap" value={formatBytes(memory.usedJSHeapSize || 0)} />
          <MetricCard label="Total JS heap" value={formatBytes(memory.totalJSHeapSize || 0)} />
          <MetricCard label="Heap limit" value={formatBytes(memory.jsHeapSizeLimit || 0)} />
        </div>
        <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-400"
            style={{ width: `${Math.min(100, ((memory.usedJSHeapSize || 0) / (memory.jsHeapSizeLimit || 1)) * 100)}%` }}
          />
        </div>
      </>
    )}
  </div>
);

const ApplicationTab: React.FC<{ storage: StorageSnapshot | null; onRefresh: () => void }> = ({ storage, onRefresh }) => (
  <div className="p-3 font-sans text-xs">
    <div className="flex justify-end mb-2">
      <button onClick={onRefresh} className="flex items-center gap-1 text-slate-500 dark:text-slate-400 hover:text-blue-500 cursor-pointer">
        <ArrowsClockwise className="w-3.5 h-3.5" /> Refresh
      </button>
    </div>
    {!storage ? (
      <p className="text-slate-400">Loading storage…</p>
    ) : (
      <div className="space-y-4">
        <StorageTable title="Local Storage" entries={storage.localStorage} />
        <StorageTable title="Session Storage" entries={storage.sessionStorage} />
        <div>
          <p className="font-semibold text-slate-500 dark:text-slate-400 mb-1">Cookies ({storage.cookies.length})</p>
          {storage.cookies.length === 0 ? (
            <p className="text-slate-400 font-mono">No cookies.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono text-[11px]">
                <thead className="text-slate-400 font-sans">
                  <tr>
                    <th className="px-2 py-1 font-semibold">Name</th>
                    <th className="px-2 py-1 font-semibold">Value</th>
                    <th className="px-2 py-1 font-semibold">Domain</th>
                    <th className="px-2 py-1 font-semibold">Path</th>
                    <th className="px-2 py-1 font-semibold">HttpOnly</th>
                    <th className="px-2 py-1 font-semibold">Secure</th>
                  </tr>
                </thead>
                <tbody>
                  {storage.cookies.map((c, i) => (
                    <tr key={i} className="border-b border-slate-50 dark:border-slate-800/60">
                      <td className="px-2 py-1 text-slate-700 dark:text-slate-300">{c.name}</td>
                      <td className="px-2 py-1 text-slate-500 dark:text-slate-400 truncate max-w-32" title={c.value}>{c.value}</td>
                      <td className="px-2 py-1 text-slate-500 dark:text-slate-400">{c.domain}</td>
                      <td className="px-2 py-1 text-slate-500 dark:text-slate-400">{c.path}</td>
                      <td className="px-2 py-1 text-slate-500 dark:text-slate-400">{c.httpOnly ? 'true' : 'false'}</td>
                      <td className="px-2 py-1 text-slate-500 dark:text-slate-400">{c.secure ? 'true' : 'false'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    )}
  </div>
);

const StorageTable: React.FC<{ title: string; entries: [string, string][] }> = ({ title, entries }) => (
  <div>
    <p className="font-semibold text-slate-500 dark:text-slate-400 mb-1">{title} ({entries.length})</p>
    {entries.length === 0 ? (
      <p className="text-slate-400 font-mono">Empty.</p>
    ) : (
      <table className="w-full text-left font-mono text-[11px]">
        <tbody>
          {entries.map(([k, v], i) => (
            <tr key={i} className="border-b border-slate-50 dark:border-slate-800/60">
              <td className="px-2 py-1 text-purple-700 dark:text-purple-400 align-top shrink-0 w-1/3">{k}</td>
              <td className="px-2 py-1 text-slate-600 dark:text-slate-300 break-all">{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    )}
  </div>
);

const StylesPane: React.FC<{ element: InspectedElement }> = ({ element }) => {
  const [sub, setSub] = useState<'styles' | 'computed'>('styles');
  const selector = `${element.tag}${element.id ? `#${element.id}` : ''}${element.classes.map((c) => `.${c}`).join('')}`;

  return (
    <div className="w-64 shrink-0 border-l border-slate-100 dark:border-slate-800 overflow-y-auto font-sans">
      <div className="flex items-center border-b border-slate-100 dark:border-slate-800">
        <button
          onClick={() => setSub('styles')}
          className={`px-3 py-1.5 text-[11px] font-semibold cursor-pointer border-b-2 ${sub === 'styles' ? 'border-blue-500 text-slate-900 dark:text-slate-100' : 'border-transparent text-slate-400'}`}
        >
          Styles
        </button>
        <button
          onClick={() => setSub('computed')}
          className={`px-3 py-1.5 text-[11px] font-semibold cursor-pointer border-b-2 ${sub === 'computed' ? 'border-blue-500 text-slate-900 dark:text-slate-100' : 'border-transparent text-slate-400'}`}
        >
          Computed
        </button>
      </div>

      {/* Box model diagram — margin > border > padding > content, same
          nesting Chrome's DevTools box-model widget shows. */}
      <div className="p-3 flex justify-center">
        <div className="text-center text-[9px] font-semibold text-orange-700 dark:text-orange-400 bg-orange-100/70 dark:bg-orange-950/40 px-1 pt-1 pb-1.5">
          margin
          <div className="text-[9px] font-semibold text-yellow-800 dark:text-yellow-500 bg-yellow-100/70 dark:bg-yellow-950/40 px-1 pt-1 pb-1.5 mt-0.5">
            border
            <div className="text-[9px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-100/70 dark:bg-emerald-950/40 px-1 pt-1 pb-1.5 mt-0.5">
              padding
              <div className="bg-sky-200/70 dark:bg-sky-950/50 text-sky-900 dark:text-sky-300 text-[10px] font-bold px-3 py-2 mt-0.5">
                {Math.round(element.rect.width)} × {Math.round(element.rect.height)}
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="px-3 pb-2 -mt-1 text-[9px] font-mono text-slate-500 dark:text-slate-400 space-y-0.5">
        <BoxRow label="margin" box={element.margin} />
        <BoxRow label="border" box={element.border} />
        <BoxRow label="padding" box={element.padding} />
      </div>

      {sub === 'styles' ? (
        <div className="border-t border-slate-100 dark:border-slate-800">
          {element.matchedRules.length === 0 && (
            <p className="px-3 py-3 text-slate-400 text-[11px]">No matched CSS rules found for this element.</p>
          )}
          {element.matchedRules.map((rule, i) => (
            <div key={i} className="px-3 py-2 border-b border-slate-50 dark:border-slate-800/60">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-purple-700 dark:text-purple-400 font-semibold text-[11px] break-all">{rule.selector}</span>
                <span className="text-slate-400 text-[9px] shrink-0 truncate max-w-20" title={rule.source}>{rule.source}</span>
              </div>
              <div className="text-[11px] leading-relaxed">
                {'{'}
                {rule.declarations.map((d, j) => (
                  <div key={j} className="pl-3">
                    <span className="text-sky-700 dark:text-sky-400">{d.prop}</span>
                    <span className="text-slate-400">: </span>
                    <span className="text-slate-700 dark:text-slate-300">{d.value}</span>
                    <span className="text-slate-400">;</span>
                  </div>
                ))}
                {'}'}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="border-t border-slate-100 dark:border-slate-800 px-3 py-2 space-y-1 text-[11px]">
          <StyleRow k="display" v={element.style.display} />
          <StyleRow k="position" v={element.style.position} />
          <StyleRow k="color" v={element.style.color} swatch={element.style.color} />
          <StyleRow k="background" v={element.style.backgroundColor} swatch={element.style.backgroundColor} />
          <StyleRow k="font" v={`${element.style.fontSize} / ${element.style.lineHeight}`} />
          <StyleRow k="font-family" v={element.style.fontFamily} />
          <StyleRow k="font-weight" v={element.style.fontWeight} />
          <StyleRow k="text-align" v={element.style.textAlign} />
          <StyleRow k="z-index" v={element.style.zIndex} />
        </div>
      )}
      <p className="px-3 py-1.5 text-[9px] text-slate-400 break-all">{selector}</p>
    </div>
  );
};

const BoxRow: React.FC<{ label: string; box: { top: string; right: string; bottom: string; left: string } }> = ({ label, box }) => (
  <div className="flex justify-between">
    <span className="text-slate-400">{label}</span>
    <span>{box.top} {box.right} {box.bottom} {box.left}</span>
  </div>
);

const StyleRow: React.FC<{ k: string; v: string; swatch?: string }> = ({ k, v, swatch }) => (
  <div className="flex items-center gap-1.5 font-mono">
    <span className="text-purple-700 dark:text-purple-400 shrink-0">{k}:</span>
    {swatch && <span className="w-2.5 h-2.5 rounded-sm border border-slate-300 dark:border-slate-600 shrink-0" style={{ background: swatch }} />}
    <span className="text-slate-600 dark:text-slate-300 truncate" title={v}>{v}</span>
  </div>
);

const TabButton: React.FC<{ active: boolean; onClick: () => void; icon?: React.ReactNode; label: string; badge?: number; badgeColor?: string }> = ({
  active,
  onClick,
  icon,
  label,
  badge,
  badgeColor = 'bg-slate-400',
}) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium font-sans border-b-2 cursor-pointer transition-colors shrink-0 ${
      active
        ? 'border-blue-500 text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-900'
        : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
    }`}
  >
    {icon}
    {label}
    {!!badge && <span className={`text-[10px] text-white rounded-full px-1.5 ${badgeColor}`}>{badge}</span>}
  </button>
);
