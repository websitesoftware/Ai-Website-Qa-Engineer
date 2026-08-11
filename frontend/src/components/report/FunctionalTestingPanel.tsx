'use client';

import React, { useState } from 'react';
import { FunctionalComponent } from '../../lib/types';
import { api } from '../../lib/api';

function ExecutionBadge({ execution }: { execution: FunctionalComponent['execution'] }) {
  if (!execution) return null;
  const classes =
    execution.status === 'passed'
      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
      : execution.status === 'failed'
      ? 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400'
      : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400';
  return (
    <span className={`px-2 py-1 text-[10px] font-extrabold rounded-md uppercase tracking-wide shrink-0 ${classes}`}>
      {execution.status}
    </span>
  );
}

const ComponentCard: React.FC<{ component: FunctionalComponent }> = ({ component }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-white/85 dark:bg-slate-800 backdrop-blur-md rounded-xl border border-slate-200/70 dark:border-slate-700 shadow-sm overflow-hidden flex flex-col">
      <div className="aspect-video bg-slate-100 dark:bg-slate-900/50 flex items-center justify-center overflow-hidden">
        {component.screenshotPath ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={api.screenshotUrl(component.screenshotPath)} alt={component.name} className="w-full h-full object-cover object-top" />
        ) : (
          <span className="text-xs text-slate-400 dark:text-slate-500">No screenshot</span>
        )}
      </div>
      <div className="p-4 flex-1 flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100">{component.name}</h4>
          <ExecutionBadge execution={component.execution} />
        </div>
        <p className="text-xs font-semibold text-purple-600 dark:text-purple-400">{component.functionality}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">{component.description}</p>

        {component.steps.length > 0 && (
          <button
            onClick={() => setExpanded((e) => !e)}
            className="text-[11px] font-semibold text-[#1C56C9] dark:text-blue-400 text-left mt-1 cursor-pointer"
          >
            {expanded ? 'Hide' : 'Show'} {component.steps.length} generated step{component.steps.length === 1 ? '' : 's'}
          </button>
        )}

        {expanded && (
          <ul className="text-xs font-mono space-y-1 mt-1 border-t border-slate-100 dark:border-slate-800 pt-2">
            {component.steps.map((step, i) => (
              <li key={i} className="text-slate-600 dark:text-slate-400">
                {i + 1}. <span className="font-semibold">{step.action}</span> <code>{step.selector}</code>
                {step.value ? ` = "${step.value}"` : ''}
                {step.expected ? ` — expect: ${step.expected}` : ''}
              </li>
            ))}
          </ul>
        )}

        {component.execution && component.execution.status !== 'skipped' && (
          <div className="mt-2 border-t border-slate-100 dark:border-slate-800 pt-2 space-y-1">
            {component.execution.stepsLog.map((log, i) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                <span className={log.status === 'ok' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}>
                  {log.status === 'ok' ? '✓' : '✕'}
                </span>
                <span className="text-slate-600 dark:text-slate-400 flex-1">
                  {log.description}
                  {log.error && <span className="text-red-500 dark:text-red-400"> — {log.error}</span>}
                </span>
              </div>
            ))}
            {component.execution.afterScreenshotPath && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={api.screenshotUrl(component.execution.afterScreenshotPath)}
                alt={`${component.name} after execution`}
                className="w-full rounded-lg mt-2 border border-slate-200 dark:border-slate-700"
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export const FunctionalTestingPanel: React.FC<{ components: FunctionalComponent[] }> = ({ components }) => {
  if (!components.length) return null;

  const passed = components.filter((c) => c.execution?.status === 'passed').length;
  const failed = components.filter((c) => c.execution?.status === 'failed').length;
  const skipped = components.filter((c) => c.execution?.status === 'skipped').length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h4 className="font-display font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <i className="ph ph-play-circle text-purple-500"></i> Phase 3: Functional Testing
        </h4>
        <div className="flex items-center gap-2 text-xs font-semibold">
          <span className="text-emerald-600 dark:text-emerald-400">{passed} passed</span>
          <span className="text-slate-300 dark:text-slate-700">·</span>
          <span className="text-red-600 dark:text-red-400">{failed} failed</span>
          <span className="text-slate-300 dark:text-slate-700">·</span>
          <span className="text-slate-400 dark:text-slate-500">{skipped} skipped</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {components.map((component) => (
          <ComponentCard key={component.componentId} component={component} />
        ))}
      </div>
    </div>
  );
};
