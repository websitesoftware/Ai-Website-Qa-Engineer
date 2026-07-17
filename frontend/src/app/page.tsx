
'use client';
import React, { useState } from 'react';
import { Layout } from '../components/Layout';
import { DashboardView } from '../screens/Dashboard';
import { TestManagementPage } from '../screens/TestManagementPage';
// import { ReportsPage } from '../screens/ReportsPage';
import { useNewTestModal } from '../context/NewTestModalContext';
import { IssuesPage } from '../screens/IssuesPage';
import { Phase2ResultsPage } from '../screens/Phase2ResultsPage';
import { AIAutomationPage } from '../screens/AIAutomationPage';
import ScanlinePhase1Report from '../screens/phase1page';

import { SettingsPage } from '../screens/settingspage';

type TabType = 'Dashboard' | 'Tests' | 'Issues' | 'Settings' | 'Phase 2 Results' | 'AI Automation' | 'Phase 1 Results';

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<TabType>('Dashboard');
  const { open } = useNewTestModal();

  const renderCanvasContent = () => {
    switch (activeTab) {
      case 'Dashboard':
        return <DashboardView />;
      case 'Tests':
        return <TestManagementPage />;
      case 'Phase 2 Results':
        return <Phase2ResultsPage />;
      // case 'Reports':
      //   return <ReportsPage />;
      case 'Settings':
        return <SettingsPage />;
      case 'Issues':
        return <IssuesPage />;
      case 'AI Automation':
        return <AIAutomationPage />;
      case 'Phase 1 Results':
        return <ScanlinePhase1Report />;

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
