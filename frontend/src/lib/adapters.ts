import { BackendTest, BackendIssue } from './types';
import { categoryLabel } from './format';

export interface IssueRow {
  id: string; // backend issue id (unique within its test)
  testId: string;
  testUrl: string;
  repId: string;
  severity: BackendIssue['severity'];
  title: string;
  category: string;
  url: string;
  analysis: string;
  suggestion: string | null;
  resolved: boolean;
  detectedAt: string;
}

export function buildIssueRows(tests: BackendTest[]): IssueRow[] {
  const rows: IssueRow[] = [];

  tests.forEach((test) => {
    const repId = `REP-${new Date(test.createdAt).getFullYear()}-${test.id.slice(0, 4).toUpperCase()}`;
    test.issues.forEach((issue) => {
      rows.push({
        id: issue.id,
        testId: test.id,
        testUrl: test.url,
        repId,
        severity: issue.severity,
        title: issue.title,
        category: categoryLabel(issue.category),
        url: issue.url || test.url,
        analysis: issue.description || 'No further detail was captured for this finding.',
        suggestion: issue.suggestion,
        resolved: issue.resolved,
        detectedAt: issue.detectedAt,
      });
    });
  });

  return rows.sort((a, b) => new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime());
}
