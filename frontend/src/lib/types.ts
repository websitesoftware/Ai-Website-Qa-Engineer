
export type TestStatus = 'queued' | 'running' | 'passed' | 'failed' | 'error';

export interface BackendIssue {
  id: string;
  category: 'broken-link' | 'console-error' | 'lighthouse' | 'accessibility' | 'seo' | 'visual-regression' | 'cross-browser' | string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  url: string | null;
  suggestion: string | null;
  resolved: boolean;
  detectedAt: string;
}

export interface BackendScreenshot {
  viewport: string;
  width?: number;
  height?: number;
  path?: string;
  error?: string;
}

export interface BackendBrokenLink {
  url: string;
  statusCode: number;
  error?: string;
}

export interface BackendConsoleError {
  type: string;
  text: string;
  location?: unknown;
}

export interface BackendScores {
  performance: number | null;
  accessibility: number | null;
  seo: number | null;
  bestPractices: number | null;
}

// ---- Phase 2 types ----

export interface BackendAccessibilityViolation {
  id: string;
  impact: 'critical' | 'serious' | 'moderate' | 'minor' | null;
  description: string;
  help: string;
  helpUrl: string;
  nodes: number;
  targets: string[];
}

export interface BackendAccessibilityResult {
  violations: BackendAccessibilityViolation[];
  passes: number;
  incomplete: number;
  error?: string;
}

export interface BackendSEOCheck {
  id: string;
  passed: boolean;
  message: string;
}

export interface BackendSEOResult {
  checks: BackendSEOCheck[];
  score: number | null;
}

export interface BackendVisualRegressionResult {
  viewport: string;
  isNewBaseline: boolean;
  diffPixels?: number;
  diffPercentage?: number;
  significant?: boolean;
  diffImagePath?: string | null;
  baselinePath?: string;
  error?: string;
}

export interface BackendCrossBrowserResult {
  browser: 'chromium' | 'firefox' | 'webkit';
  ok: boolean;
  statusCode?: number | null;
  loadTimeMs?: number;
  consoleErrors?: string[];
  error?: string;
}

export interface BackendPerformanceMetrics {
  firstContentfulPaint: number | null;
  largestContentfulPaint: number | null;
  totalBlockingTime: number | null;
  cumulativeLayoutShift: number | null;
  speedIndex: number | null;
  timeToInteractive: number | null;
}

export interface BackendPerformanceBenchmark {
  metrics: BackendPerformanceMetrics;
  previousMetrics: BackendPerformanceMetrics | null;
  delta: Partial<Record<keyof BackendPerformanceMetrics, number>>;
  comparedAgainstTestId: string | null;
}

export const PHASE2_MODULES = [
  { id: 'accessibility', label: 'Accessibility Testing', description: 'WCAG 2.1 AA scan via axe-core.' },
  { id: 'seo', label: 'SEO Auditing', description: 'Titles, meta tags, headings, alt text, structured data.' },
  { id: 'visual-regression', label: 'Visual Regression', description: 'Pixel-diff screenshots against the last baseline.' },
  { id: 'cross-browser', label: 'Cross-Browser Testing', description: 'Loads the page in Chromium, Firefox, and WebKit.' },
  { id: 'performance-benchmark', label: 'Performance Benchmarking', description: 'Core Web Vitals trend vs. the previous run.' },
] as const;

export type Phase2ModuleId = (typeof PHASE2_MODULES)[number]['id'];

export interface BackendTest {
  id: string;
  name: string;
  url: string;
  status: TestStatus;
  progress: number;
  currentStage: string | null;
  score: number | null;
  scores: BackendScores;
  metrics?: BackendPerformanceMetrics;
  pagesScanned: number;
  issues: BackendIssue[];
  brokenLinks: BackendBrokenLink[];
  consoleErrors: BackendConsoleError[];
  screenshots: BackendScreenshot[];
  accessibility?: BackendAccessibilityResult;
  seo?: BackendSEOResult;
  visualRegression?: BackendVisualRegressionResult[];
  crossBrowser?: BackendCrossBrowserResult[];
  performanceBenchmark?: BackendPerformanceBenchmark | null;
  options: { maxPages?: number; maxDepth?: number; device?: string; modules?: string[] };
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  error: string | null;
}

export interface BackendStats {
  total: number;
  passed: number;
  failed: number;
  running: number;
  avgScore: number | null;
  totalIssues: number;
  unresolvedIssues: number;
  issuesBySeverity: { critical: number; high: number; medium: number; low: number };
}

export interface BackendPipelineItem {
  id: string;
  name: string;
  url: string;
  status: TestStatus;
  progress: number;
  currentStage: string | null;
  startedAt: string | null;
}

export interface BackendPipeline {
  activeScans: BackendPipelineItem[];
  activeCount: number;
  pendingCount: number;
}