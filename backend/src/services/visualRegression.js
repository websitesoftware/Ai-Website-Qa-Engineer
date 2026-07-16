// backend/services/visualRegression.js
//
// ASSUMPTION: Node + Express + Playwright. If your backend is FastAPI, the
// logic is identical — swap Playwright-Node for playwright-python and
// pixelmatch for `odiff` or Pillow's ImageChops. Do not skip the STABILIZATION
// section in either case; it is the whole ballgame.
//
// deps: npm i playwright pngjs pixelmatch

const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const { chromium } = require("playwright");
const { PNG } = require("pngjs");
const pixelmatch = require("pixelmatch");

const STORAGE_DIR =
  process.env.SHOT_STORAGE_DIR || path.join(__dirname, "../../storage");
const BASELINE_DIR = path.join(STORAGE_DIR, "baselines");
const RUN_DIR = path.join(STORAGE_DIR, "runs");

// ---------------------------------------------------------------------------
// Thresholds. THESE ARE ARBITRARY. Tune them against your own sites within a
// week of shipping, or they will lie to your users.
// ---------------------------------------------------------------------------
const THRESHOLDS = {
  perfect: 0.01, // < 0.01% of pixels changed  -> 'perfect'
  good: 0.5, // < 0.5%                     -> 'good'
  // >= 0.5%                    -> 'bad'
};

// pixelmatch per-pixel tolerance. 0.1 is the standard value that ignores
// anti-aliasing noise without hiding real changes. Lower = more false positives.
const PIXEL_TOLERANCE = 0.1;

const VIEWPORTS = [
  { label: "desktop", width: 1440, height: 900 },
  { label: "mobile", width: 390, height: 844 },
];

// ---------------------------------------------------------------------------
// localhost targets
// ---------------------------------------------------------------------------
// A DEPLOYED backend cannot reach the user's localhost. `localhost` resolves to
// the SERVER's loopback. Silently scanning your own container and reporting it
// as the user's site is worse than failing. So: fail loudly, unless the backend
// is running on the same machine as the target (local dev), which you opt into
// with ALLOW_LOOPBACK_TARGETS=true in your .env.local only.
const LOOPBACK = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1", "[::1]"]);

function assertReachable(targetUrl) {
  const host = new URL(targetUrl).hostname;
  const isLocal = LOOPBACK.has(host) || host.endsWith(".local");
  if (isLocal && process.env.ALLOW_LOOPBACK_TARGETS !== "true") {
    const err = new Error(
      `Cannot scan "${targetUrl}": localhost on this server is not your machine. ` +
        `Expose the site with a tunnel (ngrok / cloudflared) and scan the public URL, ` +
        `or run the scanner locally.`,
    );
    err.code = "LOOPBACK_TARGET";
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Baseline identity
// ---------------------------------------------------------------------------
// A baseline belongs to (url, viewport). NOT to a testId. testId is the run;
// the baseline outlives every run. Getting this wrong is the #1 way people
// build a "visual regression" tool that can never actually detect a regression.
const shotKey = (url, viewport) =>
  crypto
    .createHash("sha1")
    .update(`${url}|${viewport.label}`)
    .digest("hex")
    .slice(0, 16);

// ---------------------------------------------------------------------------
// STABILIZATION — read this before you touch anything else
// ---------------------------------------------------------------------------
const KILL_MOTION_CSS = `
  *, *::before, *::after {
    animation: none !important;
    transition: none !important;
    animation-duration: 0s !important;
    transition-duration: 0s !important;
    caret-color: transparent !important;
    scroll-behavior: auto !important;
  }
  video, .carousel, [data-autoplay] { visibility: hidden !important; }
`;

async function stabilize(page, maskSelectors = []) {
  await page.addStyleTag({ content: KILL_MOTION_CSS });

  // Trigger lazy-loaded images by walking the full page, then return to top.
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let y = 0;
      const step = () => {
        window.scrollTo(0, y);
        y += window.innerHeight;
        if (y < document.body.scrollHeight) setTimeout(step, 60);
        else {
          window.scrollTo(0, 0);
          setTimeout(resolve, 200);
        }
      };
      step();
    });
  });

  // Fonts must be resolved or your text shifts by 1px and everything "fails".
  await page.evaluate(() => document.fonts.ready);

  // Black out volatile regions: timestamps, ad slots, live counters.
  for (const sel of maskSelectors) {
    await page
      .evaluate((s) => {
        document.querySelectorAll(s).forEach((el) => {
          el.style.background = "#000";
          el.style.color = "transparent";
        });
      }, sel)
      .catch(() => {});
  }

  await page.waitForLoadState("networkidle").catch(() => {});
}

// ---------------------------------------------------------------------------
// Capture + diff
// ---------------------------------------------------------------------------
async function captureAndCompare(
  testId,
  targetUrl,
  { maskSelectors = [] } = {},
) {
  assertReachable(targetUrl);

  await fs.mkdir(BASELINE_DIR, { recursive: true });
  await fs.mkdir(path.join(RUN_DIR, testId), { recursive: true });

  const browser = await chromium.launch();
  const results = [];

  try {
    for (const viewport of VIEWPORTS) {
      const key = shotKey(targetUrl, viewport);
      const ctx = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        deviceScaleFactor: 1, // pin it. Retina vs non-retina = 100% diff.
        reducedMotion: "reduce",
        // Freeze anything that renders "now".
        timezoneId: "UTC",
        locale: "en-US",
      });
      const page = await ctx.newPage();

      await page.goto(targetUrl, {
        waitUntil: "domcontentloaded",
        timeout: 45_000,
      });
      await stabilize(page, maskSelectors);

      const currentRel = `/static/runs/${testId}/${key}.png`;
      const currentAbs = path.join(RUN_DIR, testId, `${key}.png`);
      await page.screenshot({ path: currentAbs, fullPage: true });
      await ctx.close();

      const baselineAbs = path.join(BASELINE_DIR, `${key}.png`);
      const hasBaseline = await fs
        .access(baselineAbs)
        .then(() => true)
        .catch(() => false);

      // FIRST RUN: there is nothing to compare against. Do NOT report 'perfect'.
      // That's a lie, and it's the kind of lie that makes people trust a broken
      // tool. Report it as what it is.
      if (!hasBaseline) {
        results.push({
          key,
          url: targetUrl,
          viewport,
          currentUrl: currentRel,
          baselineUrl: null,
          diffUrl: null,
          diffPercent: null,
          diffPixels: null,
          verdict: "new-baseline",
          sizeMismatch: false,
          capturedAt: new Date().toISOString(),
        });
        continue;
      }

      const baselinePng = PNG.sync.read(await fs.readFile(baselineAbs));
      const currentPng = PNG.sync.read(await fs.readFile(currentAbs));

      // Page got taller/shorter. pixelmatch requires identical dimensions, so
      // composite both onto a canvas of the max size; the extra area counts as
      // changed, which is correct — the layout DID change.
      const width = Math.max(baselinePng.width, currentPng.width);
      const height = Math.max(baselinePng.height, currentPng.height);
      const sizeMismatch =
        baselinePng.width !== currentPng.width ||
        baselinePng.height !== currentPng.height;

      const a = pad(baselinePng, width, height);
      const b = pad(currentPng, width, height);
      const diff = new PNG({ width, height });

      const diffPixels = pixelmatch(a.data, b.data, diff.data, width, height, {
        threshold: PIXEL_TOLERANCE,
        includeAA: false,
        alpha: 0.25,
        diffColor: [255, 0, 128],
      });

      const diffRel = `/static/runs/${testId}/${key}-diff.png`;
      await fs.writeFile(
        path.join(RUN_DIR, testId, `${key}-diff.png`),
        PNG.sync.write(diff),
      );

      const diffPercent = (diffPixels / (width * height)) * 100;

      let verdict;
      if (sizeMismatch) verdict = "bad";
      else if (diffPercent < THRESHOLDS.perfect) verdict = "perfect";
      else if (diffPercent < THRESHOLDS.good) verdict = "good";
      else verdict = "bad";

      const bstat = await fs.stat(baselineAbs);

      results.push({
        key,
        url: targetUrl,
        viewport,
        currentUrl: currentRel,
        // Cache-bust the baseline: the file is overwritten on approve, so a
        // long-lived immutable cache would keep serving the old one forever.
        baselineUrl: `/static/baselines/${key}.png?v=${bstat.mtimeMs}`,
        diffUrl: diffRel,
        diffPercent: Number(diffPercent.toFixed(3)),
        diffPixels,
        verdict,
        sizeMismatch,
        capturedAt: new Date().toISOString(),
      });
    }
  } finally {
    await browser.close();
  }

  return results;
}

function pad(src, width, height) {
  if (src.width === width && src.height === height) return src;
  const out = new PNG({ width, height, fill: true });
  PNG.bitblt(src, out, 0, 0, src.width, src.height, 0, 0);
  return out;
}

// ---------------------------------------------------------------------------
// Approve baseline: promote a run's current screenshot to the baseline.
// ---------------------------------------------------------------------------
async function approveBaseline(testId, key) {
  const from = path.join(RUN_DIR, testId, `${key}.png`);
  const to = path.join(BASELINE_DIR, `${key}.png`);
  await fs.mkdir(BASELINE_DIR, { recursive: true });
  await fs.copyFile(from, to);
  return { key, approvedAt: new Date().toISOString() };
}

module.exports = { captureAndCompare, approveBaseline, VIEWPORTS, THRESHOLDS };

// ===========================================================================
// ROUTES — mount these in your Express app
// ===========================================================================
//
// const cors = require('cors');
// const { approveBaseline } = require('./services/visualRegression');
//
// // Screenshots are served from the BACKEND origin, not the frontend. Without
// // CORS here, <img> still loads (images aren't CORS-gated) but any canvas work
// // or fetch() on them will fail. Set it correctly now.
// app.use(
//   '/static',
//   cors({ origin: process.env.FRONTEND_ORIGIN }),
//   express.static(STORAGE_DIR, { maxAge: '1h' })
// );
//
// app.post('/api/tests/:testId/visual/:key/approve', async (req, res) => {
//   try {
//     res.json(await approveBaseline(req.params.testId, req.params.key));
//   } catch (e) {
//     res.status(400).json({ error: e.message });
//   }
// });
