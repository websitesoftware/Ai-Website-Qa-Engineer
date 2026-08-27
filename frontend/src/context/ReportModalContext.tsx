'use client';
import React, { createContext, useCallback, useContext, useState } from 'react';
import { ReportDetailModal } from '../components/report/ReportDetailModal';
import { useActiveOverlay } from './ActiveOverlayContext';

interface ReportModalContextValue {
  openReport: (testId: string) => void;
  closeReport: () => void;
}

const ReportModalContext = createContext<ReportModalContextValue | undefined>(undefined);

export const ReportModalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeTestId, setActiveTestId] = useState<string | null>(null);
  const { activeOverlay, claim, release } = useActiveOverlay();

  const openReport = useCallback(
    (testId: string) => {
      setActiveTestId(testId);
      claim('report');
    },
    [claim]
  );
  const closeReport = useCallback(() => release('report'), [release]);

  // Gated on activeOverlay, not just activeTestId — claiming 'new-test'
  // elsewhere evicts this overlay even if activeTestId is still set, so
  // reopening it later doesn't need a fresh testId.
  const visibleTestId = activeOverlay === 'report' ? activeTestId : null;

  return (
    <ReportModalContext.Provider value={{ openReport, closeReport }}>
      {children}
      <ReportDetailModal testId={visibleTestId} onClose={closeReport} />
    </ReportModalContext.Provider>
  );
};

export function useReportModal() {
  const ctx = useContext(ReportModalContext);
  if (!ctx) throw new Error('useReportModal must be used within ReportModalProvider');
  return ctx;
}
