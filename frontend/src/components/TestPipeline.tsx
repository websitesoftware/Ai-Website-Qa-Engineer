'use client';
import React from 'react';
import { motion } from 'framer-motion';
import { BackendTest, BackendPipelineItem } from '../lib/types';
import { useReportModal } from '../context/ReportModalContext';
import { useContent } from '../context/ContentContext';

const STAGE_ORDER = ['crawling', 'links', 'responsive', 'console', 'lighthouse', 'aggregating', 'done'];

const STEP_LABELS = [
  { key: 'crawling', label: 'Crawl', color: '#2FAE84' },
  { key: 'responsive', label: 'Responsive', color: '#2E7BF6' },
  { key: 'lighthouse', label: 'Performance', color: '#5AA0FF' },
  { key: 'console', label: 'Console', color: '#FF9FC6' },
  { key: 'links', label: 'Links', color: '#FFD36E' },
];

type MinimalTest = Pick<BackendTest | BackendPipelineItem, 'id' | 'url' | 'status' | 'currentStage'>;

export const TestPipeline: React.FC<{ test?: MinimalTest | null }> = ({ test }) => {
  const { openReport } = useReportModal();
  const title = useContent('dashboard.testPipeline.title', { text: 'Latest Test Pipeline' });
  const subtitle = useContent('dashboard.testPipeline.subtitle', { text: 'Automated crawl and system verification run metrics' });
  const emptyText = useContent('dashboard.testPipeline.emptyText', { text: 'Run your first test to see live pipeline progress here.', icon: 'ph-flask' });

  if (!test) {
    return (
      <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col items-center justify-center h-full text-center text-slate-400 dark:text-slate-500 py-12">
        <i className={`ph ${emptyText.icon} text-3xl mb-2`}></i>
        <p className="text-sm">{emptyText.text}</p>
      </div>
    );
  }

  const currentStageIndex = STAGE_ORDER.indexOf(test.currentStage || '');

  return (
    <div className="bg-white/85 dark:bg-slate-800 backdrop-blur-md p-6 rounded-2xl border border-slate-200/70 dark:border-slate-700 shadow-lg shadow-slate-900/5 flex flex-col justify-between h-full">
      <div>
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4 mb-4">
          <div>
            <h3 className="font-display font-bold text-slate-900 dark:text-slate-100">{title.text}</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{subtitle.text}</p>
          </div>
          <span
            className={`font-bold text-xs px-3 py-1.5 rounded-full text-white shadow-sm ${test.status === 'passed'
                ? 'bg-gradient-to-br from-[#2FAE84] to-[#1F8F6B]'
                : test.status === 'failed'
                  ? 'bg-gradient-to-br from-red-400 to-red-600'
                  : test.status === 'error'
                    ? 'bg-gradient-to-br from-slate-400 to-slate-600'
                    : 'bg-gradient-to-br from-[#4C93FF] to-[#1C56C9]'
              }`}
          >
            {test.status === 'passed'
              ? '✓ Passed'
              : test.status === 'failed'
                ? 'Failed'
                : test.status === 'error'
                  ? 'Error'
                  : 'Running'}
          </span>
        </div>

        <div className="inline-flex items-center gap-2 font-mono font-semibold text-[#1C56C9] dark:text-blue-400 bg-[#EAF2FF] dark:bg-blue-950/40 mb-8 text-xs px-3.5 py-2 rounded-lg max-w-full">
          <i className="ph ph-globe text-sm shrink-0"></i>
          <span className="truncate">{test.url}</span>
        </div>

        <div className="flex items-center w-full relative overflow-x-auto pb-2">
          {STEP_LABELS.map((step, index) => {
            const stepStageIndex = STAGE_ORDER.indexOf(step.key);
            const completed = test.status === 'passed' || test.status === 'failed' ? true : currentStageIndex > stepStageIndex;
            const active = test.status === 'running' && currentStageIndex === stepStageIndex;

            return (
              <React.Fragment key={step.key}>
                <div className="flex flex-col items-center flex-1 min-w-[70px] relative z-10">
                  <motion.div
                    initial={false}
                    animate={{ scale: active ? [1, 1.12, 1] : 1 }}
                    transition={{ duration: 1.2, repeat: active ? Infinity : 0 }}
                    style={completed ? { background: step.color, borderColor: step.color } : undefined}
                    className={`w-9 h-9 rounded-full border-2 flex items-center justify-center text-sm font-bold shadow-sm text-white ${
                      completed
                        ? ''
                        : active
                          ? 'bg-[#2E7BF6] text-white border-[#2E7BF6] dark:bg-blue-600 dark:border-blue-500'
                          : 'bg-slate-50 text-slate-400 border-slate-200 dark:bg-slate-900/50 dark:text-slate-500 dark:border-slate-700'
                    }`}
                  >
                    {completed ? (
                      <i className="ph ph-check"></i>
                    ) : active ? (
                      <i className="ph ph-spinner-gap animate-spin"></i>
                    ) : (
                      index + 1
                    )}
                  </motion.div>
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-400 mt-2">{step.label}</span>
                </div>
                {index < STEP_LABELS.length - 1 && (
                  <div
                    className="h-[2px] flex-1 -mt-5 min-w-[30px] transition-colors duration-500 dark:opacity-70"
                    style={{
                      background: completed
                        ? `linear-gradient(90deg, ${step.color}, ${STEP_LABELS[index + 1].color})`
                        : undefined,
                    }}
                  >
                    {!completed && <div className="w-full h-full bg-slate-200 dark:bg-slate-700" />}
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      <div className="pt-6 border-t border-slate-100 dark:border-slate-800 mt-8 flex justify-end">
        <button
          onClick={() => openReport(test.id)}
          className="bg-[#1C56C9] hover:bg-[#164aac] dark:bg-blue-600 dark:hover:bg-blue-500 text-white font-bold text-sm px-5 py-2.5 rounded-xl shadow-md shadow-blue-900/20 transition-colors flex items-center gap-2 cursor-pointer"
        >
          View Full Report
          <i className="ph ph-arrow-right"></i>
        </button>
      </div>
    </div>
  );
};
