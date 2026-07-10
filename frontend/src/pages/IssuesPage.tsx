'use client';
import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bug,
  MagnifyingGlass,
  Globe,
  Sparkle,
  Lightbulb,
  Copy,
  EyeSlash,
  ArrowsCounterClockwise,
  Check,
  Folder
} from '@phosphor-icons/react';
import { useQAData } from '../context/QADataContext';
import { useToast } from '../context/ToastContext';
import { buildIssueRows, IssueRow } from '../lib/adapters';
import { EmptyState } from '../components/ui/EmptyState';
import { Skeleton } from '../components/ui/Skeleton';

const severityBadge: Record<string, string> = {
  critical: 'bg-red-50 text-red-600 border-red-100',
  high: 'bg-orange-50 text-orange-600 border-orange-100',
  medium: 'bg-amber-50 text-amber-600 border-amber-100',
  low: 'bg-slate-100 text-slate-600 border-slate-200',
};

const severityBorder: Record<string, string> = {
  critical: 'border-red-500',
  high: 'border-orange-500',
  medium: 'border-amber-500',
  low: 'border-slate-400',
};


const getDynamicFixCode = (title: string): string => {
  const t = title.toLowerCase();

  // --- Performance related ---
  if (t.includes('unused javascript') || (t.includes('script') && !t.includes('devtools'))) {
    return `// Fix: Load non-critical scripts async/defer and code-split unused bundles
<script src="/js/bundle.js" defer></script>

// For dynamic imports (React example):
const HeavyComponent = React.lazy(() => import('./HeavyComponent'));

// Third-party scripts:
<script src="https://example.com/analytics.js" async></script>`;
  }

  if (t.includes('unused css')) {
    return `// Fix: Remove unused CSS with PurgeCSS (Tailwind example)
// tailwind.config.js
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"], // only scans used files
  theme: { extend: {} },
  plugins: [],
};

// For non-Tailwind projects, use PurgeCSS CLI:
// npx purgecss --css styles.css --content index.html --output ./dist`;
  }

  if (t.includes('render-blocking') || t.includes('render blocking')) {
    return `<!-- Fix: Defer non-critical CSS, inline critical CSS -->
<link rel="preload" href="/css/main.css" as="style" onload="this.onload=null;this.rel='stylesheet'">
<noscript><link rel="stylesheet" href="/css/main.css"></noscript>

<style>
  /* Critical above-the-fold CSS inlined here */
</style>`;
  }

  if (t.includes('image') && (t.includes('size') || t.includes('optimiz') || t.includes('next-gen') || t.includes('format'))) {
    return `<!-- Fix: Serve responsive, next-gen images -->
<img
  src="/images/hero.webp"
  srcset="/images/hero-480.webp 480w, /images/hero-800.webp 800w"
  sizes="(max-width: 600px) 480px, 800px"
  loading="lazy"
  alt="Descriptive text for accessibility"
  width="800" height="450"
/>`;
  }

  if (t.includes('lazy') || t.includes('offscreen')) {
    return `<!-- Fix: Lazy-load offscreen images/iframes -->
<img src="/img/photo.jpg" loading="lazy" alt="..." />
<iframe src="/embed" loading="lazy"></iframe>`;
  }

  if (t.includes('font display') || t.includes('font-display')) {
    return `/* Fix: Prevent invisible text during font load */
@font-face {
  font-family: 'Inter';
  font-style: normal;
  font-weight: 400;
  font-display: swap; /* shows fallback font immediately, swaps once loaded */
  src: url('/fonts/inter.woff2') format('woff2');
}`;
  }

  if (t.includes('cumulative layout shift') || t.includes('cls')) {
    return `<!-- Fix: Reserve space for images/ads/embeds to prevent layout shift -->
<img src="/img/banner.jpg" width="1200" height="600" alt="..." />

/* CSS: reserve aspect-ratio box */
.media-wrapper {
  aspect-ratio: 16 / 9;
  width: 100%;
}`;
  }

  if (t.includes('largest contentful paint') || t.includes('lcp')) {
    return `<!-- Fix: Preload the LCP image, avoid lazy-loading it -->
<link rel="preload" as="image" href="/img/hero.webp" fetchpriority="high">
<img src="/img/hero.webp" alt="Hero" fetchpriority="high" />`;
  }

  if (t.includes('compress') || t.includes('gzip') || t.includes('text compression') || t.includes('brotli')) {
    return `# Fix: Enable text compression on the server

# Nginx:
gzip on;
gzip_types text/plain text/css application/javascript application/json;

# Express.js:
const compression = require('compression');
app.use(compression());`;
  }

  if (t.includes('cache') || t.includes('back/forward')) {
    return `# Fix: Correct caching headers for static assets & bfcache support
# Express.js:
app.use(express.static('public', {
  maxAge: '1y',
  immutable: true
}));

# Nginx:
location ~* \\.(js|css|png|jpg|woff2)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}

# Avoid 'no-store'/unload handlers that block back/forward cache`;
  }

  if (t.includes('minify') && t.includes('css')) {
    return `// Fix: Minify CSS in your build pipeline
// vite.config.js
export default {
  build: { cssMinify: true }
}

// or with PostCSS:
// npx postcss styles.css --use cssnano -o styles.min.css`;
  }

  if (t.includes('minify') && t.includes('javascript')) {
    return `// Fix: Minify JS output in your bundler
// vite.config.js
export default {
  build: { minify: 'esbuild' }
}

// Webpack: mode: 'production' auto-minifies via TerserPlugin`;
  }

  if (t.includes('http/2') || t.includes('http2')) {
    return `# Fix: Serve assets over HTTP/2 (multiplexed, no head-of-line blocking)
# Nginx:
listen 443 ssl http2;

# Most CDNs (Cloudflare, Vercel, Netlify) enable HTTP/2 by default — verify it's on.`;
  }

  if (t.includes('preconnect') || t.includes('third-party')) {
    return `<!-- Fix: Preconnect to required third-party origins -->
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="dns-prefetch" href="https://www.google-analytics.com">`;
  }

  if (t.includes('dom size') || t.includes('dom-size')) {
    return `// Fix: Reduce DOM depth/nodes
// - Use virtualization for long lists (react-window / react-virtualized)
import { FixedSizeList } from 'react-window';

<FixedSizeList height={400} itemCount={items.length} itemSize={40} width="100%">
  {({ index, style }) => <div style={style}>{items[index].name}</div>}
</FixedSizeList>`;
  }

  // --- Accessibility related ---
  if (t.includes('alt text') || t.includes('image alt') || (t.includes('alt') && t.includes('attribute'))) {
    return `<!-- Fix: Add meaningful alt text to every informative image -->
<img src="/img/product.jpg" alt="Blue running shoes, side view" />

<!-- Decorative images should have empty alt -->
<img src="/img/divider.png" alt="" />`;
  }

  if (t.includes('contrast')) {
    return `/* Fix: Increase text/background contrast to meet WCAG AA (4.5:1) */
.button-primary {
  color: #ffffff;      /* was a lighter gray failing contrast */
  background: #1d4ed8; /* darker indigo, passes 4.5:1 against white text */
}`;
  }

  if (t.includes('aria') || t.includes('label') || t.includes('accessible name')) {
    return `<!-- Fix: Give interactive elements an accessible name -->
<button aria-label="Close dialog" onClick={onClose}>
  <XIcon />
</button>

<input type="search" aria-label="Search issues" placeholder="Search..." />`;
  }

  if (t.includes('heading') || t.includes('h1')) {
    return `<!-- Fix: Use one <h1> per page, keep heading levels sequential -->
<h1>Page Title</h1>
  <h2>Section</h2>
    <h3>Subsection</h3>
<!-- Don't skip from h1 to h3 directly -->`;
  }

  if (t.includes('tap target') || t.includes('touch target')) {
    return `/* Fix: Ensure tap targets are at least 48x48px with spacing */
.icon-button {
  min-width: 48px;
  min-height: 48px;
  padding: 12px;
  margin: 4px;
}`;
  }

  if (t.includes('form') && (t.includes('label') || t.includes('input'))) {
    return `<!-- Fix: Associate every input with a <label> -->
<label htmlFor="email">Email address</label>
<input id="email" name="email" type="email" required />`;
  }

  if (t.includes('duplicate id')) {
    return `// Fix: Ensure IDs are unique across the DOM
// Use dynamic/unique ids instead of hardcoded ones
<input id={\`email-\${userId}\`} />
// Avoid reusing the same static id in repeated components/lists`;
  }

  // --- SEO related ---
  if (t.includes('meta description')) {
    return `<!-- Fix: Add a unique, descriptive meta description (120-160 chars) -->
<meta name="description" content="Track, prioritize, and resolve automated QA issues across all your scanned websites in one dashboard." />`;
  }

  if (t.includes('title tag') || t.includes('document title') || t.includes('page title')) {
    return `<!-- Fix: Add a unique, descriptive <title> per page -->
<title>Issue Tracker – QA Dashboard</title>`;
  }

  if (t.includes('robots.txt')) {
    return `# Fix: Add a valid robots.txt at your domain root
# /robots.txt
User-agent: *
Allow: /
Sitemap: https://example.com/sitemap.xml`;
  }

  if (t.includes('sitemap')) {
    return `<!-- Fix: Add/submit a valid sitemap.xml -->
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://example.com/</loc></url>
  <url><loc>https://example.com/issues</loc></url>
</urlset>`;
  }

  if (t.includes('viewport')) {
    return `<!-- Fix: Add a responsive viewport meta tag -->
<meta name="viewport" content="width=device-width, initial-scale=1" />`;
  }

  if (t.includes('charset')) {
    return `<!-- Fix: Declare charset early in <head> -->
<meta charset="UTF-8" />`;
  }

  if (t.includes('broken link') || t.includes('404')) {
    return `// Fix: Find and correct/remove broken links
// Run a link checker in CI:
// npx linkinator https://example.com --recurse

// Then update <a href="..."> to the correct, live URL
// or remove the link if the target no longer exists.`;
  }

  // --- Security related ---
  if (t.includes('https') || t.includes('mixed content')) {
    return `<!-- Fix: Serve all resources over HTTPS, no mixed content -->
<script src="https://example.com/lib.js"></script> <!-- not http:// -->

# Redirect all HTTP to HTTPS (Nginx):
server {
  listen 80;
  return 301 https://$host$request_uri;
}`;
  }

  if (t.includes('csp') || t.includes('content security policy')) {
    return `# Fix: Add a Content-Security-Policy header
# Express.js:
res.setHeader(
  'Content-Security-Policy',
  "default-src 'self'; script-src 'self' https://trusted.cdn.com"
);`;
  }

  if (t.includes('x-frame') || t.includes('clickjacking')) {
    return `# Fix: Prevent clickjacking with frame protection headers
res.setHeader('X-Frame-Options', 'DENY');
res.setHeader('Content-Security-Policy', "frame-ancestors 'none'");`;
  }

  if (t.includes('vulnerable') && t.includes('librar')) {
    return `// Fix: Update vulnerable dependencies to patched versions
npm audit fix

// Or upgrade a specific package:
npm install package-name@latest`;
  }

  if (t.includes('chrome devtools') || t.includes('devtools') || t.includes('console error')) {
    return `// Fix: Resolve the underlying console error, don't just suppress it
// Example: guard against null before accessing a property
if (targetNode) {
  targetNode.removeAttribute('data-temp-style');
}
// Check the browser console stack trace to find the exact line throwing the error`;
  }

  // --- Generic fallback (only reached for truly unmatched categories) ---
  return `// No specific automated template matched for: "${title}"
// General resolution steps:
// 1. Open browser DevTools > Elements/Console to locate the exact node/error
// 2. Cross-reference the issue's "Analysis" section above for the root cause
// 3. Apply the fix directly in the relevant component/config file
// 4. Re-test using the "Re-test Endpoint" button to confirm resolution`;
};

export const IssuesPage: React.FC = () => {
  const { tests, loading, rerunTest, updateIssue } = useQAData();
  const { showToast } = useToast();

  const allRows = useMemo(() => buildIssueRows(tests), [tests]);
  const rowKey = (r: IssueRow) => `${r.testId}:${r.id}`;

  // 1. DYNAMIC WEBSITE FOLDER LOGIC: Saari unique websites extract karein
  const uniqueWebsites = useMemo(() => {
    const sites = new Set<string>();
    allRows.forEach((row) => {
      if (row.url) {
        try {
          // Pure domain name nikalne ke liye URL parsing (e.g., gemini.google.com)
          const domain = new URL(row.url).hostname;
          sites.add(domain);
        } catch {
          sites.add(row.url); // Fallback agar data clean nahi hai
        }
      }
    });
    return Array.from(sites);
  }, [allRows]);

  // States
  const [selectedWebsite, setSelectedWebsite] = useState<string>('all');
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [currentTab, setCurrentTab] = useState<'Open' | 'Critical' | 'Resolved'>('Open');
  const [searchQuery, setSearchQuery] = useState('');
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  // Reset active key jab bhi website ya folder switch ho taaki system crush na ho
  const handleWebsiteChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedWebsite(e.target.value);
    setActiveKey(null);
  };

  // 2. MULTI-LAYER FILTERING: Tab + Search + Website Folder Filter
  const filteredRows = allRows.filter((row) => {
    if (dismissed.has(rowKey(row))) return false;

    // Website filter check
    if (selectedWebsite !== 'all') {
      try {
        const domain = new URL(row.url).hostname;
        if (domain !== selectedWebsite) return false;
      } catch {
        if (row.url !== selectedWebsite) return false;
      }
    }

    // Search filter check
    const q = searchQuery.toLowerCase();
    const matchesSearch = row.title.toLowerCase().includes(q) || row.repId.toLowerCase().includes(q);
    if (!matchesSearch) return false;

    // Tab filter check
    if (currentTab === 'Open') return !row.resolved;
    if (currentTab === 'Critical') return !row.resolved && row.severity === 'critical';
    return row.resolved;
  });

  const activeRow = filteredRows.find((r) => rowKey(r) === activeKey) || filteredRows[0] || null;

  // Counts updating dynamically based on selected folder/website
  const openCount = filteredRows.filter((r) => !r.resolved && !dismissed.has(rowKey(r))).length;
  const criticalCount = filteredRows.filter((r) => !r.resolved && r.severity === 'critical' && !dismissed.has(rowKey(r))).length;

  const handleResolveToggle = async (row: IssueRow) => {
    try {
      await updateIssue(row.testId, row.id, !row.resolved);
      showToast(row.resolved ? `Reopened ${row.repId}` : `Marked ${row.repId} as resolved`, 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not update issue', 'error');
    }
  };

  const handleRetest = async (row: IssueRow) => {
    try {
      await rerunTest(row.testId);
      showToast('Triggering a fresh scan for this site...', 'info');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not start re-test', 'error');
    }
  };

  const handleDismiss = (row: IssueRow) => {
    setDismissed((prev) => new Set(prev).add(rowKey(row)));
    showToast('Hidden from this view until the next scan', 'info');
  };

  const handleCopy = (row: IssueRow, explicitCode?: string) => {
    const text = `[${row.severity.toUpperCase()}] ${row.title}\nURL: ${row.url}\n\nAnalysis: ${row.analysis}${explicitCode ? `\n\nCode Fix Snippet:\n${explicitCode}` : ''
      }`;
    navigator.clipboard.writeText(text);
    showToast('Issue details and fix logic copied!', 'success');
  };

  return (
    <div className="space-y-6 w-full max-w-[1600px] mx-auto px-4 py-2">

      {/* Top Header Panel */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Bug className="text-indigo-600 w-7 h-7" /> Issue Tracker
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">Review, prioritize, and fix automated QA inspection issues.</p>
        </div>

        {/* Filters Group (Folder + Search) */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">

          {/* WEBSITE FOLDER DROPDOWN */}
          <div className="relative flex items-center bg-white border border-slate-200 rounded-lg shadow-sm focus-within:ring-4 focus-within:ring-indigo-500/10 transition-all px-3">
            <Folder className="text-indigo-500 w-4 h-4 mr-2" />
            <select
              value={selectedWebsite}
              onChange={handleWebsiteChange}
              className="py-2 bg-transparent text-sm text-slate-700 font-semibold focus:outline-none pr-6 cursor-pointer "
            >
              <option value="all">📂 All Scanned Sites</option>
              {uniqueWebsites.map((site) => (
                <option key={site} value={site}>
                  🌐 {site}
                </option>
              ))}
            </select>
          </div>

          {/* Search Box */}
          <div className="relative">
            <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search target issues..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 text-sm w-full sm:w-64 bg-white transition-all shadow-sm"
            />
          </div>
        </div>
      </div>

      {loading && allRows.length === 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5"><Skeleton className="h-[72vh] rounded-xl" /></div>
          <div className="lg:col-span-7"><Skeleton className="h-[72vh] rounded-xl" /></div>
        </div>
      ) : allRows.length === 0 ? (
        <EmptyState icon="bug-beetle" title="No issues yet" description="Run a scan to start populating the issue tracker." />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col lg:flex-row" style={{ height: '75vh' }}>

          {/* Left Feed Panel (Filtered according to folder selection) */}
          <section className="w-full lg:w-5/12 border-r border-slate-200 overflow-y-auto bg-slate-50/40 flex flex-col min-w-[320px]">
            <div className="px-5 py-4 bg-white border-b border-slate-200 flex items-center justify-between sticky top-0 z-10 shadow-sm/50">
              <div className="flex space-x-1 p-1 bg-slate-100 rounded-lg">
                {(['Open', 'Critical', 'Resolved'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setCurrentTab(tab)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-md relative transition-all ${currentTab === tab ? 'text-slate-900 bg-white shadow-sm' : 'text-slate-500 hover:text-slate-800'
                      }`}
                  >
                    {tab === 'Open' ? `Open (${openCount})` : tab === 'Critical' ? `Critical (${criticalCount})` : 'Resolved'}
                  </button>
                ))}
              </div>
              <span className="text-[11px] text-slate-400 font-semibold tracking-wide uppercase">
                {selectedWebsite === 'all' ? 'All Folders' : 'Filtered Site'}
              </span>
            </div>

            <div className="divide-y divide-slate-100 bg-white flex-1">
              <AnimatePresence initial={false}>
                {filteredRows.map((row) => {
                  const key = rowKey(row);
                  const isSelected = activeRow ? rowKey(activeRow) === key : false;
                  return (
                    <motion.div
                      key={key}
                      layout="position"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onClick={() => setActiveKey(key)}
                      className={`p-5 cursor-pointer border-l-[5px] ${severityBorder[row.severity] || 'border-slate-400'
                        } transition-all relative block outline-none ${isSelected ? 'bg-indigo-50/40 border-opacity-100 shadow-sm' : 'hover:bg-slate-50/60'
                        }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className={`text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded border ${severityBadge[row.severity] || severityBadge.low}`}>
                          {row.severity}
                        </span>
                        <span className="text-xs font-mono text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">{row.repId}</span>
                      </div>
                      <h4 className={`font-bold text-slate-900 mt-2.5 text-sm leading-snug tracking-tight ${row.resolved ? 'line-through text-slate-400' : ''}`}>
                        {row.title}
                      </h4>
                      <div className="flex items-center gap-2 mt-3.5 text-[11px] font-medium text-slate-500">
                        <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-600">{row.category}</span>
                        <span>•</span>
                        <span className="truncate max-w-[200px] font-mono text-slate-400">{row.url}</span>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
              {filteredRows.length === 0 && (
                <div className="p-12 text-center text-sm font-medium text-slate-400 bg-slate-50/50 h-full flex flex-col items-center justify-center gap-2">
                  <span>No issue entries found under this website directory.</span>
                </div>
              )}
            </div>
          </section>

          {/* Right Inspector Panel */}
          <section className="hidden lg:flex lg:w-7/12 flex-col bg-white overflow-y-auto">
            <AnimatePresence mode="wait">
              {activeRow ? (
                <motion.div
                  key={rowKey(activeRow)}
                  initial={{ opacity: 0, scale: 0.99 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.99 }}
                  transition={{ duration: 0.15 }}
                  className="p-6 flex-1 flex flex-col justify-between space-y-6"
                >
                  <div className="space-y-6">
                    {/* Header Details */}
                    <div className="space-y-2.5 border-b border-slate-100 pb-4">
                      <div className="flex items-center gap-3">
                        <span className={`text-xs font-extrabold uppercase tracking-wider px-2.5 py-1 rounded border ${severityBadge[activeRow.severity] || severityBadge.low}`}>
                          {activeRow.severity} severity
                        </span>
                        <span className="text-xs font-mono font-bold text-slate-400">{activeRow.repId}</span>
                      </div>
                      <h3 className="text-xl font-extrabold text-slate-950 tracking-tight leading-snug">{activeRow.title}</h3>
                      <div className="flex items-center gap-2 text-xs font-mono bg-slate-50 text-slate-600 border border-slate-100 px-3 py-1.5 rounded-lg w-fit max-w-full truncate">
                        <Globe className="text-slate-400 text-base flex-shrink-0" />
                        <span className="truncate">{activeRow.url}</span>
                      </div>
                    </div>

                    {/* Findings */}
                    <div className="bg-indigo-50/30 p-5 rounded-xl border border-indigo-100/50">
                      <div className="flex items-center gap-2 text-indigo-600 font-bold mb-2.5 text-sm">
                        <Sparkle className="text-base" />
                        <h4>Audit Findings & Analysis</h4>
                      </div>
                      <p className="text-sm text-slate-700 leading-relaxed font-medium">{activeRow.analysis}</p>
                    </div>

                    {/* Code Container */}
                    <div className="space-y-3">
                      <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                        <Lightbulb className="text-base text-amber-500" /> Resolution Blueprint & Code Implementation
                      </h4>

                      <div className="rounded-xl overflow-hidden bg-slate-950 shadow-md border border-slate-900 flex flex-col">
                        <div className="flex items-center justify-between px-4 py-2 bg-slate-900 text-slate-400 text-xs font-mono border-b border-slate-900">
                          <span className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-red-500/80 inline-block"></span>
                            <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80 inline-block"></span>
                            <span className="w-2.5 h-2.5 rounded-full bg-green-500/80 inline-block"></span>
                            <span className="ml-1 text-slate-500 font-sans font-semibold">{activeRow.category} fix template</span>
                          </span>
                          <button
                            onClick={() => handleCopy(activeRow, getDynamicFixCode(activeRow.title))}
                            className="hover:text-white transition-colors flex items-center gap-1.5 cursor-pointer font-sans font-bold"
                          >
                            <Copy className="text-xs" /> Copy Solution Code
                          </button>
                        </div>
                        <div className="p-4 overflow-x-auto  font-mono text-xs text-indigo-200/90 leading-relaxed whitespace-pre bg-slate-950/95">
                          {getDynamicFixCode(activeRow.title)}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between border-t border-slate-100 pt-5 mt-auto">
                    <button
                      onClick={() => handleDismiss(activeRow)}
                      className="px-3.5 py-2 text-slate-500 font-bold hover:bg-slate-100 hover:text-slate-700 rounded-lg transition-colors flex items-center gap-2 text-xs"
                    >
                      <EyeSlash className="w-4 h-4" /> Hide From Feed
                    </button>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleRetest(activeRow)}
                        className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold rounded-lg transition-colors text-xs flex items-center gap-1.5 shadow-sm"
                      >
                        <ArrowsCounterClockwise className="w-3.5 h-3.5" /> Re-test Endpoint
                      </button>
                      <button
                        onClick={() => handleResolveToggle(activeRow)}
                        className={`px-4 py-2 rounded-lg font-bold transition-all text-xs shadow-sm flex items-center gap-1.5 text-white ${activeRow.resolved ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-indigo-600 hover:bg-indigo-700'
                          }`}
                      >
                        <Check className="w-3.5 h-3.5 font-extrabold" /> {activeRow.resolved ? 'Reopen Case' : 'Mark As Fixed'}
                      </button>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <div className="h-full w-full flex items-center justify-center text-slate-400 text-sm font-medium">
                  Select an existing vulnerability block to inspect logs.
                </div>
              )}
            </AnimatePresence>
          </section>

        </div>
      )}
    </div>
  );
};