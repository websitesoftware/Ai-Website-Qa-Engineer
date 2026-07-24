'use client';
import React, { useEffect, useRef, useState } from 'react';
import {
  CellSignalFull,
  WifiHigh,
  BatteryFull,
  House,
  LockSimple,
  Plus,
  DotsThreeVertical,
  List,
  Circle,
  CaretLeft,
  DeviceMobile,
} from '@phosphor-icons/react';
import { DeviceLabDevice } from '../../lib/api';

const STATUS_BAR_H = 26;
const BROWSER_CHROME_H = 36;
const BOTTOM_NAV_H = 30;
const HOME_INDICATOR_H = 22;
const DESKTOP_TITLEBAR_H = 34;

function useClock() {
  const [time, setTime] = useState('');
  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }));
    tick();
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, []);
  return time;
}

function hostnameOf(url: string) {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

// Keys a real keyboard sends that aren't a single printable character —
// forwarded to Playwright's page.keyboard.press() as-is (names match).
const SPECIAL_KEYS = new Set([
  'Enter', 'Backspace', 'Tab', 'Escape', 'Delete',
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'Home', 'End', 'PageUp', 'PageDown',
]);

export interface DeviceFrameHandlers {
  onTap: (xCss: number, yCss: number) => void;
  onScroll: (deltaX: number, deltaY: number) => void;
  onKey: (key: string, text: string | null) => void;
}

export interface HighlightRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface DeviceFrameProps {
  device: DeviceLabDevice | null;
  frameWidth: number;
  frameHeight: number;
  frameImage: string;
  currentUrl: string;
  starting: boolean;
  connected: boolean;
  handlers?: DeviceFrameHandlers;
  // Chrome-style "inspect element" picker: while active, clicks are routed
  // to onInspectClick (which resolves the element under the point) instead
  // of tapping the live page, and highlightRect draws the selected
  // element's box outline over the screenshot.
  inspectMode?: boolean;
  onInspectClick?: (xCss: number, yCss: number) => void;
  highlightRect?: HighlightRect | null;
}

export const DeviceFrame: React.FC<DeviceFrameProps> = ({
  device,
  frameWidth,
  frameHeight,
  frameImage,
  currentUrl,
  starting,
  connected,
  handlers,
  inspectMode,
  onInspectClick,
  highlightRect,
}) => {
  const time = useClock();
  const screenRef = useRef<HTMLDivElement>(null);

  // React's synthetic onWheel is registered as a passive listener, so
  // e.preventDefault() inside it is silently ignored and the page behind
  // the device still scrolls. A native listener with { passive: false } is
  // the only way to actually stop that and keep scrolling confined to the
  // live page inside the frame. Hooks must run before any early return, so
  // this lives above the `!device` guard below.
  useEffect(() => {
    const el = screenRef.current;
    if (!el || !handlers) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      handlers.onScroll(e.deltaX, e.deltaY);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [handlers]);

  if (!device) {
    return <p className="text-sm text-slate-400">Select a device to begin.</p>;
  }

  const isDesktop = !device.isMobile;
  const isIOS = device.os === 'iOS';
  const host = currentUrl ? hostnameOf(currentUrl) : 'about:blank';
  const isLive = connected && !!frameImage;

  const handleTap = (e: React.MouseEvent) => {
    if (!screenRef.current) return;
    const rect = screenRef.current.getBoundingClientRect();
    const xCss = ((e.clientX - rect.left) / rect.width) * frameWidth;
    const yCss = ((e.clientY - rect.top) / rect.height) * frameHeight;
    if (inspectMode && onInspectClick) {
      onInspectClick(xCss, yCss);
      return;
    }
    handlers?.onTap(xCss, yCss);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!handlers) return;
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      handlers.onKey(e.key, e.key);
    } else if (SPECIAL_KEYS.has(e.key)) {
      e.preventDefault();
      handlers.onKey(e.key, null);
    }
  };

  const content = (
    <div
      ref={screenRef}
      tabIndex={handlers ? 0 : -1}
      onClick={handleTap}
      onKeyDown={handleKeyDown}
      className={`relative w-full h-full bg-white overflow-hidden ${
        inspectMode ? 'cursor-crosshair outline-none' : handlers ? 'cursor-pointer outline-none' : ''
      }`}
    >
      {frameImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={frameImage} alt={`${device.name} live view of ${currentUrl}`} className="block w-full h-full pointer-events-none select-none" draggable={false} />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-slate-400 px-6 text-center bg-slate-50">
          <DeviceMobile className="w-8 h-8" />
          <p className="text-xs font-medium">
            {starting ? 'Launching real browser engine…' : 'Enter a URL and press Go to open it live on this device.'}
          </p>
        </div>
      )}
      {isLive && (
        <div className="absolute top-1.5 right-1.5 flex items-center gap-1 bg-black/60 rounded-full px-2 py-0.5 z-30">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
          <span className="text-[9px] font-bold text-white tracking-wide">LIVE</span>
        </div>
      )}
      {highlightRect && frameWidth > 0 && frameHeight > 0 && (
        // Chrome DevTools-style content-box highlight: cyan fill, solid
        // outline, positioned as a % of the device viewport so it stays
        // aligned with the screenshot at any zoom level.
        <div
          className="absolute pointer-events-none z-40 bg-sky-400/30 outline-2 outline-sky-500"
          style={{
            left: `${(highlightRect.x / frameWidth) * 100}%`,
            top: `${(highlightRect.y / frameHeight) * 100}%`,
            width: `${(highlightRect.width / frameWidth) * 100}%`,
            height: `${(highlightRect.height / frameHeight) * 100}%`,
          }}
        />
      )}
    </div>
  );

  if (isDesktop) {
    return (
      <div className="rounded-xl overflow-hidden shadow-2xl border border-neutral-300" style={{ width: frameWidth }}>
        <div className="flex items-center gap-2 px-3 bg-neutral-200" style={{ height: DESKTOP_TITLEBAR_H }}>
          <div className="flex gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
            <span className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
            <span className="w-2.5 h-2.5 rounded-full bg-green-400" />
          </div>
          <div className="flex-1 flex items-center gap-1.5 bg-white rounded-md px-2.5 py-1 min-w-0">
            <LockSimple size={10} className="text-slate-400 shrink-0" />
            <span className="text-[11px] text-slate-600 truncate">{host}</span>
          </div>
        </div>
        <div style={{ width: frameWidth, height: frameHeight }}>{content}</div>
      </div>
    );
  }

  return (
    <div className="relative" style={{ width: frameWidth + 24 }}>
      {/* Side buttons */}
      <div className="absolute -right-[3px] rounded-r bg-neutral-700" style={{ top: '16%', width: 3, height: 46 }} />
      <div className="absolute -left-[3px] rounded-l bg-neutral-700" style={{ top: '13%', width: 3, height: 30 }} />
      <div className="absolute -left-[3px] rounded-l bg-neutral-700" style={{ top: '20%', width: 3, height: 30 }} />

      <div className="bg-gradient-to-b from-neutral-800 to-black rounded-[2.25rem] p-3 shadow-2xl">
        <div className="bg-white rounded-[1.5rem] overflow-hidden relative" style={{ width: frameWidth }}>
          {/* Punch-hole / notch camera */}
          <div className="absolute left-1/2 -translate-x-1/2 top-1.5 w-2.5 h-2.5 bg-black rounded-full z-20" />

          {/* Status bar */}
          <div className="flex items-center justify-between px-4 text-[11px] font-semibold text-black" style={{ height: STATUS_BAR_H }}>
            <span>{time}</span>
            <div className="flex items-center gap-1 text-black">
              <CellSignalFull size={12} weight="fill" />
              <WifiHigh size={12} weight="fill" />
              <BatteryFull size={15} weight="fill" />
            </div>
          </div>

          {/* Browser chrome */}
          <div className="flex items-center gap-1.5 px-2 border-b border-slate-100" style={{ height: BROWSER_CHROME_H }}>
            <House size={14} className="text-slate-500 shrink-0" />
            <div className="flex-1 flex items-center gap-1 bg-slate-100 rounded-full px-2.5 py-1 min-w-0">
              <LockSimple size={10} className="text-slate-400 shrink-0" />
              <span className="text-[10px] text-slate-600 truncate">{host}</span>
            </div>
            <Plus size={14} className="text-slate-500 shrink-0" />
            <div className="w-4 h-4 border border-slate-400 rounded text-[8px] flex items-center justify-center text-slate-500 shrink-0">1</div>
            <DotsThreeVertical size={14} className="text-slate-500 shrink-0" />
          </div>

          {/* Rendered content */}
          <div style={{ width: frameWidth, height: frameHeight }}>{content}</div>

          {/* Bottom bar */}
          {isIOS ? (
            <div className="flex items-center justify-center" style={{ height: HOME_INDICATOR_H }}>
              <div className="w-28 h-[5px] bg-black/80 rounded-full" />
            </div>
          ) : (
            <div className="flex items-center justify-center gap-10 text-slate-500" style={{ height: BOTTOM_NAV_H }}>
              <List size={16} />
              <Circle size={16} />
              <CaretLeft size={16} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export const DEVICE_FRAME_CHROME_HEIGHT = {
  mobileIOS: STATUS_BAR_H + BROWSER_CHROME_H + HOME_INDICATOR_H,
  mobileAndroid: STATUS_BAR_H + BROWSER_CHROME_H + BOTTOM_NAV_H,
  desktop: DESKTOP_TITLEBAR_H,
};
