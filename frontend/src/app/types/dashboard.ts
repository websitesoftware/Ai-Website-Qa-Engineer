export interface StatCardProps {
  title: string;
  value: string | number;
  subValue?: string;
  icon: string;
  variant: 'primary' | 'warning' | 'danger' | 'success';
}

export interface PipelineStep {
  name: string;
  status: 'completed' | 'pending' | 'failed';
}

export interface TestPipelineData {
  url: string;
  statusText: string;
  steps: PipelineStep[];
}

export interface IssueItem {
  id: string;
  label: string;
  count: number;
  severity: 'high' | 'medium' | 'low' | 'info';
}