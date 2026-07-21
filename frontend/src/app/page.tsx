
'use client';
import React, { useState } from 'react';
import { Layout } from '../components/Layout';
import { TestManagementPage } from '../screens/TestManagementPage';
import { useNewTestModal } from '../context/NewTestModalContext';
import { DashboardHub } from '../screens/DashboardHub';
import { ScanResultsPage } from '../screens/ScanResultsPage';
import { AutomationPage } from '../screens/AutomationPage';

import { SettingsPage } from '../screens/settingspage';

type TabType = 'Dashboard' | 'Tests' | 'Scan Results' | 'Automation' | 'Settings';

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<TabType>('Dashboard');
  const { open } = useNewTestModal();

  const renderCanvasContent = () => {
    switch (activeTab) {
      case 'Dashboard':
        return <DashboardHub />;
      case 'Tests':
        return <TestManagementPage />;
      case 'Scan Results':
        return <ScanResultsPage />;
      case 'Automation':
        return <AutomationPage />;
      case 'Settings':
        return <SettingsPage />;

      default:
        return (
          <div className="p-8 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 text-center animate-fade-in">
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
