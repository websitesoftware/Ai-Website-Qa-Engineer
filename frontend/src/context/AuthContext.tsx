'use client';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { API_ORIGIN } from '../lib/api';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
}

const STORAGE_KEY = 'qa_auth';
const AUTH_BASE = `${API_ORIGIN}/api/auth`;

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  ready: boolean;
  login: (email: string, password: string, remember: boolean) => Promise<void>;
  register: (email: string, password: string, remember: boolean) => Promise<void>;
  forgotPassword: (email: string) => Promise<string>;
  acceptInvite: (inviteToken: string, name: string, password: string, remember: boolean) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function readSession(): { token: string; user: AuthUser } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function persistSession(token: string, user: AuthUser, remember: boolean) {
  try {
    const payload = JSON.stringify({ token, user });
    const store = remember ? localStorage : sessionStorage;
    store.setItem(STORAGE_KEY, payload);
    (remember ? sessionStorage : localStorage).removeItem(STORAGE_KEY);
  } catch {
    /* storage unavailable — ignore */
  }
}

function clearSession() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const saved = readSession();
    if (!saved?.token) {
      // No session to validate — nothing async follows, so this is a plain
      // derived-state update rather than a real effect subscription.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setReady(true);
      return;
    }
    // Optimistically restore the cached session immediately so the token is
    // usable right away — the /me call below only refreshes the user's
    // profile and revokes the session on an explicit 401 (a genuinely
    // invalid/expired token). Any other failure (network hiccup, backend
    // restarting) must NOT log the user out from under them.
    setUser(saved.user);
    setToken(saved.token);

    fetch(`${AUTH_BASE}/me`, { headers: { Authorization: `Bearer ${saved.token}` } })
      .then((r) => {
        if (r.ok) return r.json().then((data) => setUser(data.user));
        if (r.status === 401) {
          clearSession();
          setUser(null);
          setToken(null);
        }
        // Other statuses (e.g. 5xx): keep the optimistically restored session.
      })
      .catch(() => {
        // Network error — keep the optimistically restored session.
      })
      .finally(() => setReady(true));
  }, []);

  const login = useCallback(async (email: string, password: string, remember: boolean) => {
    const res = await fetch(`${AUTH_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Authentication failed');
    setUser(data.user);
    setToken(data.token);
    persistSession(data.token, data.user, remember);
  }, []);

  const register = useCallback(async (email: string, password: string, remember: boolean) => {
    const res = await fetch(`${AUTH_BASE}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Registration failed');
    setUser(data.user);
    setToken(data.token);
    persistSession(data.token, data.user, remember);
  }, []);

  const forgotPassword = useCallback(async (email: string) => {
    const res = await fetch(`${AUTH_BASE}/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Request failed');
    return data.message as string;
  }, []);

  const acceptInvite = useCallback(
    async (inviteToken: string, name: string, password: string, remember: boolean) => {
      const res = await fetch(`${AUTH_BASE}/accept-invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: inviteToken, name, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Could not accept invite');
      setUser(data.user);
      setToken(data.token);
      persistSession(data.token, data.user, remember);
    },
    []
  );

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    clearSession();
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, ready, login, register, forgotPassword, acceptInvite, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
