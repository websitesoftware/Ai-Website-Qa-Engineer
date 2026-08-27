
export type TestStatus = 'queued' | 'running' | 'passed' | 'failed' | 'error';

export interface NvdaElement {
  tab_order: number;
  element_type: 'heading' | 'link' | 'button' | 'input' | 'image';
  nvda_speech: string;
  component_theory: string;
  rect: { x: number; y: number; width: number; height: number };
}

export interface NvdaScanResult {
  url: string;
  scannedAt: string;
  count: number;
  pageWidth: number;
  pageHeight: number;
  screenshot: string; // data: URL
  elements: NvdaElement[];
}

export interface BackendAppliedFix {
  filePath: string | null;
  fileFullPath?: string | null;
  line?: number | null;
  original: string;
  patched: string;
  grounded: boolean;
  autoFixable: boolean;
  repo?: string;
  prNumber?: number;
  prUrl?: string;
  branchName?: string;
  appliedAt: string;
  mergedAt: string | null;
}

export interface BackendIssueComment {
  id: string;
  authorId: string | null;
  authorName: string;
  authorEmail?: string | null;
  text: string;
  createdAt: string;
}

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
  // Real, observed locator info — present only when the scan actually
  // captured one (never fabricated).
  selector?: string | null;
  snippet?: string | null;
  sourceLocation?: { url: string; lineNumber?: number; columnNumber?: number } | null;
  // The real patch applied (or proposed) by the AI Automation pipeline, if any.
  appliedFix?: BackendAppliedFix | null;
  // Ticketing: team member ids assigned to this issue, and its comment thread.
  assigneeIds?: string[];
  comments?: BackendIssueComment[];
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
  options: { maxPages?: number; maxDepth?: number; device?: string; modules?: string[]; policyId?: string | null };
  createdBy?: string | null;
  createdByName?: string | null;
  monitorId?: string | null;
  policyResult?: BackendPolicyResult | null;
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

// ---- Phase 4 types ----

export interface PolicyScoreRange {
  min: number;
  max: number;
}

// A test passes a policy only when every one of these five scores falls
// inside its configured min-max range.
export interface PolicyScoreRanges {
  overallScore: PolicyScoreRange;
  performance: PolicyScoreRange;
  accessibility: PolicyScoreRange;
  seo: PolicyScoreRange;
  bestPractices: PolicyScoreRange;
}

export interface BackendPolicy {
  id: string;
  name: string;
  scoreRanges: PolicyScoreRanges;
  active: boolean;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BackendPolicyResult {
  policyId: string;
  policyName: string;
  passed: boolean;
  grade: 'Pass' | 'Fail';
  violations: string[];
}

export interface BackendBranding {
  primaryColor: string;
  footerText: string;
  headerText: string;
  headerFontSize: number;
  footerFontSize: number;
  logoWidth: number;
  logoHeight: number;
  logoUrl: string | null;
  updatedAt: string | null;
}


export type TeamRole = 'owner' | 'admin' | 'editor' | 'viewer';

export interface BackendTeamMember {
  id: string;
  name: string | null;
  email: string;
  role: TeamRole;
  teamStatus: 'active' | 'invited' | null;
  createdAt: string;
  testCount: number;
  lastActive: string | null;
}

export type MonitorFrequency = 'hourly' | 'daily' | 'weekly';

export interface BackendMonitor {
  id: string;
  url: string;
  name: string;
  frequency: MonitorFrequency;
  modules: string[];
  alertOnCritical: boolean;
  enabled: boolean;
  nextRunAt: number;
  lastRunAt: string | null;
  lastTestId: string | null;
  lastRunHadCriticalIssues: boolean;
  lastRunReconciled: boolean;
  createdBy: string | null;
  createdAt: string;
}

export interface AnalyticsScorePoint {
  date: string;
  avgScore: number | null;
  count: number;
}

export interface AnalyticsPassFailPoint {
  date: string;
  passed: number;
  failed: number;
}

export interface AnalyticsSeverityPoint {
  date: string;
  critical: number;
  high: number;
  medium: number;
  low: number;
}

export interface AnalyticsTopDomain {
  url: string;
  avgScore: number | null;
  testCount: number;
  lastScan: string;
}

export interface BackendAnalytics {
  scoreTrend: AnalyticsScorePoint[];
  passFailTrend: AnalyticsPassFailPoint[];
  issuesBySeverityTrend: AnalyticsSeverityPoint[];
  topDomains: AnalyticsTopDomain[];
  summary: {
    totalTests: number;
    avgScoreAllTime: number | null;
    avgScoreLast7d: number | null;
    scoreDeltaPct: number | null;
  };
}