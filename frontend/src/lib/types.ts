export type TestStatus = 'queued' | 'running' | 'passed' | 'failed' | 'error';

export interface BackendIssue {
  id: string;
  category: 'broken-link' | 'console-error' | 'lighthouse' | string;
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

export interface BackendTest {
  id: string;
  name: string;
  url: string;
  status: TestStatus;
  progress: number;
  currentStage: string | null;
  score: number | null;
  scores: BackendScores;
  pagesScanned: number;
  issues: BackendIssue[];
  brokenLinks: BackendBrokenLink[];
  consoleErrors: BackendConsoleError[];
  screenshots: BackendScreenshot[];
  options: { maxPages?: number; maxDepth?: number; device?: string };
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
