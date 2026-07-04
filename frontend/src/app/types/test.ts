export interface TestRun {
  id: string;
  targetUrl: string;
  testType: string;
  status: 'Running' | 'Completed' | 'Failed';
  statusDetails?: string;
  issues?: {
    critical: number;
  };
  score?: number;
  date: string;
}