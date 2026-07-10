'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

// --- Types ---
interface StatCardProps {
  label: string;
  value: string | number;
  subtext: string;
  subType?: 'up' | 'down' | 'neutral';
  accentColor: string;
}

interface GaugeProps {
  label: string;
  value: number;
  color: string;
}

interface IssueItem {
  id: string;
  title: string;
  fix: string;
  category: string;
  severity: 'high' | 'med' | 'low';
}

export default function ScanlinePhase1Report() {
  // Live states mimicking real-time run execution
  const [pagesCrawled, setPagesCrawled] = useState(24);
  const [issuesFound, setIssuesFound] = useState(4);
  const [isScanning, setIsScanning] = useState(true);

  // Real-time updates simulation
  useEffect(() => {
    const interval = setInterval(() => {
      setPagesCrawled((prev) => {
        if (prev >= 142) {
          setIsScanning(false);
          clearInterval(interval);
          return 142;
        }
        return prev + Math.floor(Math.random() * 15) + 5;
      });

      setIssuesFound((prev) => (prev >= 37 ? 37 : prev + Math.floor(Math.random() * 3)));
    }, 800);

    return () => clearInterval(interval);
  }, []);

  const handleDownloadPDF = () => {
    alert('Generating and initiating download for Scanline_Report_0891.pdf...');
    // Add logic here to integrate libraries like html2pdf or jsPDF if required
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans selection:bg-indigo-500 selection:text-white antialiased">

      {/* ===== TOPBAR ===== */}
      <header className="border-b border-slate-200 bg-white sticky top-0 z-40 shadow-sm backdrop-blur-md bg-white/90">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-indigo-500 via-purple-500 to-indigo-600 shadow-md shadow-indigo-200 flex items-center justify-center">
              <div className="w-3 h-3 bg-white rounded-sm rotate-45" />
            </div>
            <div>
              <div className="font-bold text-slate-900 text-base tracking-tight">Scanline</div>
              <div className="text-[11px] font-mono text-slate-500 uppercase tracking-wider">AI QA Engineer — Phase 1</div>
            </div>
          </div>

          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full font-mono text-xs border transition-colors ${isScanning
              ? 'bg-amber-50 border-amber-200 text-amber-700'
              : 'bg-emerald-50 border-emerald-200 text-emerald-700'
            }`}>
            <span className={`w-2 h-2 rounded-full ${isScanning ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500 shadow-sm'}`} />
            {isScanning ? 'SCANNING SYSTEM...' : 'SCAN COMPLETE'}
          </div>
        </div>
      </header>

      {/* ===== MAIN CONTENT WRAPPER ===== */}
      <main className="max-w-6xl mx-auto px-6 py-8">

        {/* ===== RUN RUN METADATA ===== */}
        <div className="flex flex-wrap gap-x-6 gap-y-2 items-baseline mb-6 font-mono text-sm border-b border-slate-200 pb-4">
          <div className="text-indigo-600 font-semibold">scan → yourdomain.com</div>
          <div className="text-slate-500 text-xs"><b>{pagesCrawled}</b> pages crawled</div>
          <div className="text-slate-500 text-xs"><b>4m 12s</b> duration</div>
          <div className="text-slate-500 text-xs ml-auto">run <b>#0891</b> · Jul 09, 2026, 14:22</div>
        </div>

        {/* ===== STAT CARDS GRID ===== */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard
            label="Pages Crawled"
            value={pagesCrawled}
            subtext={isScanning ? "Crawling map tree..." : "6 unreachable"}
            accentColor="bg-indigo-500"
          />
          <StatCard
            label="Issues Found"
            value={issuesFound}
            subtext="↑ 9 vs last scan"
            subType="down"
            accentColor="bg-rose-500"
          />
          <StatCard
            label="Broken Links"
            value={isScanning ? Math.floor(issuesFound * 0.3) : 11}
            subtext="3 are 500s"
            accentColor="bg-amber-500"
          />
          <StatCard
            label="Avg Lighthouse"
            value={isScanning ? '--' : 78}
            subtext="↑ 4 vs last scan"
            subType="up"
            accentColor="bg-emerald-500"
          />
        </div>

        {/* ===== 2-COLUMN DETAILS PANELS ===== */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">

          {/* Lighthouse Scores */}
          <section className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold tracking-tight text-slate-900 uppercase"><span className="text-indigo-500 font-mono mr-1">01</span> Lighthouse Scores</h2>
              <span className="text-[11px] font-mono text-slate-400">avg across {pagesCrawled} pages</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
              <Gauge label="Performance" value={71} color="text-amber-500" />
              <Gauge label="Accessibility" value={88} color="text-emerald-500" />
              <Gauge label="Best Practices" value={82} color="text-emerald-500" />
              <Gauge label="SEO" value={74} color="text-amber-500" />
            </div>
          </section>

          {/* Responsive Viewport State */}
          <section className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-bold tracking-tight text-slate-900 uppercase"><span className="text-indigo-500 font-mono mr-1">02</span> Viewport Testing</h2>
                <span className="text-[11px] font-mono text-slate-400">/pricing</span>
              </div>
              <div className="space-y-2.5">
                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100 text-xs">
                  <div><span className="font-semibold text-slate-700">Desktop</span> <span className="font-mono text-[10px] text-slate-400">(1440×900)</span></div>
                  <span className="px-2 py-0.5 font-mono text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded">PASS</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100 text-xs">
                  <div><span className="font-semibold text-slate-700">Tablet</span> <span className="font-mono text-[10px] text-slate-400">(768×1024)</span></div>
                  <span className="px-2 py-0.5 font-mono text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 rounded">MINOR</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100 text-xs">
                  <div><span className="font-semibold text-slate-700">Mobile</span> <span className="font-mono text-[10px] text-slate-400">(375×812)</span></div>
                  <span className="px-2 py-0.5 font-mono text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 rounded">OVERFLOW</span>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* ===== BROKEN LINKS TABLE ===== */}
        <section className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm mb-8 overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold tracking-tight text-slate-900 uppercase"><span className="text-indigo-500 font-mono mr-1">03</span> Broken Links Detected</h2>
            <span className="text-[11px] font-mono text-rose-500 font-semibold bg-rose-50 border border-rose-100 px-2 py-0.5 rounded">11 total exceptions</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="text-slate-400 uppercase tracking-wider font-mono text-[10px] bg-slate-50 border-b border-slate-100">
                  <th className="py-2.5 px-3">Target URL</th>
                  <th className="py-2.5 px-3">Status Code</th>
                  <th className="py-2.5 px-3">Referrer Origin</th>
                  <th className="py-2.5 px-3 text-right">Exception Type</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                <tr>
                  <td className="py-3 px-3 text-slate-700 font-medium">/checkout/confirm</td>
                  <td className="py-3 px-3 text-rose-600 font-bold">500</td>
                  <td className="py-3 px-3 text-slate-500">/checkout</td>
                  <td className="py-3 px-3 text-right"><span className="bg-rose-50 border border-rose-200 text-rose-700 px-2 py-0.5 rounded text-[10px] font-bold">Server Error</span></td>
                </tr>
                <tr>
                  <td className="py-3 px-3 text-slate-700 font-medium">/assets/img/hero-old.png</td>
                  <td className="py-3 px-3 text-rose-500 font-bold">404</td>
                  <td className="py-3 px-3 text-slate-500">/</td>
                  <td className="py-3 px-3 text-right"><span className="bg-rose-50 border border-rose-200 text-rose-700 px-2 py-0.5 rounded text-[10px] font-bold">Not Found</span></td>
                </tr>
                <tr>
                  <td className="py-3 px-3 text-slate-700 font-medium">/blog/2023/black-friday</td>
                  <td className="py-3 px-3 text-amber-600 font-bold">301</td>
                  <td className="py-3 px-3 text-slate-500">/blog</td>
                  <td className="py-3 px-3 text-right"><span className="bg-amber-50 border border-amber-200 text-amber-700 px-2 py-0.5 rounded text-[10px] font-bold">Redirect Loop</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* ===== LIVE STREAM CONSOLE LOG EXCEPTION CAPTURES ===== */}
        <section className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold tracking-tight text-slate-900 uppercase"><span className="text-indigo-500 font-mono mr-1">04</span> Live Console Stream Exceptions</h2>
            <span className="text-[11px] font-mono text-slate-400">Captured in pipeline</span>
          </div>
          <div className="divide-y divide-slate-100 font-mono text-xs">
            <div className="py-2.5 flex items-start gap-4">
              <span className="text-rose-500 font-bold bg-rose-50 border border-rose-100 w-5 h-5 flex items-center justify-center rounded-md text-[10px]">✕</span>
              <span className="text-slate-400 text-[11px]">14:22:03</span>
              <span className="text-slate-800 flex-1">Uncaught TypeError: cannot read properties of undefined (reading 'map')</span>
              <span className="text-slate-400 text-right text-[11px]">cart.bundle.js:88</span>
            </div>
            <div className="py-2.5 flex items-start gap-4">
              <span className="text-amber-600 font-bold bg-amber-50 border border-amber-100 w-5 h-5 flex items-center justify-center rounded-md text-[10px]">!</span>
              <span className="text-slate-400 text-[11px]">14:22:05</span>
              <span className="text-slate-800 flex-1">Failed to load resource: net::ERR_CONNECTION_REFUSED</span>
              <span className="text-slate-400 text-right text-[11px]">analytics.js:12</span>
            </div>
          </div>
        </section>

        {/* ===== GENERATED RECOMMENDATIONS AND DOWNLOAD EXPORT ===== */}
        <section className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
            <div>
              <h2 className="text-sm font-bold tracking-tight text-slate-900 uppercase"><span className="text-indigo-500 font-mono mr-1">05</span> QA Actions & Prescriptions</h2>
              <p className="text-xs text-slate-500 mt-0.5">Automated AI recommended code changes</p>
            </div>
            <button
              onClick={handleDownloadPDF}
              className="px-4 py-2 border border-indigo-200 hover:border-indigo-500 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-semibold tracking-wide font-mono shadow-sm transition-all hover:bg-indigo-100 active:scale-95"
            >
              Export PDF Report
            </button>
          </div>

          <div className="space-y-3">
            <IssueRow
              title="Checkout confirmation throws 500 on submit"
              fix="Null-check the order payload stack context before rendering the confirmation DOM tree."
              category="FUNCTIONAL"
              severity="high"
            />
            <IssueRow
              title="Pricing table overflows viewport on mobile (375px)"
              fix="Switch the standard grid element structure layout parameters down to single stacked view configurations below 480px thresholds."
              category="RESPONSIVE"
              severity="high"
            />
            <IssueRow
              title="Hero images missing alt attributes on 34 static page routes"
              fix="Inject explicit alternative metadata definitions to element matrices."
              category="ACCESSIBILITY"
              severity="med"
            />
          </div>
        </section>

      </main>
    </div>
  );
}

// --- Internal Presentation Component: Stat Cards ---
function StatCard({ label, value, subtext, subType = 'neutral', accentColor }: StatCardProps) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 relative overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      <div className={`absolute top-0 left-0 bottom-0 w-1 ${accentColor}`} />
      <div className="text-[10px] uppercase font-mono tracking-wider font-semibold text-slate-400 mb-1">{label}</div>
      <div className="text-2xl font-bold font-mono tracking-tight text-slate-900">{value}</div>
      <div className={`text-[11px] font-mono mt-2 ${subType === 'up' ? 'text-emerald-600' : subType === 'down' ? 'text-rose-600' : 'text-slate-400'
        }`}>
        {subtext}
      </div>
    </div>
  );
}

// --- Internal Presentation Component: Lighthouse Circle Gauges ---
function Gauge({ label, value, color }: GaugeProps) {
  return (
    <div className="text-center p-2 border border-slate-50 rounded-xl bg-slate-50/50">
      <div className="relative w-20 h-20 mx-auto flex items-center justify-center">
        {/* Simple inline circular SVG gauge simulation replacing heavyweight canvas elements */}
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
          <path className="text-slate-100" strokeWidth="3" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
          <path className={color} strokeDasharray={`${value}, 100`} strokeWidth="3" strokeLinecap="round" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
        </svg>
        <span className={`absolute font-mono font-bold text-base ${color}`}>{value}</span>
      </div>
      <div className="text-xs font-semibold text-slate-600 mt-2">{label}</div>
    </div>
  );
}

// --- Internal Presentation Component: Issue Actions ---
function IssueRow({ title, fix, category, severity }: IssueItem) {
  const sevColors = {
    high: 'bg-rose-500',
    med: 'bg-amber-500',
    low: 'bg-indigo-500'
  };

  return (
    <div className="flex items-start gap-4 p-3 rounded-xl bg-slate-50/60 border border-slate-150 hover:bg-slate-50 transition-colors">
      <div className={`w-1.5 h-10 rounded-full self-center shrink-0 ${sevColors[severity]}`} />
      <div className="flex-1 min-w-0">
        <h4 className="text-xs font-bold text-slate-900 truncate">{title}</h4>
        <p className="text-xs text-slate-500 mt-0.5"><b>Fix:</b> {fix}</p>
      </div>
      <span className="text-[10px] font-mono font-semibold px-2 py-1 bg-white border border-slate-200 text-slate-500 rounded-md shrink-0 uppercase tracking-wider">
        {category}
      </span>
    </div>
  );
}