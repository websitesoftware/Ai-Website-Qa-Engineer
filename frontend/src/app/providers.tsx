'use client';
import React from 'react';
import { AuthProvider } from '../context/AuthContext';
import { QADataProvider } from '../context/QADataContext';
import { ToastProvider } from '../context/ToastContext';
import { ReportModalProvider } from '../context/ReportModalContext';
import { NewTestModalProvider } from '../context/NewTestModalContext';
import { ContentProvider } from '../context/ContentContext';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ToastProvider>
        <ContentProvider>
          <QADataProvider>
            <ReportModalProvider>
              <NewTestModalProvider>{children}</NewTestModalProvider>
            </ReportModalProvider>
          </QADataProvider>
        </ContentProvider>
      </ToastProvider>
    </AuthProvider>
  );
}
