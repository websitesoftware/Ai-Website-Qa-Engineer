'use client';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MagnifyingGlass, ArrowsClockwise, ArrowClockwise, Plus, Minus, LockSimple, SidebarSimple, Devices, Code, ArrowsOut, X, Star, AppleLogo, AndroidLogo, Monitor, WindowsLogo, ClockCounterClockwise } from '@phosphor-icons/react';
import { api, DeviceLabDevice } from '../lib/api';
import { DeviceFrame, DEVICE_FRAME_CHROME_HEIGHT, DeviceFrameHandlers } from '../components/devicelab/DeviceFrame';
import { DevToolsPanel } from '../components/devicelab/DevToolsPanel';
import { useDeviceLabSession } from '../hooks/useDeviceLabSession';

const FRAME_PANEL_PADDING = 64; // matches the p-8 padding around the viewer panel
const BEZEL_EXTRA = 24; // phone bezel adds ~12px padding on each side (p-3)

const RECENT_KEY = 'qa-device-lab-recent';
const MAX_RECENT = 5;
const FAVORITES_KEY = 'qa-device-lab-favorites';
const BRAND_ORDER = ['Apple', 'Samsung', 'Google', 'OnePlus', 'Motorola', 'Xiaomi', 'Vivo', 'Oppo', 'Huawei', 'Realme', 'Other'];
const OS_META: Record<string, { label: string; icon: typeof AppleLogo }> = {
  iOS: { label: 'iOS', icon: AppleLogo },
  Android: { label: 'Android', icon: AndroidLogo },
  Windows: { label: 'Windows', icon: WindowsLogo },
  Various: { label: 'Desktop', icon: Monitor },
};

function loadIds(key: string): string[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveRecent(deviceId: string) {
  const current = loadIds(RECENT_KEY).filter((id) => id !== deviceId);
  current.unshift(deviceId);
  localStorage.setItem(RECENT_KEY, JSON.stringify(current.slice(0, MAX_RECENT)));
}

// Devices aren't tagged with a brand server-side (the catalog groups by
// category/os only) — the flyout menu needs one, so it's inferred here from
// the device name's leading token.
function getBrand(device: DeviceLabDevice): string {
  const n = device.name;
  if (device.category === 'Desktop') return 'Desktop';
  if (/^iPhone|^iPad/.test(n)) return 'Apple';
  if (/^Galaxy|^Samsung/.test(n)) return 'Samsung';
  if (/^Pixel|^Google/.test(n)) return 'Google';
  if (/^OnePlus/.test(n)) return 'OnePlus';
  if (/^Redmi/.test(n)) return 'Xiaomi';
  if (/^realme/i.test(n)) return 'Realme';
  if (/^OPPO/i.test(n)) return 'Oppo';
  if (/^vivo|^iQOO/i.test(n)) return 'Vivo';
  if (/^Moto/.test(n)) return 'Motorola';
  if (/^Huawei/.test(n)) return 'Huawei';
  return 'Other';
}

// Pulled from the device's real user agent (not fabricated) — Android UAs
// carry the OS version, iOS UAs carry it as "OS 18_7" (underscore instead
// of a dot). Returns null for desktop UAs, which don't carry one.
function getOsVersion(device: DeviceLabDevice): string | null {
  const iosMatch = device.userAgent.match(/OS (\d+)[_.]?(\d+)?/);
  if (iosMatch) return iosMatch[2] ? `${iosMatch[1]}.${iosMatch[2]}` : iosMatch[1];
  const androidMatch = device.userAgent.match(/Android (\d+(?:\.\d+)?)/);
  if (androidMatch) return androidMatch[1];
  return null;
}

export const DeviceLabPage: React.FC = () => {
  const [devices, setDevices] = useState<DeviceLabDevice[]>([]);
  const [devicesLoading, setDevicesLoading] = useState(true);
  const [devicesError, setDevicesError] = useState('');
  const [search, setSearch] = useState('');
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [railTab, setRailTab] = useState<'favorites' | 'recent' | string>('recent');
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);
  const [showAllBrandDevices, setShowAllBrandDevices] = useState(false);

  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [browserEngine, setBrowserEngine] = useState<'chromium' | 'firefox' | 'webkit' | ''>('');
  const [zoom, setZoom] = useState(1);

  const [url, setUrl] = useState('https://example.com');
  const [hasStarted, setHasStarted] = useState(false);
  const [devToolsOpen, setDevToolsOpen] = useState(false);
  const [inspectMode, setInspectMode] = useState(false);
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
    inspected,
    inspectAt,
    clearInspected,
    storage,
    inspectStorage,
    performanceMetrics,
    inspectPerformance,
    memory,
    inspectMemory,
    source,
    sourceLoading,
    fetchSource,
  } = useDeviceLabSession();

  useEffect(() => {
    // Hydration-safe restore: localStorage doesn't exist during SSR, so this
    // can't be a useState lazy initializer — it must run post-mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRecentIds(loadIds(RECENT_KEY));
    setFavoriteIds(loadIds(FAVORITES_KEY));
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
    // the device view takes over the whole browser window so the content
    // inside the device renders as large and clear as possible, instead of
    // staying squeezed inside the app's normal panel layout.
    setSidebarOpen(false);
    setFullscreen(true);
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

  const favoriteDevices = useMemo(
    () => favoriteIds.map((id) => devices.find((d) => d.id === id)).filter((d): d is DeviceLabDevice => !!d),
    [favoriteIds, devices]
  );

  const toggleFavorite = (id: string) => {
    setFavoriteIds((prev) => {
      const next = prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id];
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
      return next;
    });
  };

  // OS tabs shown in the rail, in the order they appear in OS_META (falls
  // back to whatever the API actually returned if a new os value shows up).
  const osTabs = useMemo(() => {
    const present = Array.from(new Set(devices.map((d) => d.os)));
    const known = Object.keys(OS_META).filter((os) => present.includes(os));
    const unknown = present.filter((os) => !OS_META[os]);
    return [...known, ...unknown];
  }, [devices]);

  // Set the default rail tab once devices are in: land on Recent if the
  // user has history, otherwise the first OS group.
  useEffect(() => {
    if (devices.length === 0) return;
    if (recentIds.length === 0 && osTabs.length > 0) {
      // One-time default once the device list arrives — not a per-render sync.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRailTab(osTabs[0]);
    }
  }, [devices.length, recentIds.length, osTabs]);

  const brandsForTab = useMemo(() => {
    if (railTab === 'favorites' || railTab === 'recent') return [];
    const inOs = devices.filter((d) => d.os === railTab);
    const counts = new Map<string, number>();
    for (const d of inOs) counts.set(getBrand(d), (counts.get(getBrand(d)) || 0) + 1);
    const brands = Array.from(counts.keys());
    brands.sort((a, b) => {
      const ai = BRAND_ORDER.indexOf(a);
      const bi = BRAND_ORDER.indexOf(b);
      return (ai === -1 ? BRAND_ORDER.length : ai) - (bi === -1 ? BRAND_ORDER.length : bi);
    });
    return brands.map((brand) => ({ brand, count: counts.get(brand)! }));
  }, [devices, railTab]);

  // Keep the selected brand valid whenever the OS tab changes.
  useEffect(() => {
    if (brandsForTab.length === 0) {
      // Keeps selectedBrand valid whenever the brand *list* changes underneath it.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedBrand(null);
    } else if (!brandsForTab.some((b) => b.brand === selectedBrand)) {
      setSelectedBrand(brandsForTab[0].brand);
    }
    // selectedBrand intentionally excluded — this effect only reacts to the brand *list* changing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandsForTab]);

  const brandDevices = useMemo(() => {
    if (!selectedBrand || (railTab === 'favorites' || railTab === 'recent')) return [];
    return devices.filter((d) => d.os === railTab && getBrand(d) === selectedBrand);
  }, [devices, railTab, selectedBrand]);

  useEffect(() => {
    // Resets pagination whenever the selected brand changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShowAllBrandDevices(false);
  }, [selectedBrand]);

  const BRAND_PAGE_SIZE = 12;
  const visibleBrandDevices = showAllBrandDevices ? brandDevices : brandDevices.slice(0, BRAND_PAGE_SIZE);

  const handleRun = async (
    overrideOrientation?: 'portrait' | 'landscape',
    overrideEngine?: 'chromium' | 'firefox' | 'webkit' | ''
  ) => {
    if (!selectedDevice || !url.trim()) return;
    await start({
      url: url.trim(),
      deviceId: selectedDevice.id,
      orientation: overrideOrientation ?? orientation,
      browserEngine: (overrideEngine ?? browserEngine) || undefined,
    });
    setHasStarted(true);
    saveRecent(selectedDevice.id);
    setRecentIds(loadIds(RECENT_KEY));
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
    // Uncapped at 100% on purpose — full screen opens up a lot more room
    // than the device's native pixel size, and leaving that space unused
    // just makes the page's text look small. Scale up to fill it (capped
    // at 1.8x so it doesn't get soft from over-upscaling a raster shot).
    const scale = Math.min(
      (panelWidth - FRAME_PANEL_PADDING) / totalWidth,
      (panelHeight - FRAME_PANEL_PADDING) / totalHeight,
      1.8
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

  // A plain `position: fixed` wrapper wouldn't actually cover the whole
  // browser window here — the tab content above this component is animated
  // with framer-motion, and any ancestor with a `transform` style creates a
  // new containing block that traps `fixed` children inside its own box
  // instead of the viewport. Rendering through a portal into document.body
  // sidesteps that entirely, so "full screen" really means the full screen.
  const viewerBody = (
    <>
      {/* Device picker sidebar — collapses so the live device can use the
          full panel; toggled back open via the button in the toolbar. */}
      {sidebarOpen && (
        <aside
          className={`shrink-0 w-full bg-white/85 dark:bg-slate-800 backdrop-blur-md border border-slate-200/70 dark:border-slate-700 rounded-xl flex flex-col overflow-hidden transition-[width] max-h-80 sm:max-h-none ${
            search || brandsForTab.length === 0 ? 'sm:w-72' : 'sm:w-120'
          }`}
        >
          <div className="p-4 border-b border-slate-100 dark:border-slate-700">
            <h2 className="font-bold text-slate-900 dark:text-slate-100 text-sm mb-3">Device Lab</h2>
            <div className="relative">
              <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search devices..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border rounded-lg text-xs bg-slate-50 dark:bg-slate-950 border-slate-200/70 dark:border-slate-700 text-slate-800 dark:text-white focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500"
              />
            </div>
          </div>

          {devicesLoading && <p className="text-xs text-slate-400 px-4 py-3">Loading devices…</p>}
          {devicesError && <p className="text-xs text-red-500 px-4 py-3">{devicesError}</p>}

          {!devicesLoading && search ? (
            <div className="flex-1 overflow-y-auto p-3 space-y-4">
              {filteredGroups.length === 0 && <p className="text-xs text-slate-400 px-2">No devices match &ldquo;{search}&rdquo;.</p>}
              {filteredGroups.map(([groupLabel, groupDevices]) => (
                <div key={groupLabel}>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 mb-1">{groupLabel}</p>
                  {groupDevices.map((d) => (
                    <DeviceRow
                      key={d.id}
                      device={d}
                      selected={d.id === selectedDeviceId}
                      favorite={favoriteIds.includes(d.id)}
                      onToggleFavorite={() => toggleFavorite(d.id)}
                      onSelect={() => selectDevice(d.id)}
                    />
                  ))}
                </div>
              ))}
            </div>
          ) : (
            !devicesLoading && (
              <div className="flex-1 flex min-h-0">
                {/* Rail: Favourites / Recent Tests / one entry per OS */}
                <nav className="w-28 shrink-0 border-r border-slate-100 dark:border-slate-700 overflow-y-auto py-2">
                  <RailButton
                    active={railTab === 'favorites'}
                    icon={<Star weight={railTab === 'favorites' ? 'fill' : 'regular'} className="w-4 h-4" />}
                    label={`Favourites (${favoriteDevices.length})`}
                    onClick={() => setRailTab('favorites')}
                  />
                  <RailButton
                    active={railTab === 'recent'}
                    icon={<ClockCounterClockwise className="w-4 h-4" />}
                    label="Recent Tests"
                    onClick={() => setRailTab('recent')}
                  />
                  {osTabs.map((os) => {
                    const meta = OS_META[os];
                    const Icon = meta?.icon ?? Devices;
                    return (
                      <RailButton
                        key={os}
                        active={railTab === os}
                        icon={<Icon className="w-4 h-4" />}
                        label={meta?.label ?? os}
                        onClick={() => setRailTab(os)}
                      />
                    );
                  })}
                </nav>

                {/* Brand column — only for OS tabs that have brands to split on */}
                {brandsForTab.length > 0 && (
                  <div className="w-32 shrink-0 border-r border-slate-100 dark:border-slate-700 overflow-y-auto py-2">
                    {brandsForTab.map(({ brand, count }) => (
                      <button
                        key={brand}
                        onClick={() => setSelectedBrand(brand)}
                        className={`w-full text-left px-3 py-2 text-xs font-semibold cursor-pointer truncate ${
                          selectedBrand === brand
                            ? 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-400'
                            : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900'
                        }`}
                      >
                        {brand} <span className="text-slate-400 font-normal">({count})</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Device list for the active rail tab / brand */}
                <div className="flex-1 overflow-y-auto p-2 min-w-0">
                  {railTab === 'favorites' &&
                    (favoriteDevices.length === 0 ? (
                      <p className="text-xs text-slate-400 px-2 py-3">No favourites yet — tap the star on a device to pin it here.</p>
                    ) : (
                      favoriteDevices.map((d) => (
                        <DeviceRow
                          key={d.id}
                          device={d}
                          selected={d.id === selectedDeviceId}
                          favorite
                          onToggleFavorite={() => toggleFavorite(d.id)}
                          onSelect={() => selectDevice(d.id)}
                        />
                      ))
                    ))}

                  {railTab === 'recent' &&
                    (recentDevices.length === 0 ? (
                      <p className="text-xs text-slate-400 px-2 py-3">Devices you test on will show up here.</p>
                    ) : (
                      recentDevices.map((d) => (
                        <DeviceRow
                          key={d.id}
                          device={d}
                          selected={d.id === selectedDeviceId}
                          favorite={favoriteIds.includes(d.id)}
                          onToggleFavorite={() => toggleFavorite(d.id)}
                          onSelect={() => selectDevice(d.id)}
                        />
                      ))
                    ))}

                  {railTab !== 'favorites' && railTab !== 'recent' && (
                    <>
                      {visibleBrandDevices.map((d) => (
                        <DeviceRow
                          key={d.id}
                          device={d}
                          selected={d.id === selectedDeviceId}
                          favorite={favoriteIds.includes(d.id)}
                          onToggleFavorite={() => toggleFavorite(d.id)}
                          onSelect={() => selectDevice(d.id)}
                        />
                      ))}
                      {!showAllBrandDevices && brandDevices.length > BRAND_PAGE_SIZE && (
                        <button
                          onClick={() => setShowAllBrandDevices(true)}
                          className="w-full text-left px-2.5 py-2 text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                        >
                          Show {brandDevices.length - BRAND_PAGE_SIZE} More Devices
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            )
          )}
        </aside>
      )}

      {/* Main viewer */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* URL bar + toolbar */}
        <div className="bg-white/85 dark:bg-slate-800 backdrop-blur-md border border-slate-200/70 dark:border-slate-700 rounded-xl p-3 mb-4 flex flex-wrap items-center gap-2">
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            title={sidebarOpen ? 'Hide device list' : 'Switch device'}
            className={`p-2.5 rounded-xl border shadow-sm flex items-center gap-1.5 text-xs font-bold cursor-pointer shrink-0 ${sidebarOpen
                ? 'bg-white dark:bg-slate-900 border-slate-200/70 dark:border-slate-700 text-slate-500 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                : 'border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400'
              }`}
          >
            {sidebarOpen ? <SidebarSimple className="w-4 h-4" /> : <Devices className="w-4 h-4" />}
            {!sidebarOpen && selectedDevice && <span className="hidden sm:inline max-w-32 truncate">{selectedDevice.name}</span>}
          </button>

          <div className="relative flex-1 min-w-55">
            <LockSimple className="absolute left-3 top-1/2 -translate-y-1/2 text-orange-500 w-3.5 h-3.5" weight="fill" />
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleRun()}
              placeholder="https://your-site.com"
              className="w-full pl-9 pr-3 py-2.5 rounded-xl text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-200/70 dark:border-slate-700 text-slate-800 dark:text-white focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500"
            />
          </div>

          <button
            onClick={() => handleRun()}
            disabled={starting || !selectedDevice}
            className="px-4 py-2 rounded-xl bg-[#1C56C9] hover:bg-[#164aac] disabled:bg-blue-400 dark:bg-blue-600 dark:hover:bg-blue-500 text-white text-xs font-bold shadow-sm cursor-pointer"
          >
            {starting ? 'Loading…' : 'Go'}
          </button>

          <select
            value={browserEngine}
            onChange={(e) => {
              const next = e.target.value as typeof browserEngine;
              setBrowserEngine(next);
              // Switch the live session to the new engine immediately,
              // instead of leaving it pending until the next manual "Go".
              if (hasStarted) handleRun(orientation, next);
            }}
            className="px-3 py-2.5 rounded-xl text-xs bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-700 text-slate-700 dark:text-slate-200 shadow-sm cursor-pointer"
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
            className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-700 text-slate-500 dark:text-slate-300 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
          >
            <ArrowClockwise className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-1 bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-700 rounded-xl px-1 shadow-sm">
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
            className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-700 text-slate-500 dark:text-slate-300 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
          >
            <ArrowsClockwise className={`w-4 h-4 ${starting ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => setDevToolsOpen((v) => !v)}
            disabled={!hasStarted}
            title="DevTools"
            className={`p-2.5 rounded-xl border shadow-sm flex items-center gap-1.5 text-xs font-bold cursor-pointer disabled:opacity-40 ${devToolsOpen
                ? 'border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400'
                : 'bg-white dark:bg-slate-900 border-slate-200/70 dark:border-slate-700 text-slate-500 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
          >
            <Code className="w-4 h-4" />
          </button>

          <button
            onClick={() => setFullscreen((v) => !v)}
            title={fullscreen ? 'Exit full screen' : 'Full screen'}
            className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-700 text-slate-500 dark:text-slate-300 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
          >
            {fullscreen ? <X className="w-4 h-4" /> : <ArrowsOut className="w-4 h-4" />}
          </button>
        </div>

        {/* Device frame */}
        <div ref={framePanelRef} className="flex-1 bg-slate-100 dark:bg-slate-950/60 border border-slate-200/70 dark:border-slate-700 rounded-xl overflow-hidden flex items-center justify-center p-8">
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
              inspectMode={inspectMode}
              onInspectClick={(x, y) => inspectAt(x, y)}
              highlightRect={inspectMode ? inspected?.rect ?? null : null}
            />
          </div>
        </div>

        {hasStarted && devToolsOpen && (
          <DevToolsPanel
            consoleLogs={consoleLogs}
            networkRequests={networkRequests}
            domHtml={domHtml}
            onInspectDom={inspectDom}
            onClose={() => {
              setDevToolsOpen(false);
              setInspectMode(false);
            }}
            inspectMode={inspectMode}
            onToggleInspect={() => {
              setInspectMode((v) => !v);
              clearInspected();
            }}
            inspected={inspected}
            storage={storage}
            onInspectStorage={inspectStorage}
            performanceMetrics={performanceMetrics}
            onInspectPerformance={inspectPerformance}
            memory={memory}
            onInspectMemory={inspectMemory}
            source={source}
            sourceLoading={sourceLoading}
            onFetchSource={fetchSource}
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
    </>
  );

  if (fullscreen && typeof document !== 'undefined') {
    return createPortal(
      <div className="fixed inset-0 z-999 flex flex-col sm:flex-row gap-4 sm:gap-6 bg-slate-50 dark:bg-slate-950 p-3 sm:p-4 overflow-y-auto animate-fade-in">
        {viewerBody}
      </div>,
      document.body
    );
  }

  return <div className="flex flex-col sm:flex-row h-full gap-4 sm:gap-6 animate-fade-in">{viewerBody}</div>;
};

const RailButton: React.FC<{ active: boolean; icon: React.ReactNode; label: string; onClick: () => void }> = ({ active, icon, label, onClick }) => (
  <button
    onClick={onClick}
    title={label}
    className={`w-full flex flex-col items-center gap-1 px-1.5 py-2.5 text-center cursor-pointer ${
      active
        ? 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-400'
        : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900'
    }`}
  >
    {icon}
    <span className="text-[10px] font-semibold leading-tight line-clamp-2">{label}</span>
  </button>
);

const DeviceRow: React.FC<{
  device: DeviceLabDevice;
  selected: boolean;
  favorite: boolean;
  onToggleFavorite: () => void;
  onSelect: () => void;
}> = ({ device, selected, favorite, onToggleFavorite, onSelect }) => (
  <div
    className={`w-full flex items-center gap-1.5 pl-1 pr-2.5 py-2 rounded-lg text-xs transition-colors ${selected
        ? 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-400 font-bold'
        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900 font-medium'
      }`}
  >
    <button
      onClick={(e) => {
        e.stopPropagation();
        onToggleFavorite();
      }}
      title={favorite ? 'Remove from favourites' : 'Add to favourites'}
      className="shrink-0 p-0.5 cursor-pointer text-amber-400 hover:text-amber-500"
    >
      <Star weight={favorite ? 'fill' : 'regular'} className="w-3.5 h-3.5" />
    </button>
    <button onClick={onSelect} className="flex-1 min-w-0 flex items-center justify-between gap-2 text-left cursor-pointer">
      <span className="truncate">{device.name}</span>
      <span className="flex items-center gap-1.5 shrink-0">
        {getOsVersion(device) && <span className="text-[10px] text-slate-400">{getOsVersion(device)}</span>}
        <span className="text-[10px] text-slate-400">{device.width}×{device.height}</span>
      </span>
    </button>
  </div>
);
