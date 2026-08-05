
import {
  BackendTest,
  BackendStats,
  BackendPipeline,
  BackendIssue,
  BackendPolicy,
  BackendBranding,
  BackendTeamMember,
  BackendMonitor,
  BackendAnalytics,
  PolicyScoreRanges,
  MonitorFrequency,
  TeamRole,
} from './types';

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000/api';

export const API_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, '');

// Same storage key AuthContext persists the session under — read directly
// so any api.ts call can attach the token without threading it through
// every component.
const AUTH_STORAGE_KEY = 'qa_auth';

function getAuthToken(): string | null {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY) || sessionStorage.getItem(AUTH_STORAGE_KEY);
    return raw ? JSON.parse(raw).token ?? null : null;
  } catch {
    return null;
  }
}

async function request<T>(path: string, options?: RequestInit, requireAuth = false): Promise<T> {
  const token = getAuthToken();
  if (requireAuth && !token) {
    throw new Error('Please sign in to do that.');
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...options,
    });
  } catch {
    throw new Error(
      `Could not reach the QA backend at ${API_BASE_URL}. Make sure it's running (npm start in qa-engineer-backend).`
    );
  }

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
      else if (body?.message) message = body.message;
    } catch {
      // ignore body parse errors, use default message
    }
    throw new Error(message);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  createTest: (payload: {
    url: string;
    name?: string;
    maxPages?: number;
    maxDepth?: number;
    modules?: string[];
    policyId?: string;
  }) => request<BackendTest>('/tests', { method: 'POST', body: JSON.stringify(payload) }, true),

  listTests: (params?: { status?: string; search?: string }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set('status', params.status);
    if (params?.search) qs.set('search', params.search);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return request<BackendTest[]>(`/tests${suffix}`);
  },

  getTest: (id: string) => request<BackendTest>(`/tests/${id}`),

  deleteTest: (id: string) => request<void>(`/tests/${id}`, { method: 'DELETE' }, true),

  rerunTest: (id: string) => request<BackendTest>(`/tests/${id}/rerun`, { method: 'POST' }, true),

  getIssues: (id: string, resolved?: boolean) =>
    request<BackendIssue[]>(
      `/tests/${id}/issues${resolved !== undefined ? `?resolved=${resolved}` : ''}`
    ),

  updateIssue: (testId: string, issueId: string, resolved: boolean) =>
    request<BackendIssue>(
      `/tests/${testId}/issues/${issueId}`,
      { method: 'PATCH', body: JSON.stringify({ resolved }) },
      true
    ),

  assignIssue: (testId: string, issueId: string, assigneeIds: string[]) =>
    request<BackendIssue>(
      `/tests/${testId}/issues/${issueId}`,
      { method: 'PATCH', body: JSON.stringify({ assigneeIds }) },
      true
    ),

  editIssue: (
    testId: string,
    issueId: string,
    fields: { title?: string; description?: string; severity?: string; category?: string }
  ) =>
    request<BackendIssue>(
      `/tests/${testId}/issues/${issueId}`,
      { method: 'PATCH', body: JSON.stringify(fields) },
      true
    ),

  deleteIssue: (testId: string, issueId: string) =>
    request<void>(`/tests/${testId}/issues/${issueId}`, { method: 'DELETE' }, true),

  addIssueComment: (testId: string, issueId: string, text: string) =>
    request<BackendIssue>(
      `/tests/${testId}/issues/${issueId}/comments`,
      { method: 'POST', body: JSON.stringify({ text }) },
      true
    ),

  locateIssue: (testId: string, issueId: string) =>
    request<{
      grounded: boolean;
      aiSuggested: boolean;
      filePath: string | null;
      fileFullPath: string | null;
      line: number | null;
      explanation: string | null;
      repo: string | null;
      matchedBy: string | null;
    }>(`/ai-automation/locate?testId=${encodeURIComponent(testId)}&issueId=${encodeURIComponent(issueId)}`),

  getStats: () => request<BackendStats>('/stats'),

  getPipeline: () => request<BackendPipeline>('/pipeline'),

  screenshotUrl: (path: string) => `${API_ORIGIN}${path}`,

  policies: {
    list: () => request<BackendPolicy[]>('/policies', undefined, true),
    create: (payload: { name: string; scoreRanges?: Partial<PolicyScoreRanges> }) =>
      request<BackendPolicy>('/policies', { method: 'POST', body: JSON.stringify(payload) }, true),
    update: (id: string, payload: { name?: string; scoreRanges?: Partial<PolicyScoreRanges> }) =>
      request<BackendPolicy>(`/policies/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }, true),
    remove: (id: string) => request<void>(`/policies/${id}`, { method: 'DELETE' }, true),
    setActive: (id: string) => request<BackendPolicy>(`/policies/${id}/activate`, { method: 'POST' }, true),
  },

  branding: {
    get: () => request<BackendBranding>('/branding'),
    update: (payload: {
      primaryColor?: string;
      footerText?: string;
      headerText?: string;
      headerFontSize?: number;
      footerFontSize?: number;
      logoWidth?: number;
      logoHeight?: number;
      logoBase64?: string;
    }) => request<BackendBranding>('/branding', { method: 'PUT', body: JSON.stringify(payload) }, true),
  },

  team: {
    listMembers: () => request<BackendTeamMember[]>('/team/members', undefined, true),
    invite: (email: string, role?: TeamRole) =>
      request<BackendTeamMember & { emailSent: boolean; devInviteLink?: string }>(
        '/team/invite',
        { method: 'POST', body: JSON.stringify({ email, role }) },
        true
      ),
    updateRole: (id: string, role: TeamRole) =>
      request<BackendTeamMember>(`/team/members/${id}`, { method: 'PATCH', body: JSON.stringify({ role }) }, true),
    remove: (id: string) => request<void>(`/team/members/${id}`, { method: 'DELETE' }, true),
  },

  monitors: {
    list: () => request<BackendMonitor[]>('/monitors', undefined, true),
    create: (payload: { url: string; name?: string; frequency: MonitorFrequency; modules?: string[]; alertOnCritical?: boolean }) =>
      request<BackendMonitor>('/monitors', { method: 'POST', body: JSON.stringify(payload) }, true),
    update: (id: string, payload: { frequency?: MonitorFrequency; enabled?: boolean; alertOnCritical?: boolean; modules?: string[]; name?: string }) =>
      request<BackendMonitor>(`/monitors/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }, true),
    remove: (id: string) => request<void>(`/monitors/${id}`, { method: 'DELETE' }, true),
    runNow: (id: string) => request<{ message: string; monitor: BackendMonitor }>(`/monitors/${id}/run-now`, { method: 'POST' }, true),
    history: (id: string) => request<BackendTest[]>(`/monitors/${id}/history`, undefined, true),
  },

  analytics: {
    get: (days = 30) => request<BackendAnalytics>(`/analytics?days=${days}`, undefined, true),
  },

  deviceLab: {
    listDevices: () => request<{ devices: DeviceLabDevice[] }>('/device-lab/devices'),
    render: (payload: { url: string; deviceId: string; orientation?: 'portrait' | 'landscape'; browserEngine?: 'chromium' | 'firefox' | 'webkit' }) =>
      request<DeviceLabRenderResult>('/device-lab/render', { method: 'POST', body: JSON.stringify(payload) }),
  },
};

export interface DeviceLabDevice {
  id: string;
  deviceKey: string;
  name: string;
  category: string;
  os: string;
  width: number;
  height: number;
  deviceScaleFactor: number;
  isMobile: boolean;
  hasTouch: boolean;
  defaultBrowserType: 'chromium' | 'firefox' | 'webkit';
  userAgent: string;
}

export interface DeviceLabRenderResult {
  screenshotUrl: string;
  device: DeviceLabDevice;
  orientation: 'portrait' | 'landscape';
  browserEngine: string;
  statusCode: number | null;
  loadTimeMs: number;
}