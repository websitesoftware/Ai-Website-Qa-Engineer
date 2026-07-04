'use client';
import React, { useState } from 'react';
import { Layout } from '../components/Layout';
import { DashboardView } from '../pages/Dashboard';
import { TestManagementPage } from '../pages/TestManagementPage';
import { ReportsPage } from '../pages/ReportsPage';
import { useNewTestModal } from '../context/NewTestModalContext';

import { SettingsPage } from '../pages/settingspage';

type TabType = 'Dashboard' | 'Tests' | 'Reports' | 'Issues' | 'Settings';

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<TabType>('Dashboard');
  const { open } = useNewTestModal();

  const renderCanvasContent = () => {
    switch (activeTab) {
      case 'Dashboard':
        return <DashboardView />;
      case 'Tests':
        return <TestManagementPage />;
      case 'Reports':
        return <ReportsPage />;
      case 'Settings':
        return <SettingsPage />;
      default:
        return (
          <div className="p-8 bg-white rounded-xl border border-slate-200 text-slate-400 text-center animate-fade-in">
            <i className="ph ph-hourglass text-3xl mb-2 block"></i>
            {activeTab} content is coming soon!
          </div>
        );
    }
  };

  return (
    <div className="w-full h-screen overflow-hidden">
      <Layout
        currentUser="Rajat"
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onNewTestClick={open}
      >
        {renderCanvasContent()}
      </Layout>
    </div>
  );
}
