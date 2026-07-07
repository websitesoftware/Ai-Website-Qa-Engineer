import React, { useState, useEffect } from 'react';
import { BugPrioritization } from '../components/ai-automation/BugPrioritization';
import { RootCauseAnalysis } from '../components/ai-automation/RootCauseAnalysis';
import { SuggestedFixes } from '../components/ai-automation/SuggestedFixes';
import { PullRequestGeneration } from '../components/ai-automation/PullRequestGeneration';
import { CicdIntegration } from '../components/ai-automation/CicdIntegration';

export const AIAutomationPage: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(true);
  const [data, setData] = useState<any>(null);

  const fetchAutomationPipelineData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/v1/ai-automation/status');
      const json = await response.json();
      setData(json);
    } catch (error) {
      console.error("Error fetching Phase 3 dashboard core orchestration data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAutomationPipelineData();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col items-center justify-center gap-3">
        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 tracking-wide animate-pulse">Initialising Phase 3 Systems...</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-50 dark:bg-slate-900 min-h-screen p-6 sm:p-8 text-slate-800 dark:text-slate-200 transition-colors duration-200">
      <header className="max-w-7xl mx-auto mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-6">
        <div>
          <div className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mb-1">Core Operations Suite</div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            Phase 3 – AI Automation Engine
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Continuous autonomous healing workspace connecting telemetry anomaly tracking directly to CI validation.
          </p>
        </div>

        <button
          onClick={fetchAutomationPipelineData}
          className="inline-flex items-center gap-2 justify-center px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-semibold text-sm rounded-lg shadow-sm hover:shadow transition-all duration-150 active:scale-[0.98] cursor-pointer"
        >
          <span>🔄</span> Refresh Telemetry Run
        </button>
      </header>

      {/* Grid Canvas responsive rendering individual pipeline segments */}
      <main className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <div className="space-y-1">
          <BugPrioritization data={data?.prioritization} />
          <RootCauseAnalysis data={data?.rca} />
          <PullRequestGeneration data={data?.pullRequest} />
        </div>

        <div className="space-y-1">
          <SuggestedFixes
            codeBefore={data?.fixes?.original || ''}
            codeAfter={data?.fixes?.patched || ''}
          />
          <CicdIntegration
            status={data?.cicd?.status}
            logs={data?.cicd?.logs || []}
          />
        </div>
      </main>
    </div>
  );
};