// lib/fixTemplates.ts
//
// Fix-code templates, lifted out of IssuesPage.tsx.
//
// TODO: this matches on the human-readable `title` string, which means a
// reworded title silently falls through to the generic fallback. Key this off
// the Lighthouse audit id (`unused-javascript`, `color-contrast`, ...) once
// you plumb `auditId` through buildIssueRows(). Same fix as lib/phases.ts.

export const getDynamicFixCode = (title: string): string => {
  const t = title.toLowerCase();

  // --- Performance ---------------------------------------------------------
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
    return `<!-- STEP 1: Find your actual LCP element first.
     DevTools → Lighthouse → "Largest Contentful Paint element"
     It tells you the exact node. Don't guess. -->

<!-- IF the LCP element is an IMAGE: -->
<link rel="preload" as="image" href="YOUR_ACTUAL_IMAGE_PATH" fetchpriority="high">
<img src="YOUR_ACTUAL_IMAGE_PATH" alt="..." fetchpriority="high" />
<!-- and REMOVE loading="lazy" from it — it's above the fold -->

<!-- IF the LCP element is TEXT (h1, hero heading — ~40% of real sites):
     Preloading an image does NOTHING. Do this instead: -->
@font-face { font-display: swap; }
<link rel="preload" as="font" href="/fonts/your-font.woff2" type="font/woff2" crossorigin>
<!-- and remove render-blocking <script> above that node -->`;
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

  // --- Accessibility -------------------------------------------------------
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

  // --- SEO -----------------------------------------------------------------
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

  // --- Security ------------------------------------------------------------
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

  // --- Fallback ------------------------------------------------------------
  return `// No specific automated template matched for: "${title}"
// General resolution steps:
// 1. Open browser DevTools > Elements/Console to locate the exact node/error
// 2. Cross-reference the issue's "Analysis" section above for the root cause
// 3. Apply the fix directly in the relevant component/config file
// 4. Re-test using the "Re-test Endpoint" button to confirm resolution`;
};
