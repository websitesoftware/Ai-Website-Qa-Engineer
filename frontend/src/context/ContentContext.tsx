'use client';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, API_ORIGIN } from '../lib/api';
import { BackendContentBlock } from '../lib/types';

interface ContentContextValue {
  blocks: Record<string, BackendContentBlock>;
  loading: boolean;
  refetch: () => Promise<void>;
}

const ContentContext = createContext<ContentContextValue | undefined>(undefined);

export const ContentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [blocks, setBlocks] = useState<Record<string, BackendContentBlock>>({});
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    try {
      const { blocks: list } = await api.content.list();
      setBlocks(Object.fromEntries(list.map((b) => [b.key, b])));
    } catch {
      // No editable content saved yet, or the backend is unreachable — every
      // useContent() call below just falls back to its hardcoded default.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Fetch-on-mount, same shape as AuthContext's session restore.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refetch();
  }, [refetch]);

  return <ContentContext.Provider value={{ blocks, loading, refetch }}>{children}</ContentContext.Provider>;
};

function useContentContext() {
  const ctx = useContext(ContentContext);
  if (!ctx) throw new Error('useContent must be used within ContentProvider');
  return ctx;
}

/**
 * Reads one editable content block by key, falling back to the given
 * defaults if it hasn't been customized yet (or hasn't loaded yet). Screens
 * should call this for editorial copy/icons/images only — never for live
 * scan data, which stays fully code-driven.
 */
export function useContent(key: string, defaults: { text: string; icon?: string; imageUrl?: string | null }) {
  const { blocks } = useContentContext();
  const block = blocks[key];
  return {
    text: block?.text ?? defaults.text,
    icon: block?.icon ?? defaults.icon ?? '',
    imageUrl: block ? block.imageUrl : defaults.imageUrl ?? null,
    imageSrc: block?.imageUrl ? `${API_ORIGIN}${block.imageUrl}` : null,
  };
}

export function useContentAdmin() {
  return useContentContext();
}
