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
    async (url: string) => {
      const test = await createTest(url);
      showToast(`AI QA scan started for ${test.url}`, 'success');
      setIsOpen(false);
      openReport(test.id);
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
