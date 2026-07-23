'use client';

import React, { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { User, Key, Envelope, LockOpen } from '@phosphor-icons/react';
import { useAuth } from '../../context/AuthContext';

const AcceptInviteForm: React.FC = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { acceptInvite } = useAuth();
  const token = searchParams.get('token');

  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState('');
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setLoading(true);
    setApiError('');
    try {
      await acceptInvite(token, name, password, true);
      setDone(true);
      router.push('/');
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Could not accept invite');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 px-4">
      <div className="w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-lg p-6 space-y-5">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center shrink-0">
            <LockOpen className="w-5 h-5 text-white" weight="fill" />
          </div>
          <div>
            <h1 className="font-bold text-base text-slate-900 dark:text-white">Accept Invite</h1>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">Join your team&apos;s AI QA Engineer workspace</p>
          </div>
        </div>

        {!token ? (
          <p className="text-sm text-red-500 dark:text-red-400">
            This invite link is missing its token. Ask whoever invited you to send it again.
          </p>
        ) : done ? (
          <p className="text-sm text-emerald-600 dark:text-emerald-400">You&apos;re in! Redirecting…</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Your Name</label>
              <div className="relative flex items-center">
                <User className="absolute left-3 text-slate-400 w-4 h-4" />
                <input
                  type="text"
                  required
                  placeholder="Jane Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border rounded-xl text-xs focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 font-semibold bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-white"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Set a Password</label>
              <div className="relative flex items-center">
                <Key className="absolute left-3 text-slate-400 w-4 h-4" />
                <input
                  type="password"
                  required
                  placeholder="Min 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border rounded-xl text-xs focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 font-semibold bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-white"
                />
              </div>
            </div>

            {apiError && (
              <p className="text-xs text-red-500 dark:text-red-400 flex items-center gap-1.5">
                <Envelope className="w-3.5 h-3.5" /> {apiError}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-bold py-2.5 rounded-xl text-xs shadow-sm cursor-pointer"
            >
              {loading ? 'Joining...' : 'Join Workspace'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={null}>
      <AcceptInviteForm />
    </Suspense>
  );
}
