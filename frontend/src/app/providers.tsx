'use client';
import React from 'react';
import { QADataProvider } from '../context/QADataContext';
import { ToastProvider } from '../context/ToastContext';
import { ReportModalProvider } from '../context/ReportModalContext';
import { NewTestModalProvider } from '../context/NewTestModalContext';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QADataProvider>
      <ToastProvider>
        <ReportModalProvider>
          <NewTestModalProvider>{children}</NewTestModalProvider>
        </ReportModalProvider>
      </ToastProvider>
    </QADataProvider>
  );
}
