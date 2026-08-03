

'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useQAData } from '../context/QADataContext';
import { useAuth } from '../context/AuthContext';
import { ThemeToggle } from './ThemeToggle';
import { useTheme } from '../context/ThemeContext';
import { User, SignOut, Key, Envelope, LockOpen, ArrowLeft, CheckSquare, Square, Eye, EyeSlash, List, X } from '@phosphor-icons/react';
import { AnimatePresence, motion } from 'framer-motion';
import { useContent } from '../context/ContentContext';
import { AquaScene } from './ui/AquaScene';
import { NightScene } from './ui/NightScene';

export type TabType = 'Dashboard' | 'Tests' | 'Scan Results' | 'Automation' | 'Settings';
type AuthView = 'LOGIN' | 'FORGOT_PASSWORD' | 'REGISTER';

interface LayoutProps {
  children: React.ReactNode;
  currentUser?: string;
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  search?: string;
  onSearchChange?: (value: string) => void;
}

export const Layout: React.FC<LayoutProps> = ({
  children,
  activeTab,
  setActiveTab,
  search = '',
  onSearchChange,
}) => {
  const { error } = useQAData();
  const { resolvedTheme } = useTheme();
  const { user, login, register, forgotPassword, logout } = useAuth();
  const sidebarTitle = useContent('global.sidebar.title', { text: 'AI QA Engineer' });
  const sidebarSubtitle = useContent('global.sidebar.subtitle', { text: 'Website Assistant' });

  // UI Panels Engine States
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [authView, setAuthView] = useState<AuthView>('LOGIN');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // API Response States
  const [apiError, setApiError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const popupRef = useRef<HTMLDivElement>(null);

  // Auto-close on click outside layout boundary box
  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
        setIsLoginOpen(false);
        setTimeout(() => {
          setAuthView('LOGIN');
          setSuccessMessage('');
          setApiError('');
        }, 200);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // API Call: Login Handler
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setApiError('');
    setLoading(true);
    try {
      await login(email, password, rememberMe);
      setIsLoginOpen(false);
      setPassword('');
      setEmail('');
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  // API Call: Forgot Password Request Handler
  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setApiError('');
    setLoading(true);
    try {
      const message = await forgotPassword(email);
      setSuccessMessage(message);
      setTimeout(() => {
        setSuccessMessage('');
        setAuthView('LOGIN');
      }, 4000);
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Failed to process request');
    } finally {
      setLoading(false);
    }
  };

  // API Call: Register Account Handler
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setApiError('');
    setLoading(true);
    try {
      await register(email, password, rememberMe);
      setIsLoginOpen(false);
      setPassword('');
      setEmail('');
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Failed to register account');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    setIsLoginOpen(false);
    setAuthView('LOGIN');
  };

  const navItems = [
    { label: 'Dashboard' as TabType, icon: 'ph-squares-four' },
    { label: 'Tests' as TabType, icon: 'ph-check-circle' },
    { label: 'Scan Results' as TabType, icon: 'ph-sparkle' },
    { label: 'Automation' as TabType, icon: 'ph-robot' },
    { label: 'Settings' as TabType, icon: 'ph-gear' },
  ];

  return (
    <div className={`h-app-shell overflow-hidden flex relative transition-all duration-300 ${resolvedTheme === 'dark' ? 'bg-slate-950 text-white' : 'bg-app-sky text-slate-800'}`}>
      <AquaScene />
      <NightScene />

      {/* Mobile nav backdrop — tapping it (or a nav item) closes the drawer */}
      <AnimatePresence>
        {mobileNavOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setMobileNavOpen(false)}
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 md:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar Section — a fixed off-canvas drawer below md, a normal
          in-flow column at md+. The same drawer/toggle works no matter
          which tab is active, since every tab renders inside this shell. */}
      <aside
        className={`w-64 h-full flex flex-col shrink-0 transition-transform duration-300 fixed md:static inset-y-0 left-0 z-50 md:translate-x-0 ${
          mobileNavOpen ? 'translate-x-0' : '-translate-x-full'
        } ${resolvedTheme === 'dark' ? 'backdrop-blur-md' : 'bg-white/20 border-r border-white/30'}`}
        style={resolvedTheme === 'dark' ? { background: 'rgba(10, 13, 26, 0.4)' } : undefined}
      >
        <div className={`h-20 flex items-center justify-between px-6 ${resolvedTheme === 'dark' ? '' : 'border-b border-white/40'}`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-pink-500 shadow-md shadow-violet-500/30 flex items-center justify-center text-white font-bold text-xl">Q</div>
            <div>
              <h1 className={`font-bold ${resolvedTheme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{sidebarTitle.text}</h1>
              <p className={`text-xs ${resolvedTheme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>{sidebarSubtitle.text}</p>
            </div>
          </div>
          <button
            onClick={() => setMobileNavOpen(false)}
            aria-label="Close navigation menu"
            className={`md:hidden p-1.5 rounded-lg cursor-pointer ${resolvedTheme === 'dark' ? 'text-slate-400 hover:bg-slate-800' : 'text-slate-400 hover:bg-slate-100'}`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
          {navItems.map((item) => (
            <button
              key={item.label}
              onClick={() => {
                setActiveTab(item.label);
                setMobileNavOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all cursor-pointer ${
                activeTab === item.label
                  ? 'bg-gradient-to-r from-pink-100 to-violet-100 dark:from-violet-900/40 dark:to-pink-900/30 text-violet-700 dark:text-violet-300 font-bold'
                  : resolvedTheme === 'dark'
                    ? 'text-slate-300 hover:bg-slate-800'
                    : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <i className={`ph ${item.icon} text-xl`} />
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      {/* Main Container */}
      <main className="flex-1 flex flex-col h-full overflow-hidden min-w-0 relative z-10">

        {/* RUNTIME INTEGRATED GLOBAL HEADER */}
        <header className={`h-20 px-4 sm:px-8 flex items-center justify-between gap-3 shrink-0 transition-all duration-300 relative ${resolvedTheme === 'dark' ? 'bg-transparent' : 'bg-white/15'}`} ref={popupRef}>
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open navigation menu"
              className={`md:hidden p-2 rounded-full shadow-sm shrink-0 cursor-pointer ${resolvedTheme === 'dark' ? 'bg-slate-900 text-slate-300' : 'bg-white text-slate-600'}`}
            >
              <List className="w-5 h-5" />
            </button>
            <div className="min-w-0">
            <h2 className={`text-xl font-extrabold tracking-tight truncate ${resolvedTheme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
              {user ? (
                <span>Welcome back, {user.name} 👋</span>
              ) : (
                <span>Welcome, Guest! Please <span className="text-blue-600 dark:text-blue-400 underline cursor-pointer hover:text-blue-700" onClick={() => { setAuthView('LOGIN'); setIsLoginOpen(true); }}>Sign In</span></span>
              )}
            </h2>
            <p className={`text-xs mt-0.5 font-medium ${resolvedTheme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
              {user ? `Authorized Account Session • ${user.email}` : 'Manage operational engine tests and view system analysis diagnostic logs.'}
            </p>
            {error && (
              <p className="text-xs mt-1 font-semibold text-red-600 dark:text-red-400">{error}</p>
            )}
            </div>
          </div>

          {/* Action Utilities Controls */}
          <div className="flex items-center gap-3.5">
            {onSearchChange && (
              <div className="relative hidden lg:block">
                <i className="ph ph-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"></i>
                <input
                  type="text"
                  placeholder="Search data metrics..."
                  value={search}
                  onChange={(e) => onSearchChange(e.target.value)}
                  className={`pl-9 pr-4 py-2 rounded-full text-xs w-56 focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition-all shadow-sm ${
                    resolvedTheme === 'dark' ? 'bg-slate-900 border border-slate-800 text-white' : 'bg-white border border-transparent text-slate-800'
                  }`}
                />
              </div>
            )}



            <ThemeToggle />

            {/* Profile Context Active Dropdown Trigger — matches the Aqua Bloom
                reference's pill-shaped avatar chip. */}
            <button
              aria-label="Describe this button's action"
              onClick={() => setIsLoginOpen(!isLoginOpen)}
              className={`pl-1.5 pr-4 py-1.5 rounded-full transition-all shadow-sm flex items-center gap-2.5 cursor-pointer text-xs font-bold ${
                isLoginOpen ? 'bg-blue-600 text-white' : resolvedTheme === 'dark' ? 'bg-slate-900 text-slate-200' : 'bg-white text-slate-700'
              }`}
            >
              <span
                className={`w-8 h-8 rounded-full flex items-center justify-center text-white shrink-0 ${
                  isLoginOpen ? 'bg-white/20' : 'bg-gradient-to-br from-[#FFD36E] to-[#FF9FC6]'
                }`}
              >
                {user ? user.name.slice(0, 1).toUpperCase() : <User className="w-4 h-4" weight="bold" />}
              </span>
              <span className="hidden sm:inline">{user ? user.name : 'Account'}</span>
            </button>

            {/* DYNAMIC BACKEND SECURED AUTH POPUP PANEL */}
            <AnimatePresence>
              {isLoginOpen && (
                <motion.div initial={{ opacity: 0, y: 12, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: 0.96 }} transition={{ duration: 0.15, ease: 'easeOut' }} className={`absolute right-4 sm:right-8 top-16 w-[calc(100vw-2rem)] max-w-85 rounded-2xl border shadow-2xl z-50 p-5 ${resolvedTheme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>

                  {/* Error Notification Block */}
                  {apiError && (
                    <div className="mb-3 p-2.5 bg-red-50 dark:bg-red-950/40 border border-red-100 dark:border-red-900/50 rounded-xl text-[11px] font-bold text-red-600 dark:text-red-400 text-center">
                      {apiError}
                    </div>
                  )}

                  {/* USER LOGGED IN SCREEN */}
                  {user ? (
                    <div className="space-y-4 text-center py-2">
                      <div className="w-11 h-11 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-1">
                        <LockOpen className="w-5 h-5" weight="fill" />
                      </div>
                      <div>
                        <h3 className={`font-bold text-sm ${resolvedTheme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Session Authenticated</h3>
                        <p className="text-xs text-slate-400 dark:text-slate-500 font-medium truncate mt-0.5">{user.email}</p>
                      </div>
                      <button onClick={handleLogout} className="w-full bg-red-50 dark:bg-red-950/30 hover:bg-red-100 text-red-600 font-bold py-2.5 rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5 border border-red-100 dark:border-red-900/20 cursor-pointer">
                        <SignOut className="w-3.5 h-3.5" /> Sign Out Account
                      </button>
                    </div>
                  ) : (
                    /* ANONYMOUS SYSTEM SCREENS SWITCHER */
                    <div>
                      {/* VIEW 1: SIGN IN MODULE */}
                      {authView === 'LOGIN' && (
                        <form onSubmit={handleLoginSubmit} className="space-y-4">
                          <div>
                            <h3 className={`font-bold text-base ${resolvedTheme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Sign In</h3>
                            <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">Access protection parameters data logs</p>
                          </div>

                          <div className="space-y-3.5">
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Email Address</label>
                              <div className="relative flex items-center">
                                <Envelope className="absolute left-3 text-slate-400 w-4 h-4" />
                                <input type="email" required placeholder="name@company.com" value={email} onChange={(e) => setEmail(e.target.value)} className={`w-full pl-9 pr-3 py-2 border rounded-xl text-xs focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 font-semibold ${resolvedTheme === 'dark' ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'}`} />
                              </div>
                            </div>

                            <div className="space-y-1">
                              <div className="flex justify-between items-center">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Password</label>
                                <button type="button" onClick={() => { setAuthView('FORGOT_PASSWORD'); setApiError(''); }} className="text-[11px] font-bold text-blue-500 hover:underline bg-transparent border-none cursor-pointer">Forgot?</button>
                              </div>
                              <div className="relative flex items-center">
                                <Key className="absolute left-3 text-slate-400 w-4 h-4" />
                                <input type={showPassword ? 'text' : 'password'} required placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} className={`w-full pl-9 pr-9 py-2 border rounded-xl text-xs focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 font-semibold ${resolvedTheme === 'dark' ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'}`} />
                                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 text-slate-400 hover:text-slate-500 bg-transparent border-none cursor-pointer">
                                  {showPassword ? <EyeSlash className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 cursor-pointer select-none" onClick={() => setRememberMe(!rememberMe)}>
                              {rememberMe ? <CheckSquare className="w-4 h-4 text-blue-500" weight="fill" /> : <Square className="w-4 h-4 text-slate-300" />}
                              <span className="text-xs text-slate-400 font-semibold">Remember this machine</span>
                            </div>
                          </div>

                          <button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold py-2.5 rounded-xl text-xs shadow-sm flex items-center justify-center gap-1.5 cursor-pointer mt-1">
                            {loading ? 'Authenticating...' : 'Sign In Account'}
                          </button>

                          <div className="text-center pt-2 border-t border-slate-100 dark:border-slate-800/60">
                            <span className="text-xs text-slate-400 font-medium">Don&apos;t have an account? <button type="button" onClick={() => { setAuthView('REGISTER'); setApiError(''); }} className="text-blue-500 font-bold hover:underline bg-transparent border-none cursor-pointer">Sign Up</button></span>
                          </div>
                        </form>
                      )}

                      {/* VIEW 2: FORGOT PASSWORD MODULE */}
                      {authView === 'FORGOT_PASSWORD' && (
                        <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
                          <button type="button" onClick={() => { setAuthView('LOGIN'); setSuccessMessage(''); setApiError(''); }} className="text-xs font-bold text-slate-400 hover:text-slate-600 flex items-center gap-1 bg-transparent border-none cursor-pointer">
                            <ArrowLeft /> Back to Login
                          </button>

                          <div>
                            <h3 className={`font-bold text-base ${resolvedTheme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Recover Password</h3>
                            <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">We will dispatch a runtime link token payload validation.</p>
                          </div>

                          {successMessage ? (
                            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900 rounded-xl text-[11px] font-bold text-emerald-600 dark:text-emerald-400 leading-relaxed text-center">
                              {successMessage}
                            </div>
                          ) : (
                            <div className="space-y-3">
                              <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Registered Email</label>
                                <div className="relative flex items-center">
                                  <Envelope className="absolute left-3 text-slate-400 w-4 h-4" />
                                  <input type="email" required placeholder="name@company.com" value={email} onChange={(e) => setEmail(e.target.value)} className={`w-full pl-9 pr-3 py-2 border rounded-xl text-xs focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 font-semibold ${resolvedTheme === 'dark' ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'}`} />
                                </div>
                              </div>
                              <button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold py-2.5 rounded-xl text-xs shadow-sm cursor-pointer">
                                {loading ? 'Processing...' : 'Send Recovery Link'}
                              </button>
                            </div>
                          )}
                        </form>
                      )}

                      {/* VIEW 3: SIGN UP REGISTER MODULE */}
                      {authView === 'REGISTER' && (
                        <form onSubmit={handleRegisterSubmit} className="space-y-4">
                          <button type="button" onClick={() => { setAuthView('LOGIN'); setApiError(''); }} className="text-xs font-bold text-slate-400 hover:text-slate-600 flex items-center gap-1 bg-transparent border-none cursor-pointer">
                            <ArrowLeft /> Back to Login
                          </button>

                          <div>
                            <h3 className={`font-bold text-base ${resolvedTheme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Create Account</h3>
                            <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">Setup your operational continuous test suite dashboard profile.</p>
                          </div>

                          <div className="space-y-3">
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Email Address</label>
                              <div className="relative flex items-center">
                                <Envelope className="absolute left-3 text-slate-400 w-4 h-4" />
                                <input type="email" required placeholder="name@company.com" value={email} onChange={(e) => setEmail(e.target.value)} className={`w-full pl-9 pr-3 py-2 border rounded-xl text-xs focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 font-semibold ${resolvedTheme === 'dark' ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'}`} />
                              </div>
                            </div>

                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Password</label>
                              <div className="relative flex items-center">
                                <Key className="absolute left-3 text-slate-400 w-4 h-4" />
                                <input type="password" required placeholder="Create custom password (min 8 chars)" value={password} onChange={(e) => setPassword(e.target.value)} className={`w-full pl-9 pr-3 py-2 border rounded-xl text-xs focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 font-semibold ${resolvedTheme === 'dark' ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'}`} />
                              </div>
                            </div>
                          </div>

                          <button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold py-2.5 rounded-xl text-xs shadow-sm cursor-pointer mt-1">
                            {loading ? 'Initializing...' : 'Register & Initialize'}
                          </button>
                        </form>
                      )}
                    </div>
                  )}

                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </header>

        {/* Dashboard Dynamic Children Viewports Injection */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 sm:px-8 py-6 space-y-6 transition-all duration-300 bg-transparent">
          {children}
        </div>
      </main>
    </div>
  );
};
