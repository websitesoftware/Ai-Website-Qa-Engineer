'use client';
import React, { createContext, useCallback, useContext, useState } from 'react';
import { ReportDetailModal } from '../components/report/ReportDetailModal';

interface ReportModalContextValue {
  openReport: (testId: string) => void;
  closeReport: () => void;
}

const ReportModalContext = createContext<ReportModalContextValue | undefined>(undefined);

export const ReportModalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeTestId, setActiveTestId] = useState<string | null>(null);

  const openReport = useCallback((testId: string) => setActiveTestId(testId), []);
  const closeReport = useCallback(() => setActiveTestId(null), []);

  return (
    <ReportModalContext.Provider value={{ openReport, closeReport }}>
      {children}
      <ReportDetailModal testId={activeTestId} onClose={closeReport} />
    </ReportModalContext.Provider>
  );
};

export function useReportModal() {
  const ctx = useContext(ReportModalContext);
  if (!ctx) throw new Error('useReportModal must be used within ReportModalProvider');
  return ctx;
}
