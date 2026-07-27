// lib/phases.ts
//
// Derives a "remediation phase" for an issue: the order a team should actually
// work through the backlog, not the order the scanner happened to emit them.
//
// Phase = f(severity, effort). Severity comes from the scanner. Effort does NOT
// exist in your data, so it's inferred below.
//
// !!! TODO — READ THIS !!!
// Effort is matched against the human-readable `title` string. That is brittle:
// reword a title upstream and the issue silently falls into "Triage".
// The correct fix is to plumb the Lighthouse audit id (`unused-javascript`,
// `color-contrast`, `uses-responsive-images`, ...) through `buildIssueRows` into
// IssueRow, then key EFFORT_RULES off `row.auditId` with an exact map lookup.
// Do that and this file becomes reliable. Until then it is a heuristic.

import type { IssueRow } from './adapters';

export type Effort = 'low' | 'medium' | 'high';
export type PhaseId = 1 | 2 | 3 | 4;

export interface PhaseMeta {
  id: PhaseId;
  label: string;
  blurb: string;
  /** tailwind classes for the badge */
  badge: string;
}

export const PHASES: Record<PhaseId, PhaseMeta> = {
  1: {
    id: 1,
    label: 'Phase 1 — Ship Today',
    blurb: 'High impact, config-level. No architecture required.',
    badge: 'bg-red-50 text-red-700 border-red-200',
  },
  2: {
    id: 2,
    label: 'Phase 2 — This Sprint',
    blurb: 'Real code changes, contained to a component or asset pipeline.',
    badge: 'bg-orange-50 text-orange-700 border-orange-200',
  },
  3: {
    id: 3,
    label: 'Phase 3 — Structural',
    blurb: 'Touches build, bundle, or infra. Needs planning.',
    badge: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  },
  4: {
    id: 4,
    label: 'Phase 4 — Triage / Backlog',
    blurb: 'Low payoff, or effort unknown until someone opens DevTools.',
    badge: 'bg-slate-100 text-slate-600 border-slate-200',
  },
};

export const PHASE_ORDER: PhaseId[] = [1, 2, 3, 4];

// Shared severity badge/border styles — used by both the Issue Tracker list
// and the standalone ticket page so a severity always looks the same.
export const severityBadge: Record<string, string> = {
  critical: 'bg-red-50 text-red-600 border-red-100 dark:bg-red-950/40 dark:text-red-400 dark:border-red-900',
  high: 'bg-orange-50 text-orange-600 border-orange-100 dark:bg-orange-950/40 dark:text-orange-400 dark:border-orange-900',
  medium: 'bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900',
  low: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700',
};

export const severityBorder: Record<string, string> = {
  critical: 'border-red-500',
  high: 'border-orange-500',
  medium: 'border-amber-500',
  low: 'border-slate-400',
};

// ---------------------------------------------------------------------------
// Effort model
// ---------------------------------------------------------------------------
// low    = a header, a meta tag, a config flag, an attribute. Minutes.
// medium = editing components / assets / a build config. Hours.
// high   = bundle splitting, dependency majors, DOM rearchitecture. Days.

const EFFORT_RULES: { effort: Effort; test: RegExp }[] = [
  // --- low: one-liners, config, markup attributes -------------------------
  { effort: 'low', test: /meta description/i },
  { effort: 'low', test: /title tag|document title|page title/i },
  { effort: 'low', test: /viewport/i },
  { effort: 'low', test: /charset/i },
  { effort: 'low', test: /robots\.txt/i },
  { effort: 'low', test: /font[- ]display/i },
  { effort: 'low', test: /alt text|image alt|alt.*attribute/i },
  { effort: 'low', test: /contrast/i },
  { effort: 'low', test: /aria|accessible name|\blabel\b/i },
  { effort: 'low', test: /tap target|touch target/i },
  { effort: 'low', test: /text compression|gzip|brotli|compress/i },
  { effort: 'low', test: /preconnect/i },
  { effort: 'low', test: /x-frame|clickjacking/i },
  { effort: 'low', test: /https|mixed content/i },
  { effort: 'low', test: /minify/i },
  { effort: 'low', test: /cache|back\/forward/i },
  { effort: 'low', test: /http\/?2/i },

  // --- medium: component / asset / build edits -----------------------------
  { effort: 'medium', test: /lazy|offscreen/i },
  { effort: 'medium', test: /image.*(size|optimiz|next-gen|format)/i },
  { effort: 'medium', test: /render[- ]blocking/i },
  { effort: 'medium', test: /cumulative layout shift|\bcls\b/i },
  { effort: 'medium', test: /largest contentful paint|\blcp\b/i },
  { effort: 'medium', test: /heading|\bh1\b/i },
  { effort: 'medium', test: /duplicate id/i },
  { effort: 'medium', test: /form.*(label|input)/i },
  { effort: 'medium', test: /sitemap/i },
  { effort: 'medium', test: /broken link|404/i },
  { effort: 'medium', test: /unused css/i },

  // --- high: bundle / infra / dependency surgery ---------------------------
  { effort: 'high', test: /unused javascript/i },
  { effort: 'high', test: /dom[- ]size/i },
  { effort: 'high', test: /vulnerable.*librar/i },
  { effort: 'high', test: /csp|content security policy/i },
];

/** Returns undefined when nothing matches — that's meaningful, not a failure. */
export const getEffort = (title: string): Effort | undefined =>
  EFFORT_RULES.find((r) => r.test.test(title))?.effort;

// ---------------------------------------------------------------------------
// severity x effort -> phase
// ---------------------------------------------------------------------------
//                 low effort   medium effort   high effort   unknown
// critical/high      1              2              3            4
// medium/low         2              3              4            4

export const getPhase = (row: Pick<IssueRow, 'title' | 'severity'>): PhaseId => {
  const effort = getEffort(row.title);
  if (!effort) return 4; // can't estimate it -> it goes to triage. Be honest.

  const urgent = row.severity === 'critical' || row.severity === 'high';

  if (urgent) {
    if (effort === 'low') return 1;
    if (effort === 'medium') return 2;
    return 3;
  }

  if (effort === 'low') return 2;
  if (effort === 'medium') return 3;
  return 4;
};
