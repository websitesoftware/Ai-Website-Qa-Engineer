'use client';

import React, { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { User, Key, Envelope, LockOpen } from '@phosphor-icons/react';
import { useAuth } from '../../context/AuthContext';
import { useContent } from '../../context/ContentContext';

const AcceptInviteForm: React.FC = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { acceptInvite } = useAuth();
  const token = searchParams.get('token');

  const heading = useContent('acceptInvite.heading', { text: 'Accept Invite' });
  const subheading = useContent('acceptInvite.subheading', { text: "Join your team's AI QA Engineer workspace" });
  const missingTokenText = useContent('acceptInvite.missingToken', { text: 'This invite link is missing its token. Ask whoever invited you to send it again.' });
  const successText = useContent('acceptInvite.success', { text: "You're in! Redirecting…" });
  const nameLabel = useContent('acceptInvite.nameLabel', { text: 'Your Name' });
  const namePlaceholder = useContent('acceptInvite.namePlaceholder', { text: 'Jane Doe' });
  const passwordLabel = useContent('acceptInvite.passwordLabel', { text: 'Set a Password' });
  const passwordPlaceholder = useContent('acceptInvite.passwordPlaceholder', { text: 'Min 8 characters' });
  const submitLoading = useContent('acceptInvite.submit.loading', { text: 'Joining...' });
  const submitIdle = useContent('acceptInvite.submit.idle', { text: 'Join Workspace' });
  const errorFallback = useContent('acceptInvite.error.fallback', { text: 'Could not accept invite' });

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
      setApiError(err instanceof Error ? err.message : errorFallback.text);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 px-4">
      <div className="w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-lg p-6 space-y-5">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
            <LockOpen className="w-5 h-5 text-white" weight="fill" />
          </div>
          <div>
            <h1 className="font-bold text-base text-slate-900 dark:text-white">{heading.text}</h1>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">{subheading.text}</p>
          </div>
        </div>

        {!token ? (
          <p className="text-sm text-red-500 dark:text-red-400">
            {missingTokenText.text}
          </p>
        ) : done ? (
          <p className="text-sm text-emerald-600 dark:text-emerald-400">{successText.text}</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">{nameLabel.text}</label>
              <div className="relative flex items-center">
                <User className="absolute left-3 text-slate-400 w-4 h-4" />
                <input
                  type="text"
                  required
                  placeholder={namePlaceholder.text}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border rounded-xl text-xs focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 font-semibold bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-white"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">{passwordLabel.text}</label>
              <div className="relative flex items-center">
                <Key className="absolute left-3 text-slate-400 w-4 h-4" />
                <input
                  type="password"
                  required
                  placeholder={passwordPlaceholder.text}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border rounded-xl text-xs focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 font-semibold bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-white"
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
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold py-2.5 rounded-xl text-xs shadow-sm cursor-pointer"
            >
              {loading ? submitLoading.text : submitIdle.text}
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
