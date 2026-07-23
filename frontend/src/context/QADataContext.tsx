
'use client';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from '../lib/api';
import { BackendTest, BackendStats, BackendPipeline } from '../lib/types';
import { usePolling } from '../hooks/usePolling';

interface QADataContextValue {
  tests: BackendTest[];
  stats: BackendStats | null;
  pipeline: BackendPipeline | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  createTest: (
    url: string,
    options?: { name?: string; maxPages?: number; maxDepth?: number; modules?: string[]; policyId?: string }
  ) => Promise<BackendTest>;
  rerunTest: (id: string) => Promise<void>;
  deleteTest: (id: string) => Promise<void>;
  updateIssue: (testId: string, issueId: string, resolved: boolean) => Promise<void>;
}

const QADataContext = createContext<QADataContextValue | undefined>(undefined);

export const QADataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [tests, setTests] = useState<BackendTest[]>([]);
  const [stats, setStats] = useState<BackendStats | null>(null);
  const [pipeline, setPipeline] = useState<BackendPipeline | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      const [testsRes, statsRes, pipelineRes] = await Promise.all([
        api.listTests(),
        api.getStats(),
        api.getPipeline(),
      ]);
      setTests(testsRes);
      setStats(statsRes);
      setPipeline(pipelineRes);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reach the QA backend.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard fetch-on-mount
    fetchAll();
  }, [fetchAll]);

  const hasActiveScans = tests.some((t) => t.status === 'queued' || t.status === 'running');
  usePolling(fetchAll, hasActiveScans ? 3000 : 12000, true);

  const createTest = useCallback(
    async (
      url: string,
      options?: { name?: string; maxPages?: number; maxDepth?: number; modules?: string[]; policyId?: string }
    ) => {
      const test = await api.createTest({ url, ...options });
      await fetchAll();
      return test;
    },
    [fetchAll]
  );

  const rerunTest = useCallback(
    async (id: string) => {
      await api.rerunTest(id);
      await fetchAll();
    },
    [fetchAll]
  );

  const deleteTest = useCallback(
    async (id: string) => {
      await api.deleteTest(id);
      await fetchAll();
    },
    [fetchAll]
  );

  const updateIssue = useCallback(
    async (testId: string, issueId: string, resolved: boolean) => {
      await api.updateIssue(testId, issueId, resolved);
      await fetchAll();
    },
    [fetchAll]
  );

  return (
    <QADataContext.Provider
      value={{ tests, stats, pipeline, loading, error, refetch: fetchAll, createTest, rerunTest, deleteTest, updateIssue }}
    >
      {children}
    </QADataContext.Provider>
  );
};

export function useQAData() {
  const ctx = useContext(QADataContext);
  if (!ctx) throw new Error('useQAData must be used within QADataProvider');
  return ctx;
}