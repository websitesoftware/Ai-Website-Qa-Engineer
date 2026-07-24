'use client';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MagnifyingGlass, ArrowsClockwise, ArrowClockwise, Plus, Minus, Globe, SidebarSimple, Devices, Code } from '@phosphor-icons/react';
import { api, DeviceLabDevice } from '../lib/api';
import { DeviceFrame, DEVICE_FRAME_CHROME_HEIGHT, DeviceFrameHandlers } from '../components/devicelab/DeviceFrame';
import { DevToolsPanel } from '../components/devicelab/DevToolsPanel';
import { useDeviceLabSession } from '../hooks/useDeviceLabSession';

const FRAME_PANEL_PADDING = 64; // matches the p-8 padding around the viewer panel
const BEZEL_EXTRA = 24; // phone bezel adds ~12px padding on each side (p-3)

const RECENT_KEY = 'qa-device-lab-recent';
const MAX_RECENT = 5;

function loadRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveRecent(deviceId: string) {
  const current = loadRecent().filter((id) => id !== deviceId);
  current.unshift(deviceId);
  localStorage.setItem(RECENT_KEY, JSON.stringify(current.slice(0, MAX_RECENT)));
}

export const DeviceLabPage: React.FC = () => {
  const [devices, setDevices] = useState<DeviceLabDevice[]>([]);
  const [devicesLoading, setDevicesLoading] = useState(true);
  const [devicesError, setDevicesError] = useState('');
  const [search, setSearch] = useState('');
  const [recentIds, setRecentIds] = useState<string[]>([]);

  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [browserEngine, setBrowserEngine] = useState<'chromium' | 'firefox' | 'webkit' | ''>('');
  const [zoom, setZoom] = useState(1);

  const [url, setUrl] = useState('https://example.com');
  const [hasStarted, setHasStarted] = useState(false);
  const [devToolsOpen, setDevToolsOpen] = useState(false);
  const {
    connected,
    frame,
    currentUrl,
    starting,
    error: sessionError,
    start,
    sendInput,
    consoleLogs,
    networkRequests,
    domHtml,
    inspectDom,
  } = useDeviceLabSession();

  useEffect(() => {
    // Hydration-safe restore: localStorage doesn't exist during SSR, so this
    // can't be a useState lazy initializer — it must run post-mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRecentIds(loadRecent());
    api.deviceLab
      .listDevices()
      .then((res) => {
        setDevices(res.devices);
        if (res.devices.length > 0) setSelectedDeviceId(res.devices[0].id);
      })
      .catch((err) => setDevicesError(err instanceof Error ? err.message : 'Failed to load devices'))
      .finally(() => setDevicesLoading(false));
  }, []);

  const selectDevice = (id: string) => {
    setSelectedDeviceId(id);
    // A deliberate pick from the list is the moment to get out of the way —
    // the device view expands to the full panel instead of staying squeezed
    // next to the browsable list.
    setSidebarOpen(false);
  };

  const selectedDevice = useMemo(
    () => devices.find((d) => d.id === selectedDeviceId) ?? null,
    [devices, selectedDeviceId]
  );

  const recentDevices = useMemo(
    () => recentIds.map((id) => devices.find((d) => d.id === id)).filter((d): d is DeviceLabDevice => !!d),
    [recentIds, devices]
  );

  const filteredGroups = useMemo(() => {
    const term = search.trim().toLowerCase();
    const matched = term ? devices.filter((d) => d.name.toLowerCase().includes(term)) : devices;
    const groups = new Map<string, DeviceLabDevice[]>();
    for (const device of matched) {
      const key = `${device.category} · ${device.os}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(device);
    }
    return Array.from(groups.entries());
  }, [devices, search]);

  const handleRun = async (overrideOrientation?: 'portrait' | 'landscape') => {
    if (!selectedDevice || !url.trim()) return;
    await start({
      url: url.trim(),
      deviceId: selectedDevice.id,
      orientation: overrideOrientation ?? orientation,
      browserEngine: browserEngine || undefined,
    });
    setHasStarted(true);
    saveRecent(selectedDevice.id);
    setRecentIds(loadRecent());
  };

  const frameHandlers: DeviceFrameHandlers = {
    onTap: (x, y) => sendInput({ type: 'click', x, y }),
    onScroll: (deltaX, deltaY) => sendInput({ type: 'scroll', deltaX, deltaY }),
    onKey: (key, text) => (text ? sendInput({ type: 'type', text }) : sendInput({ type: 'key', key })),
  };

  const frameWidth = selectedDevice
    ? orientation === 'landscape' && selectedDevice.isMobile
      ? selectedDevice.height
      : selectedDevice.width
    : 0;
  const frameHeight = selectedDevice
    ? orientation === 'landscape' && selectedDevice.isMobile
      ? selectedDevice.width
      : selectedDevice.height
    : 0;

  const framePanelRef = useRef<HTMLDivElement>(null);

  // Fits the whole mockup (bezel + status bar + nav bar included) inside the
  // viewer panel whenever the device/orientation changes, so switching to a
  // tall phone doesn't scroll its notch/nav bar out of view. Manual zoom
  // (+/-) still overrides this until the next device/orientation change.
  const fitZoom = useCallback(() => {
    if (!selectedDevice || !framePanelRef.current) return;
    const chromeHeight = !selectedDevice.isMobile
      ? DEVICE_FRAME_CHROME_HEIGHT.desktop
      : selectedDevice.os === 'iOS'
        ? DEVICE_FRAME_CHROME_HEIGHT.mobileIOS
        : DEVICE_FRAME_CHROME_HEIGHT.mobileAndroid;
    const extra = selectedDevice.isMobile ? BEZEL_EXTRA : 0;
    const totalWidth = frameWidth + extra;
    const totalHeight = frameHeight + chromeHeight + extra;

    const { width: panelWidth, height: panelHeight } = framePanelRef.current.getBoundingClientRect();
    const scale = Math.min(
      (panelWidth - FRAME_PANEL_PADDING) / totalWidth,
      (panelHeight - FRAME_PANEL_PADDING) / totalHeight,
      1
    );
    setZoom(Math.max(0.2, scale));
  }, [selectedDevice, frameWidth, frameHeight]);

  // A ResizeObserver (rather than only a window resize listener) means the
  // frame re-fits whenever the panel itself changes size for any reason —
  // toggling the sidebar, not just resizing the browser window.
  useEffect(() => {
    fitZoom();
    const panel = framePanelRef.current;
    if (!panel) return;
    const observer = new ResizeObserver(() => fitZoom());
    observer.observe(panel);
    return () => observer.disconnect();
  }, [fitZoom]);

  return (
    <div className="flex h-full gap-6 animate-fade-in">
      {/* Device picker sidebar — collapses so the live device can use the
          full panel; toggled back open via the button in the toolbar. */}
      {sidebarOpen && (
      <aside className="w-72 shrink-0 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl flex flex-col overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-700">
          <h2 className="font-bold text-slate-900 dark:text-slate-100 text-sm mb-3">Device Lab</h2>
          <div className="relative">
            <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search devices..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border rounded-lg text-xs bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          {devicesLoading && <p className="text-xs text-slate-400 px-2">Loading devices…</p>}
          {devicesError && <p className="text-xs text-red-500 px-2">{devicesError}</p>}

          {!devicesLoading && recentDevices.length > 0 && !search && (
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 mb-1">Frequently Used</p>
              {recentDevices.map((d) => (
                <DeviceRow key={`recent-${d.id}`} device={d} selected={d.id === selectedDeviceId} onSelect={() => selectDevice(d.id)} />
              ))}
            </div>
          )}

          {filteredGroups.map(([groupLabel, groupDevices]) => (
            <div key={groupLabel}>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 mb-1">{groupLabel}</p>
              {groupDevices.map((d) => (
                <DeviceRow key={d.id} device={d} selected={d.id === selectedDeviceId} onSelect={() => selectDevice(d.id)} />
              ))}
            </div>
          ))}
        </div>
      </aside>
      )}

      {/* Main viewer */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* URL bar + toolbar */}
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 mb-4 flex flex-wrap items-center gap-2">
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            title={sidebarOpen ? 'Hide device list' : 'Switch device'}
            className={`p-2 rounded-lg border flex items-center gap-1.5 text-xs font-bold cursor-pointer shrink-0 ${
              sidebarOpen
                ? 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900'
                : 'border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400'
            }`}
          >
            {sidebarOpen ? <SidebarSimple className="w-4 h-4" /> : <Devices className="w-4 h-4" />}
            {!sidebarOpen && selectedDevice && <span className="hidden sm:inline max-w-32 truncate">{selectedDevice.name}</span>}
          </button>

          <div className="relative flex-1 min-w-55">
            <Globe className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleRun()}
              placeholder="https://your-site.com"
              className="w-full pl-9 pr-3 py-2 border rounded-lg text-xs bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500"
            />
          </div>

          <button
            onClick={() => handleRun()}
            disabled={starting || !selectedDevice}
            className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-xs font-bold cursor-pointer"
          >
            {starting ? 'Loading…' : 'Go'}
          </button>

          <select
            value={browserEngine}
            onChange={(e) => setBrowserEngine(e.target.value as typeof browserEngine)}
            className="px-2.5 py-2 border rounded-lg text-xs bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200"
            title="Browser engine"
          >
            <option value="">Default engine</option>
            <option value="chromium">Chromium</option>
            <option value="webkit">WebKit (Safari)</option>
            <option value="firefox">Firefox</option>
          </select>

          <button
            onClick={() => {
              const next = orientation === 'portrait' ? 'landscape' : 'portrait';
              setOrientation(next);
              // A rotated page reflows its layout, not just its viewport crop,
              // so the old screenshot would look stretched — restart the live
              // session at the new viewport.
              if (hasStarted) handleRun(next);
            }}
            disabled={!selectedDevice?.isMobile}
            title="Rotate device"
            className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900 disabled:opacity-40 cursor-pointer"
          >
            <ArrowClockwise className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-1 border border-slate-200 dark:border-slate-700 rounded-lg px-1">
            <button onClick={() => setZoom((z) => Math.max(0.25, z - 0.1))} className="p-1.5 text-slate-500 dark:text-slate-300 cursor-pointer" title="Zoom out">
              <Minus className="w-3.5 h-3.5" />
            </button>
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-300 w-9 text-center">{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom((z) => Math.min(2, z + 0.1))} className="p-1.5 text-slate-500 dark:text-slate-300 cursor-pointer" title="Zoom in">
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            onClick={() => sendInput({ type: 'reload' })}
            disabled={starting || !selectedDevice || !hasStarted}
            title="Refresh"
            className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900 disabled:opacity-40 cursor-pointer"
          >
            <ArrowsClockwise className={`w-4 h-4 ${starting ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => setDevToolsOpen((v) => !v)}
            disabled={!hasStarted}
            title="DevTools"
            className={`p-2 rounded-lg border flex items-center gap-1.5 text-xs font-bold cursor-pointer disabled:opacity-40 ${
              devToolsOpen
                ? 'border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400'
                : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900'
            }`}
          >
            <Code className="w-4 h-4" />
          </button>
        </div>

        {/* Device frame */}
        <div ref={framePanelRef} className="flex-1 bg-slate-100 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden flex items-center justify-center p-8">
          <div style={{ transform: `scale(${zoom})`, transition: 'transform 0.15s ease-out' }}>
            <DeviceFrame
              device={selectedDevice}
              frameWidth={frameWidth}
              frameHeight={frameHeight}
              frameImage={frame}
              currentUrl={currentUrl}
              starting={starting}
              connected={connected}
              handlers={hasStarted ? frameHandlers : undefined}
            />
          </div>
        </div>

        {hasStarted && devToolsOpen && (
          <DevToolsPanel
            consoleLogs={consoleLogs}
            networkRequests={networkRequests}
            domHtml={domHtml}
            onInspectDom={inspectDom}
            onClose={() => setDevToolsOpen(false)}
          />
        )}

        {/* Status strip */}
        <div className="mt-3 flex items-center justify-between text-xs">
          <div className="text-slate-500 dark:text-slate-400">
            {selectedDevice && (
              <span>
                {selectedDevice.name} · {frameWidth}×{frameHeight} · DPR {selectedDevice.deviceScaleFactor} ·{' '}
                {(browserEngine || selectedDevice.defaultBrowserType).toUpperCase()}
                {hasStarted && (connected ? ' · live' : ' · disconnected')}
              </span>
            )}
          </div>
          {sessionError && <span className="text-red-500 font-semibold">{sessionError}</span>}
        </div>
      </div>
    </div>
  );
};

const DeviceRow: React.FC<{ device: DeviceLabDevice; selected: boolean; onSelect: () => void }> = ({ device, selected, onSelect }) => (
  <button
    onClick={onSelect}
    className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-left text-xs transition-colors cursor-pointer ${
      selected
        ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-bold'
        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900 font-medium'
    }`}
  >
    <span className="truncate">{device.name}</span>
    <span className="text-[10px] text-slate-400 shrink-0">{device.width}×{device.height}</span>
  </button>
);
