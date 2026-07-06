// import { BackendTest, BackendStats, BackendPipeline, BackendIssue } from './types';

// export const API_BASE_URL =
//   process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000/api';

// // backend also serves static screenshots from its origin (not under /api)
// export const API_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, '');

// async function request<T>(path: string, options?: RequestInit): Promise<T> {
//   let res: Response;
//   try {
//     res = await fetch(`${API_BASE_URL}${path}`, {
//       headers: { 'Content-Type': 'application/json' },
//       ...options,
//     });
//   } catch {
//     throw new Error(
//       `Could not reach the QA backend at ${API_BASE_URL}. Make sure it's running (npm start in qa-engineer-backend).`
//     );
//   }

//   if (!res.ok) {
//     let message = `Request failed (${res.status})`;
//     try {
//       const body = await res.json();
//       if (body?.error) message = body.error;
//     } catch {
//       // ignore body parse errors, use default message
//     }
//     throw new Error(message);
//   }

//   if (res.status === 204) return undefined as T;
//   return res.json();
// }

// export const api = {
//   createTest: (payload: { url: string; name?: string; maxPages?: number; maxDepth?: number }) =>
//     request<BackendTest>('/tests', { method: 'POST', body: JSON.stringify(payload) }),

//   listTests: (params?: { status?: string; search?: string }) => {
//     const qs = new URLSearchParams();
//     if (params?.status) qs.set('status', params.status);
//     if (params?.search) qs.set('search', params.search);
//     const suffix = qs.toString() ? `?${qs.toString()}` : '';
//     return request<BackendTest[]>(`/tests${suffix}`);
//   },

//   getTest: (id: string) => request<BackendTest>(`/tests/${id}`),

//   deleteTest: (id: string) => request<void>(`/tests/${id}`, { method: 'DELETE' }),

//   rerunTest: (id: string) => request<BackendTest>(`/tests/${id}/rerun`, { method: 'POST' }),

//   getIssues: (id: string, resolved?: boolean) =>
//     request<BackendIssue[]>(
//       `/tests/${id}/issues${resolved !== undefined ? `?resolved=${resolved}` : ''}`
//     ),

//   updateIssue: (testId: string, issueId: string, resolved: boolean) =>
//     request<BackendIssue>(`/tests/${testId}/issues/${issueId}`, {
//       method: 'PATCH',
//       body: JSON.stringify({ resolved }),
//     }),

//   getStats: () => request<BackendStats>('/stats'),

//   getPipeline: () => request<BackendPipeline>('/pipeline'),

//   screenshotUrl: (path: string) => `${API_ORIGIN}${path}`,
// };
import { BackendTest, BackendStats, BackendPipeline, BackendIssue } from './types';

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000/api';

export const API_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, '');

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      headers: { 'Content-Type': 'application/json' },
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
  }) => request<BackendTest>('/tests', { method: 'POST', body: JSON.stringify(payload) }),

  listTests: (params?: { status?: string; search?: string }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set('status', params.status);
    if (params?.search) qs.set('search', params.search);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return request<BackendTest[]>(`/tests${suffix}`);
  },

  getTest: (id: string) => request<BackendTest>(`/tests/${id}`),

  deleteTest: (id: string) => request<void>(`/tests/${id}`, { method: 'DELETE' }),

  rerunTest: (id: string) => request<BackendTest>(`/tests/${id}/rerun`, { method: 'POST' }),

  getIssues: (id: string, resolved?: boolean) =>
    request<BackendIssue[]>(
      `/tests/${id}/issues${resolved !== undefined ? `?resolved=${resolved}` : ''}`
    ),

  updateIssue: (testId: string, issueId: string, resolved: boolean) =>
    request<BackendIssue>(`/tests/${testId}/issues/${issueId}`, {
      method: 'PATCH',
      body: JSON.stringify({ resolved }),
    }),

  getStats: () => request<BackendStats>('/stats'),

  getPipeline: () => request<BackendPipeline>('/pipeline'),

  screenshotUrl: (path: string) => `${API_ORIGIN}${path}`,
};