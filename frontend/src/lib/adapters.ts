import { BackendTest, BackendIssue, BackendAppliedFix, BackendIssueComment } from './types';
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
  appliedFix?: BackendAppliedFix | null;
  assigneeIds: string[];
  comments: BackendIssueComment[];
  // First available page screenshot from the scan this issue came from — a
  // real full-page shot, not a cropped element image (that's not captured
  // today), but the closest honest visual reference for the ticket card.
  screenshotPath: string | null;
}

export function buildIssueRows(tests: BackendTest[]): IssueRow[] {
  const rows: IssueRow[] = [];

  tests.forEach((test) => {
    const repId = `REP-${new Date(test.createdAt).getFullYear()}-${test.id.slice(0, 4).toUpperCase()}`;
    const screenshotPath = test.screenshots?.find((s) => s.path)?.path ?? null;
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
        appliedFix: issue.appliedFix,
        assigneeIds: issue.assigneeIds || [],
        comments: issue.comments || [],
        screenshotPath,
      });
    });
  });

  return rows.sort((a, b) => new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime());
}
