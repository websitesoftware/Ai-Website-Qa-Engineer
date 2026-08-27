
'use client';
import React, { createContext, useCallback, useContext, useRef } from 'react';
import { NewTestModal } from '../components/test/NewTestModal';
import { useQAData } from './QADataContext';
import { useToast } from './ToastContext';
import { useReportModal } from './ReportModalContext';
import { useAuth } from './AuthContext';
import { useActiveOverlay } from './ActiveOverlayContext';

interface NewTestModalContextValue {
  open: () => void;
  close: () => void;
}

const NewTestModalContext = createContext<NewTestModalContextValue | undefined>(undefined);

export const NewTestModalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { activeOverlay, claim, release } = useActiveOverlay();
  const isOpen = activeOverlay === 'new-test';
  const { createTest } = useQAData();
  const { showToast } = useToast();
  const { openReport } = useReportModal();
  const { user } = useAuth();
  // Holds the test to open once NewTestModal's exit animation actually
  // completes (see onExited below) — not a fixed-delay guess.
  const pendingTestIdRef = useRef<string | null>(null);

  const open = useCallback(() => {
    if (!user) {
      showToast('Please sign in to run a scan — use the Account menu in the top right.', 'info');
      return;
    }
    claim('new-test');
  }, [user, showToast, claim]);
  const close = useCallback(() => release('new-test'), [release]);

  const handleStart = useCallback(
    async (url: string, modules: string[], policyId?: string) => {
      const test = await createTest(url, { modules, policyId });
      showToast(`AI QA scan started for ${test.url}`, 'success');
      pendingTestIdRef.current = test.id;
      release('new-test');
    },
    [createTest, showToast, release]
  );

  // NewTestModal's spring-physics exit transition has no fixed duration, so
  // a guessed setTimeout can fire before it's actually done — mounting
  // ReportDetailModal's own "fixed inset-0 backdrop-blur-sm" overlay while
  // the old one is still rendering produces a blank white glitch box (two
  // stacked backdrop-filter blur layers). Framer Motion's onExitComplete
  // fires only once the exit animation has truly finished, so wait for it.
  const handleExited = useCallback(() => {
    const testId = pendingTestIdRef.current;
    if (!testId) return;
    pendingTestIdRef.current = null;
    openReport(testId);
  }, [openReport]);

  return (
    <NewTestModalContext.Provider value={{ open, close }}>
      {children}
      <NewTestModal isOpen={isOpen} onClose={close} onStartTest={handleStart} onExited={handleExited} />
    </NewTestModalContext.Provider>
  );
};

export function useNewTestModal() {
  const ctx = useContext(NewTestModalContext);
  if (!ctx) throw new Error('useNewTestModal must be used within NewTestModalProvider');
  return ctx;
}