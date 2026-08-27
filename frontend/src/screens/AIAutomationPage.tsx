'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Robot,
  Globe,
  CircleNotch,
  Copy,
  Code,
  ListBullets,
  TextT,
  Link as LinkIcon,
  CursorClick,
  TextAa,
  ImageSquare,
  SpeakerHigh,
  WarningCircle,
  MonitorPlay,
  Play,
  ArrowRight,
  ArrowLeft,
  ArrowCounterClockwise,
  X,
} from '@phosphor-icons/react';
import { api, API_ORIGIN } from '../lib/api';
import { NvdaElement, NvdaScanResult } from '../lib/types';
import { useToast } from '../context/ToastContext';
import { useContent, getContent } from '../context/ContentContext';

interface LiveAnnouncement {
  element_type: NvdaElement['element_type'] | string;
  nvda_speech: string;
  component_theory: string;
}

const TYPE_META: Record<
  NvdaElement['element_type'],
  { icon: React.ElementType; label: string; badge: string }
> = {
  heading: { icon: TextT, label: 'Heading', badge: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-400 dark:border-purple-900' },
  link: { icon: LinkIcon, label: 'Link', badge: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-900' },
  button: { icon: CursorClick, label: 'Button', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900' },
  input: { icon: TextAa, label: 'Form Control', badge: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900' },
  image: { icon: ImageSquare, label: 'Image', badge: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700' },
};

export const AIAutomationPage: React.FC = () => {
  const { showToast } = useToast();
  const heading = useContent('aiAutomation.heading', { text: 'NVDA Accessibility Agent' });
  const subtitle = useContent('aiAutomation.subtitle', {
    text: 'Shows the page, then lets you press Tab to move through every heading, link, button, form control and image — each one announced out loud, NVDA-style.',
  });
  const urlLabel = useContent('aiAutomation.urlLabel', { text: 'Page to inspect' });
  const urlPlaceholder = useContent('aiAutomation.urlPlaceholder', { text: 'https://example.com' });
  const scanButtonLoading = useContent('aiAutomation.scanButton.loading', { text: 'Loading page…' });
  const scanButtonIdle = useContent('aiAutomation.scanButton.idle', { text: 'Scan Page' });
  const scanErrorFallback = useContent('aiAutomation.scanErrorFallback', { text: 'Could not scan that page' });
  const thinkingTitle = useContent('aiAutomation.thinking.title', { text: 'Loading the page and mapping its structure…' });
  const thinkingSubtitle = useContent('aiAutomation.thinking.subtitle', { text: 'Capturing headings, links, buttons, form controls and images, in order.' });
  const scannedLabel = useContent('aiAutomation.scannedLabel', { text: 'Scanned' });
  const viewWalkthrough = useContent('aiAutomation.view.walkthrough', { text: 'Walkthrough' });
  const viewAnnouncements = useContent('aiAutomation.view.announcements', { text: 'Announcements' });
  const viewJson = useContent('aiAutomation.view.json', { text: 'JSON' });
  const copyJsonLabel = useContent('aiAutomation.copyJson', { text: 'Copy JSON' });
  const toastCopiedJson = useContent('aiAutomation.toast.copiedJson', { text: 'NVDA announcement JSON copied' });
  const toastClipboardUnavailable = useContent('aiAutomation.toast.clipboardUnavailable', { text: 'Clipboard unavailable — copy manually' });
  const noElementsFound = useContent('aiAutomation.noElementsFound', {
    text: 'No headings, links, buttons, form controls or images were found on that page.',
  });
  const walkthroughHint = useContent('aiAutomation.walkthroughHint', {
    text: 'This is the real, live page — click anything, scroll, or press Tab inside it directly. Buttons below jump to a specific element.',
  });
  const startTabbingLabel = useContent('aiAutomation.startTabbing', { text: 'Start Tabbing' });
  const restartLabel = useContent('aiAutomation.restart', { text: 'Restart' });
  const prevLabel = useContent('aiAutomation.prev', { text: 'Prev' });
  const nextLabel = useContent('aiAutomation.next', { text: 'Next' });
  const replayTooltip = useContent('aiAutomation.replayTooltip', { text: 'Replay this announcement' });
  const clearTooltip = useContent('aiAutomation.clearTooltip', { text: 'Clear the current announcement' });
  const iframeTitle = useContent('aiAutomation.iframeTitle', { text: 'Live walkthrough of the scanned page' });
  const emptyStateText = useContent('aiAutomation.emptyState', {
    text: 'Enter a URL above — the agent will show the page and let you Tab through it like NVDA, out loud.',
  });
  const navigatedToast = useContent('aiAutomation.navigatedToast', {
    text: 'Followed a link inside the walkthrough — Announcements/JSON still reflect the original scan',
  });
  const [url, setUrl] = useState('');
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<NvdaScanResult | null>(null);
  const [view, setView] = useState<'walkthrough' | 'list' | 'json'>('walkthrough');

  // Walkthrough (live iframe, Tab-to-hear) state
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [liveAnnouncement, setLiveAnnouncement] = useState<LiveAnnouncement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const elements = result?.elements ?? null;

  const counts = useMemo(() => {
    const c: Record<string, number> = { heading: 0, link: 0, button: 0, input: 0, image: 0 };
    (elements || []).forEach((el) => {
      c[el.element_type] = (c[el.element_type] || 0) + 1;
    });
    return c;
  }, [elements]);

  const speak = (text: string) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
  };

  useEffect(() => {
    // Stop any in-progress speech when leaving the page.
    return () => {
      if (typeof window !== 'undefined') window.speechSynthesis?.cancel();
    };
  }, []);

  // The live page runs inside a cross-origin iframe (served through our own
  // proxy so it can be framed at all — see backend nvdaAgent.controller.js).
  // It can't be scripted directly from here, so it self-announces via
  // postMessage on real focus/click/scroll, which is what actually drives
  // speech now — the pre-scanned `elements` array is just used to label the
  // Prev/Next/count UI and for the Announcements/JSON tabs.
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      const data = e.data;
      if (!data || data.source !== 'nvda-agent-iframe') return;
      if (data.type === 'navigate') {
        // Indices from the original scan no longer line up with the new
        // page's elements — clear the stale Prev/Next counter rather than
        // show a wrong position. The new page announces itself on load
        // (below), and Prev/Next re-establish position once used again.
        setActiveIndex(null);
        showToast(navigatedToast.text, 'info');
        return;
      }
      // 'ready' (page just loaded/navigated) and 'ack' (Prev/Next jumped to
      // an element) both carry an announcement to speak; only 'ack' also
      // carries an index to sync the Prev/Next counter to.
      if (typeof data.index === 'number') setActiveIndex(data.index);
      if (typeof data.nvda_speech === 'string') {
        setLiveAnnouncement({ element_type: data.element_type, nvda_speech: data.nvda_speech, component_theory: data.component_theory });
        speak(data.nvda_speech);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const goToIndex = (i: number) => {
    if (!elements || elements.length === 0) return;
    const clamped = Math.max(0, Math.min(elements.length - 1, i));
    iframeRef.current?.contentWindow?.postMessage({ type: 'nvda-goto', index: clamped }, '*');
  };

  const exitWalkthrough = () => {
    setActiveIndex(null);
    setLiveAnnouncement(null);
    window.speechSynthesis?.cancel();
  };

  const handleScan = async () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    setScanning(true);
    setError(null);
    setResult(null);
    exitWalkthrough();
    try {
      const scanResult = await api.nvdaAgent.scan(trimmed);
      setResult(scanResult);
      setView('walkthrough');
    } catch (err) {
      setError(err instanceof Error ? err.message : scanErrorFallback.text);
    } finally {
      setScanning(false);
    }
  };

  const handleCopyJson = async () => {
    if (!elements) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(elements, null, 2));
      showToast(toastCopiedJson.text, 'success');
    } catch {
      showToast(toastClipboardUnavailable.text, 'error');
    }
  };

  return (
    <div className="space-y-6 w-full max-w-5xl mx-auto px-4 py-2">
      {/* Robot header */}
      <div className="flex items-center gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
        <div className="relative shrink-0">
          <div className={`w-14 h-14 rounded-2xl bg-linear-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-lg ${scanning ? 'animate-pulse' : ''}`}>
            <Robot className="w-8 h-8 text-white" weight="fill" />
          </div>
          <span
            className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white dark:border-slate-950 ${
              scanning ? 'bg-amber-400 animate-ping' : elements ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'
            }`}
          />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">{heading.text}</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{subtitle.text}</p>
        </div>
      </div>

      {/* URL input */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-5">
        <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
          {urlLabel.text}
        </label>
        <div className="flex items-center gap-2">
          <div className="relative flex-1 flex items-center bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 focus-within:ring-4 focus-within:ring-blue-500/10 focus-within:border-blue-500 transition-all">
            <Globe className="w-4 h-4 text-slate-400 shrink-0 mr-2" />
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !scanning && handleScan()}
              placeholder={urlPlaceholder.text}
              className="flex-1 bg-transparent py-2.5 text-sm text-slate-800 dark:text-white focus:outline-none"
            />
          </div>
          <button
            onClick={handleScan}
            disabled={scanning || !url.trim()}
            className="shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded-lg font-bold text-sm text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 dark:disabled:bg-blue-900 cursor-pointer transition-colors"
          >
            {scanning ? <CircleNotch className="w-4 h-4 animate-spin" /> : <Robot className="w-4 h-4" />}
            {scanning ? scanButtonLoading.text : scanButtonIdle.text}
          </button>
        </div>
        {error && (
          <p className="mt-3 text-sm text-red-600 dark:text-red-400 flex items-center gap-1.5">
            <WarningCircle className="w-4 h-4 shrink-0" /> {error}
          </p>
        )}
      </div>

      {/* Robot "thinking" state */}
      <AnimatePresence>
        {scanning && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-8 flex flex-col items-center justify-center gap-3 text-center"
          >
            <motion.div
              animate={{ rotate: [0, -8, 8, -8, 0] }}
              transition={{ repeat: Infinity, duration: 1.4 }}
              className="w-16 h-16 rounded-2xl bg-linear-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-lg"
            >
              <Robot className="w-9 h-9 text-white" weight="fill" />
            </motion.div>
            <p className="text-sm font-bold text-slate-700 dark:text-slate-300">{thinkingTitle.text}</p>
            <p className="text-xs text-slate-400 dark:text-slate-500">{thinkingSubtitle.text}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Results */}
      {result && elements && !scanning && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-5">
            <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">{scannedLabel.text}</p>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">{result.url}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                  <button
                    onClick={() => setView('walkthrough')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-md transition-colors cursor-pointer ${
                      view === 'walkthrough' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm' : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    <MonitorPlay className="w-3.5 h-3.5" /> {viewWalkthrough.text}
                  </button>
                  <button
                    onClick={() => setView('list')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-md transition-colors cursor-pointer ${
                      view === 'list' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm' : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    <ListBullets className="w-3.5 h-3.5" /> {viewAnnouncements.text}
                  </button>
                  <button
                    onClick={() => setView('json')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-md transition-colors cursor-pointer ${
                      view === 'json' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm' : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    <Code className="w-3.5 h-3.5" /> {viewJson.text}
                  </button>
                </div>
                <button
                  onClick={handleCopyJson}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 border border-blue-200 dark:border-blue-900/50 bg-blue-50 dark:bg-blue-950/30 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" /> {copyJsonLabel.text}
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {(Object.keys(TYPE_META) as (keyof typeof TYPE_META)[]).map((key) => {
                const meta = TYPE_META[key];
                const Icon = meta.icon;
                return (
                  <span key={key} className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded border ${meta.badge}`}>
                    <Icon className="w-3.5 h-3.5" />{' '}
                    {getContent('aiAutomation.elementCount', { text: '{count} {label}{plural}' }, { count: counts[key] || 0, label: meta.label, plural: counts[key] === 1 ? '' : 's' }).text}
                  </span>
                );
              })}
              <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 ml-auto">
                {getContent('aiAutomation.tabOrderSummary', { text: '{count} elements, tab order 1–{count}' }, { count: elements.length }).text}
              </span>
            </div>
          </div>

          {elements.length === 0 && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-10 text-center text-sm text-slate-400 dark:text-slate-500">
              {noElementsFound.text}
            </div>
          )}

          {view === 'walkthrough' && elements.length > 0 && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
              <div className="flex items-center justify-between gap-3 flex-wrap px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
                  {walkthroughHint.text}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => goToIndex(0)}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded-lg cursor-pointer transition-colors"
                  >
                    <Play className="w-3.5 h-3.5" weight="fill" /> {activeIndex === null ? startTabbingLabel.text : restartLabel.text}
                  </button>
                  {activeIndex !== null && (
                    <>
                      <button
                        onClick={() => goToIndex(activeIndex - 1)}
                        disabled={activeIndex === 0}
                        className="inline-flex items-center gap-1 text-xs font-bold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 rounded-lg cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" /> {prevLabel.text}
                      </button>
                      <span className="text-xs font-bold text-slate-400 dark:text-slate-500 tabular-nums">
                        {activeIndex + 1}/{elements.length}
                      </span>
                      <button
                        onClick={() => goToIndex(activeIndex + 1)}
                        disabled={activeIndex === elements.length - 1}
                        className="inline-flex items-center gap-1 text-xs font-bold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 rounded-lg cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {nextLabel.text} <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => liveAnnouncement && speak(liveAnnouncement.nvda_speech)}
                        title={replayTooltip.text}
                        className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900/50 bg-blue-50 dark:bg-blue-950/30 px-2.5 py-1.5 rounded-lg cursor-pointer"
                      >
                        <ArrowCounterClockwise className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={exitWalkthrough}
                        title={clearTooltip.text}
                        className="inline-flex items-center gap-1 text-xs font-bold text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 px-2.5 py-1.5 rounded-lg cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>

              <iframe
                ref={iframeRef}
                src={`${API_ORIGIN}/api/nvda-agent/proxy?url=${encodeURIComponent(result.url)}`}
                title={iframeTitle.text}
                className="w-full h-[65vh] bg-white border-0 block"
              />

              {liveAnnouncement && (
                <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    {TYPE_META[liveAnnouncement.element_type as NvdaElement['element_type']] && (
                      <span className={`shrink-0 w-6 h-6 rounded-lg flex items-center justify-center border ${TYPE_META[liveAnnouncement.element_type as NvdaElement['element_type']].badge}`}>
                        {React.createElement(TYPE_META[liveAnnouncement.element_type as NvdaElement['element_type']].icon, { className: 'w-3.5 h-3.5' })}
                      </span>
                    )}
                    <SpeakerHigh className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                    <span className="font-mono text-sm font-bold text-slate-800 dark:text-slate-200 wrap-break-word">{liveAnnouncement.nvda_speech}</span>
                  </div>
                  <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{liveAnnouncement.component_theory}</p>
                </div>
              )}
            </div>
          )}

          {view === 'json' && (
            <div className="rounded-xl overflow-hidden bg-slate-950 shadow-md border border-slate-900">
              <div className="flex items-center justify-between px-4 py-2 bg-slate-900 text-slate-400 text-xs font-mono border-b border-slate-900">
                <span className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500/80 inline-block" />
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80 inline-block" />
                  <span className="w-2.5 h-2.5 rounded-full bg-green-500/80 inline-block" />
                  <span className="ml-1 text-slate-500 font-sans font-semibold">nvda-announcements.json</span>
                </span>
              </div>
              <pre className="p-4 overflow-x-auto font-mono text-xs text-blue-200/90 leading-relaxed whitespace-pre bg-slate-950/95">
                {JSON.stringify(elements, null, 2)}
              </pre>
            </div>
          )}

          {view === 'list' && (
            <div className="space-y-2.5">
              {elements.map((el) => {
                const meta = TYPE_META[el.element_type];
                const Icon = meta.icon;
                return (
                  <motion.div
                    key={el.tab_order}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(el.tab_order * 0.015, 0.4) }}
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm p-4 flex items-start gap-3"
                  >
                    <div className="shrink-0 flex flex-col items-center gap-1.5">
                      <span className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[11px] font-bold flex items-center justify-center">
                        {el.tab_order}
                      </span>
                      <span className={`w-7 h-7 rounded-lg flex items-center justify-center border ${meta.badge}`}>
                        <Icon className="w-4 h-4" />
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <SpeakerHigh className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                        <span className="font-mono text-sm font-bold text-slate-800 dark:text-slate-200 wrap-break-word">{el.nvda_speech}</span>
                      </div>
                      <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{el.component_theory}</p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {!result && !scanning && !error && (
        <div className="bg-white dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl p-10 text-center">
          <Robot className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-400 dark:text-slate-500">
            {emptyStateText.text}
          </p>
        </div>
      )}
    </div>
  );
};
