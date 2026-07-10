'use client';
import React from 'react';
import { motion } from 'framer-motion';
import { BackendTest, BackendPipelineItem } from '../lib/types';
import { useReportModal } from '../context/ReportModalContext';

const STAGE_ORDER = ['crawling', 'links', 'responsive', 'console', 'lighthouse', 'aggregating', 'done'];

const STEP_LABELS = [
  { key: 'crawling', label: 'Crawl' },
  { key: 'responsive', label: 'Responsive' },
  { key: 'lighthouse', label: 'Performance' },
  { key: 'console', label: 'Console' },
  { key: 'links', label: 'Links' },
];

type MinimalTest = Pick<BackendTest | BackendPipelineItem, 'id' | 'url' | 'status' | 'currentStage'>;

export const TestPipeline: React.FC<{ test?: MinimalTest | null }> = ({ test }) => {
  const { openReport } = useReportModal();

  if (!test) {
    return (
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center justify-center h-full text-center text-slate-400 py-12">
        <i className="ph ph-flask text-3xl mb-2"></i>
        <p className="text-sm">Run your first test to see live pipeline progress here.</p>
      </div>
    );
  }

  const currentStageIndex = STAGE_ORDER.indexOf(test.currentStage || '');

  return (
    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between h-full">
      <div>
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
          <div>
            <h3 className="font-bold text-slate-900">Latest Test Pipeline</h3>
            <p className="text-xs text-slate-500 mt-0.5">Automated crawl and system verification run metrics</p>
          </div>
          <span
            className={`font-medium text-xs px-2.5 py-1 rounded-full border ${test.status === 'passed'
                ? 'text-emerald-700 bg-emerald-50 border-emerald-100'
                : test.status === 'failed'
                  ? 'text-red-700 bg-red-50 border-red-100'
                  : test.status === 'error'
                    ? 'text-slate-600 bg-slate-100 border-slate-200'
                    : 'text-blue-700 bg-blue-50 border-blue-100'
              }`}
          >
            {test.status === 'passed'
              ? 'Passed'
              : test.status === 'failed'
                ? 'Failed'
                : test.status === 'error'
                  ? 'Error'
                  : 'Running'}
          </span>
        </div>

        <div className="flex items-center gap-2 font-semibold text-slate-900 mb-8 text-sm">
          <i className="ph ph-globe text-[#6366F1] text-lg"></i>
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
                    className={`w-9 h-9 rounded-full border flex items-center justify-center text-sm font-bold shadow-sm ${completed
                        ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                        : active
                          ? 'bg-indigo-50 text-indigo-500 border-indigo-300'
                          : 'bg-slate-50 text-slate-400 border-slate-200'
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
                  <span className="text-xs font-medium text-slate-600 mt-2">{step.label}</span>
                </div>
                {index < STEP_LABELS.length - 1 && (
                  <div
                    className={`h-[2px] flex-1 -mt-5 min-w-[30px] transition-colors duration-500 ${completed ? 'bg-emerald-200' : 'bg-slate-200'
                      }`}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      <div className="pt-6 border-t border-slate-100 mt-8 flex justify-end">
        <button
          onClick={() => openReport(test.id)}
          className="border border-[#6366F1] text-[#6366F1] hover:bg-indigo-50/50 font-medium text-sm px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
        >
          View Full Report
          <i className="ph ph-arrow-right"></i>
        </button>
      </div>
    </div>
  );
};
