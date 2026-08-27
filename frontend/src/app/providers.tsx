'use client';
import React from 'react';
import { AuthProvider } from '../context/AuthContext';
import { QADataProvider } from '../context/QADataContext';
import { ToastProvider } from '../context/ToastContext';
import { ReportModalProvider } from '../context/ReportModalContext';
import { NewTestModalProvider } from '../context/NewTestModalContext';
import { ActiveOverlayProvider } from '../context/ActiveOverlayContext';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ToastProvider>
        <QADataProvider>
          {/* Must wrap both modal providers — it's the single choke point
              that keeps their two independent full-screen overlays from
              ever being open at once (see ActiveOverlayContext). */}
          <ActiveOverlayProvider>
            <ReportModalProvider>
              <NewTestModalProvider>{children}</NewTestModalProvider>
            </ReportModalProvider>
          </ActiveOverlayProvider>
        </QADataProvider>
      </ToastProvider>
    </AuthProvider>
  );
}
