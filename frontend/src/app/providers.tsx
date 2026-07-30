'use client';
import React from 'react';
import { AuthProvider } from '../context/AuthContext';
import { QADataProvider } from '../context/QADataContext';
import { ToastProvider } from '../context/ToastContext';
import { ReportModalProvider } from '../context/ReportModalContext';
import { NewTestModalProvider } from '../context/NewTestModalContext';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ToastProvider>
        <QADataProvider>
          <ReportModalProvider>
            <NewTestModalProvider>{children}</NewTestModalProvider>
          </ReportModalProvider>
        </QADataProvider>
      </ToastProvider>
    </AuthProvider>
  );
}
