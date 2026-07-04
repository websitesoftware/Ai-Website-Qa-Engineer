'use client';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import { BackendTest } from '../lib/types';
import { usePolling } from './usePolling';

export function useTestDetail(testId: string | null) {
  const [test, setTest] = useState<BackendTest | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTest = useCallback(async () => {
    if (!testId) return;
    try {
      const data = await api.getTest(testId);
      setTest(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load report');
    } finally {
      setLoading(false);
    }
  }, [testId]);

  useEffect(() => {
    if (!testId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional reset when the modal closes (testId becomes null)
      setTest(null);
      setError(null);
      return;
    }
    setLoading(true);
    fetchTest();
  }, [testId, fetchTest]);

  const isActive = test?.status === 'queued' || test?.status === 'running';
  usePolling(fetchTest, 2500, !!testId && isActive);

  return { test, loading, error, refetch: fetchTest };
}
