'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BugPrioritization } from '../components/ai-automation/BugPrioritization';
import { RootCauseAnalysis } from '../components/ai-automation/RootCauseAnalysis';
import { SuggestedFixes } from '../components/ai-automation/SuggestedFixes';
import { PullRequestGeneration } from '../components/ai-automation/PullRequestGeneration';
import { CicdIntegration } from '../components/ai-automation/CicdIntegration';
import { API_BASE_URL } from '../lib/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface AutomationData {
  prioritization?: {
    bugId: string;
    title: string;
    severity: 'Critical' | 'High' | 'Medium' | 'Low';
    score: number;
    impactSummary: string;
  };
  rca?: {
    culpritFile: string;
    errorLine: number;
    explanation: string;
    confidence: number;
  };
  fixes?: {
    original: string;
    patched: string;
  };
  pullRequest?: {
    branchName: string;
    prTitle: string;
    prUrl: string;
    status: string;
  };
  cicd?: {
    status: 'Passed' | 'Failed' | 'Running' | 'Idle';
    logs: string[];
  };
}

// ---------------------------------------------------------------------------
// Demo pipeline generator
//
// The backend does not yet expose /ai-automation/status, so rather than
// leaving this page stuck on a skeleton forever (which is why it looked like
// it "wasn't showing up"), we simulate a realistic end-to-end automation run
// on the client. Swapping in the real endpoint later is a one-line change
// (see fetchAutomationPipelineData below) — everything else keeps working.
// ---------------------------------------------------------------------------
const BUG_TITLES = [
  'Checkout button unresponsive on mobile Safari',
  'Cart total miscalculates when a discount code is applied twice',
  'Login session drops after password reset',
  'Product image carousel throws on empty asset list',
];

function buildSimulatedRun(): AutomationData {
  const title = BUG_TITLES[Math.floor(Math.random() * BUG_TITLES.length)];
  const bugId = `QA-${1000 + Math.floor(Math.random() * 9000)}`;
  const confidence = 0.82 + Math.random() * 0.15;
  const branch = `ai-fix/${bugId.toLowerCase()}`;

  return {
    prioritization: {
      bugId,
      title,
      severity: 'Critical',
      score: 88 + Math.floor(Math.random() * 10),
      impactSummary:
        'Affects checkout completion for ~12% of mobile sessions in the last 24h. Flagged as release-blocking by the anomaly detector.',
    },
    rca: {
      culpritFile: 'src/components/checkout/CartSummary.tsx',
      errorLine: 142,
      explanation:
        'The discount reducer applies the promo code twice because the "APPLY" action is dispatched on both blur and submit without a guard, compounding the percentage discount.',
      confidence,
    },
    fixes: {
      original:
        `function applyDiscount(total, code) {\n  total = total - total * code.percent;\n  return total;\n}\n\n// Called on both onBlur and onSubmit\napplyDiscount(cartTotal, promo);`,
      patched:
        `function applyDiscount(total, code, appliedCodes) {\n  if (appliedCodes.has(code.id)) return total;\n  appliedCodes.add(code.id);\n  return total - total * code.percent;\n}\n\n// Guarded so onBlur + onSubmit can't double-apply\napplyDiscount(cartTotal, promo, appliedCodesRef.current);`,
    },
    pullRequest: {
      branchName: branch,
      prTitle: `fix(checkout): prevent double discount application (${bugId})`,
      prUrl: `https://github.com/your-org/website-qa-engineer/pull/${100 + Math.floor(Math.random() * 50)}`,
      status: 'Open',
    },
    cicd: {
      status: 'Idle',
      logs: [],
    },
  };
}

const CI_LOG_SCRIPT = [
  '[INFO] Checking out branch for automated fix...',
  '[INFO] Installing dependencies...',
  '[RUNNING] Executing unit + regression suite...',
  '[INFO] 214 tests passed, 0 failed, 3 skipped',
  '[RUNNING] Executing Phase 2 checks (a11y, visual regression)...',
  '[SUCCESS] All CI/CD gates passed. Ready to merge.',
];

type Stage = 'idle' | 'prioritizing' | 'rca' | 'fixing' | 'pr' | 'cicd' | 'done';

const STAGE_ORDER: Stage[] = ['prioritizing', 'rca', 'fixing', 'pr', 'cicd', 'done'];

export const AIAutomationPage: React.FC = () => {
  const [data, setData] = useState<AutomationData | null>(null);
  const [stage, setStage] = useState<Stage>('idle');
  const [ciLogs, setCiLogs] = useState<string[]>([]);
  const [usingLiveBackend, setUsingLiveBackend] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  const runSimulatedPipeline = useCallback(() => {
    clearTimers();
    const run = buildSimulatedRun();
    setUsingLiveBackend(false);
    setData(null);
    setCiLogs([]);
    setStage('prioritizing');

    const schedule = (delay: number, fn: () => void) => {
      timers.current.push(setTimeout(fn, delay));
    };

    // Reveal each stage in sequence so the pipeline feels alive.
    schedule(300, () => {
      setData((prev) => ({ ...(prev ?? {}), prioritization: run.prioritization }));
      setStage('prioritizing');
    });
    schedule(900, () => {
      setData((prev) => ({ ...(prev ?? {}), rca: run.rca }));
      setStage('rca');
    });
    schedule(1700, () => {
      setData((prev) => ({ ...(prev ?? {}), fixes: run.fixes }));
      setStage('fixing');
    });
    schedule(2500, () => {
      setData((prev) => ({ ...(prev ?? {}), pullRequest: run.pullRequest }));
      setStage('pr');
    });
    schedule(3200, () => {
      setData((prev) => ({ ...(prev ?? {}), cicd: { status: 'Running', logs: [] } }));
      setStage('cicd');
      CI_LOG_SCRIPT.forEach((line, i) => {
        schedule(400 * (i + 1), () => {
          setCiLogs((prevLogs) => [...prevLogs, line]);
        });
      });
      schedule(400 * CI_LOG_SCRIPT.length + 400, () => {
        setData((prev) => ({ ...(prev ?? {}), cicd: { status: 'Passed', logs: CI_LOG_SCRIPT } }));
        setStage('done');
      });
    });
  }, []);

  const fetchAutomationPipelineData = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/ai-automation/status`);
      if (!response.ok) throw new Error(`Request failed (${response.status})`);
      const json = await response.json();
      clearTimers();
      setUsingLiveBackend(true);
      setData(json);
      setCiLogs(json?.cicd?.logs || []);
      setStage('done');
    } catch {
      // No live Phase 3 backend yet (or it's unreachable) — fall back to the
      // simulated pipeline so the page still fully demonstrates the feature.
      runSimulatedPipeline();
    }
  }, [runSimulatedPipeline]);

  useEffect(() => {
    fetchAutomationPipelineData();
    return clearTimers;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isBooting = stage === 'idle';

  if (isBooting && !data) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col items-center justify-center gap-3">
        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 tracking-wide animate-pulse">
          Initialising Phase 3 Systems...
        </p>
      </div>
    );
  }

  const stageIndex = STAGE_ORDER.indexOf(stage);
  const progressPct = stage === 'idle' ? 0 : Math.round(((stageIndex + 1) / STAGE_ORDER.length) * 100);

  return (
    <div className="bg-slate-50 dark:bg-slate-900 min-h-screen p-6 sm:p-8 text-slate-800 dark:text-slate-200 transition-colors duration-200">
      <header className="max-w-7xl mx-auto mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-6">
        <div>
          <div className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mb-1 flex items-center gap-2">
            Core Operations Suite
            {!usingLiveBackend && (
              <span className="normal-case font-semibold text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900">
                Simulated run — connect backend for live data
              </span>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            Phase 3 – AI Automation Engine
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Continuous autonomous healing workspace connecting telemetry anomaly tracking directly to CI validation.
          </p>
        </div>

        <button
          onClick={fetchAutomationPipelineData}
          disabled={stage !== 'idle' && stage !== 'done'}
          className="inline-flex items-center gap-2 justify-center px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:bg-emerald-400 disabled:cursor-not-allowed text-white font-semibold text-sm rounded-lg shadow-sm hover:shadow transition-all duration-150 active:scale-[0.98] cursor-pointer"
        >
          <motion.span
            animate={stage !== 'idle' && stage !== 'done' ? { rotate: 360 } : { rotate: 0 }}
            transition={stage !== 'idle' && stage !== 'done' ? { repeat: Infinity, duration: 1, ease: 'linear' } : {}}
            className="inline-block"
          >
            🔄
          </motion.span>
          {stage !== 'idle' && stage !== 'done' ? 'Running Pipeline...' : 'Refresh Telemetry Run'}
        </button>
      </header>

      {/* Live pipeline progress bar */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex justify-between text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
          <span>Pipeline Progress</span>
          <span>{progressPct}%</span>
        </div>
        <div className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500"
            initial={{ width: 0 }}
            animate={{ width: `${progressPct}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
        </div>
      </div>

      {/* Grid Canvas responsive rendering individual pipeline segments */}
      <main className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <div className="space-y-1">
          <AnimatePresence mode="wait">
            {data?.prioritization && (
              <motion.div
                key="prioritization"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
              >
                <BugPrioritization data={data.prioritization} />
              </motion.div>
            )}
          </AnimatePresence>
          {!data?.prioritization && <BugPrioritization data={null} />}

          <AnimatePresence mode="wait">
            {data?.rca && (
              <motion.div
                key="rca"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: 'easeOut', delay: 0.05 }}
              >
                <RootCauseAnalysis data={data.rca} />
              </motion.div>
            )}
          </AnimatePresence>
          {!data?.rca && <RootCauseAnalysis data={null} />}

          <AnimatePresence mode="wait">
            {data?.pullRequest && (
              <motion.div
                key="pr"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: 'easeOut', delay: 0.1 }}
              >
                <PullRequestGeneration data={data.pullRequest} />
              </motion.div>
            )}
          </AnimatePresence>
          {!data?.pullRequest && <PullRequestGeneration data={null} />}
        </div>

        <div className="space-y-1">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: data?.fixes ? 1 : 0.5, y: 0 }}
            transition={{ duration: 0.4, ease: 'easeOut', delay: 0.05 }}
          >
            <SuggestedFixes
              codeBefore={data?.fixes?.original || ''}
              codeAfter={data?.fixes?.patched || ''}
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: data?.cicd ? 1 : 0.5, y: 0 }}
            transition={{ duration: 0.4, ease: 'easeOut', delay: 0.15 }}
          >
            <CicdIntegration
              status={data?.cicd?.status || 'Idle'}
              logs={ciLogs}
            />
          </motion.div>
        </div>
      </main>
    </div>
  );
};
