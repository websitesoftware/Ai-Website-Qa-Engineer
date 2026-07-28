'use client';
import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';

/**
 * True if the signed-in user is the workspace owner or has the "admin" team
 * role — same rule the Settings > Team tab uses to gate role management, and
 * used here to gate visibility of the Content Manager tab.
 */
export function useIsAdmin(): boolean {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!user) {
      // Reset on logout — mirrors AuthContext's own session-reset pattern.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsAdmin(false);
      return;
    }
    let cancelled = false;
    api.team
      .listMembers()
      .then((members) => {
        if (cancelled) return;
        const self = members.find((m) => m.id === user.id);
        setIsAdmin(self?.role === 'owner' || self?.role === 'admin');
      })
      .catch(() => {
        if (!cancelled) setIsAdmin(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  return isAdmin;
}
