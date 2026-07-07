
'use client';
import React, { createContext, useCallback, useContext, useState } from 'react';
import { NewTestModal } from '../components/test/NewTestModal';
import { useQAData } from './QADataContext';
import { useToast } from './ToastContext';
import { useReportModal } from './ReportModalContext';

interface NewTestModalContextValue {
  open: () => void;
  close: () => void;
}

const NewTestModalContext = createContext<NewTestModalContextValue | undefined>(undefined);

export const NewTestModalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const { createTest } = useQAData();
  const { showToast } = useToast();
  const { openReport } = useReportModal();

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  const handleStart = useCallback(
    async (url: string, modules: string[]) => {
      const test = await createTest(url, { modules });
      showToast(`AI QA scan started for ${test.url}`, 'success');
      setIsOpen(false);
      // Wait for NewTestModal's exit animation (~300ms spring transition) to
      // finish before mounting ReportDetailModal. Opening it immediately caused
      // two "fixed inset-0 backdrop-blur-sm" overlays to be stacked at the same
      // time, which produced a blank white glitch box on screen (a known
      // Chrome rendering issue with stacked backdrop-filter blur elements).
      setTimeout(() => {
        openReport(test.id);
      }, 300);
    },
    [createTest, showToast, openReport]
  );

  return (
    <NewTestModalContext.Provider value={{ open, close }}>
      {children}
      <NewTestModal isOpen={isOpen} onClose={close} onStartTest={handleStart} />
    </NewTestModalContext.Provider>
  );
};

export function useNewTestModal() {
  const ctx = useContext(NewTestModalContext);
  if (!ctx) throw new Error('useNewTestModal must be used within NewTestModalProvider');
  return ctx;
}