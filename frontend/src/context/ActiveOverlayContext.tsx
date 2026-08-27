'use client';
import React, { createContext, useCallback, useContext, useState } from 'react';

// The app has two independent full-screen modals — NewTestModal (the "start
// a scan" form) and ReportDetailModal (results + live progress) — each with
// its own `fixed inset-0 backdrop-blur-sm` layer, mounted globally so they
// work from any tab. Nothing stopped both from being open at once (e.g.
// clicking "New Test" while a report was already open): two stacked
// translucent/blurred backdrops render as a blank, content-less white box,
// since there's no visible content in the overlap and the double blur
// washes out whatever's behind it.
//
// This context is the single choke point that fixes that: only one overlay
// id can be "claimed" at a time, so claiming one automatically evicts
// whichever was open before it. NewTestModalContext / ReportModalContext
// gate their own `isOpen` on `activeOverlay` instead of independent local
// booleans — see those files for how they call claim()/release().
export type OverlayId = 'new-test' | 'report' | null;

interface ActiveOverlayContextValue {
  activeOverlay: OverlayId;
  claim: (id: Exclude<OverlayId, null>) => void;
  // No-ops if `id` isn't the current holder — an overlay that already lost
  // the slot to something else can't clear the new owner out from under it.
  release: (id: Exclude<OverlayId, null>) => void;
}

const ActiveOverlayContext = createContext<ActiveOverlayContextValue | undefined>(undefined);

export const ActiveOverlayProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeOverlay, setActiveOverlay] = useState<OverlayId>(null);

  const claim = useCallback((id: Exclude<OverlayId, null>) => setActiveOverlay(id), []);
  const release = useCallback((id: Exclude<OverlayId, null>) => {
    setActiveOverlay((current) => (current === id ? null : current));
  }, []);

  return (
    <ActiveOverlayContext.Provider value={{ activeOverlay, claim, release }}>
      {children}
    </ActiveOverlayContext.Provider>
  );
};

export function useActiveOverlay() {
  const ctx = useContext(ActiveOverlayContext);
  if (!ctx) throw new Error('useActiveOverlay must be used within ActiveOverlayProvider');
  return ctx;
}
