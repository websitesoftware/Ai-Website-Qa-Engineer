/**
 * Screenshots the REAL page an issue was detected on for the "Affected
 * Component" view on a ticket — always a real, automatic capture, never a
 * mockup/placeholder. When the issue has a specific selector and the
 * element is still on the page, it's highlighted in-page (outline +
 * shadow) and tightly cropped; otherwise this falls back to a real
 * screenshot of the page itself so something concrete is always shown.
 * Only returns { available: false } when there's no URL to visit at all,
 * or the page itself can't be reached.
 */

const fs = require("fs");
const path = require("path");
const config = require("../config/config");
const logger = require("../utils/logger");

const SCREENSHOT_ROOT = path.join(__dirname, "..", "..", config.storage.screenshotsDir);
const VIEWPORT = { width: 1280, height: 900 };
const PAD = 40;

function outputPath(testId, issueId) {
  return path.join(SCREENSHOT_ROOT, testId, `annotated-${issueId}.png`);
}

function publicPath(testId, issueId) {
  return `/screenshots/${testId}/annotated-${issueId}.png`;
}

/** Reuse a previously captured screenshot instead of re-rendering the page every time it's viewed. */
function cached(testId, issueId) {
  return fs.existsSync(outputPath(testId, issueId))
    ? { available: true, path: publicPath(testId, issueId) }
    : null;
}

async function captureAnnotatedComponent(browser, { url, selector, testId, issueId }) {
  const existing = cached(testId, issueId);
  if (existing) return existing;

  if (!url) {
    return { available: false, reason: "no_url" };
  }

  const outPath = outputPath(testId, issueId);
  const page = await browser.newPage();
  try {
    await page.setViewport(VIEWPORT);
    await page.goto(url, { waitUntil: "networkidle2", timeout: 20000 });

    let clip = null;
    let annotated = false;

    if (selector) {
      const found = await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        if (!el) return false;
        el.scrollIntoView({ block: "center", inline: "center" });
        return true;
      }, selector);

      if (found) {
        // Let the scroll settle before measuring/highlighting.
        await new Promise((r) => setTimeout(r, 150));

        const rect = await page.evaluate((sel) => {
          const el = document.querySelector(sel);
          if (!el) return null;
          const r = el.getBoundingClientRect();
          el.style.outline = "3px solid #ef4444";
          el.style.outlineOffset = "2px";
          el.style.boxShadow = "0 0 0 6px rgba(239,68,68,0.25)";
          return { x: r.x, y: r.y, width: r.width, height: r.height };
        }, selector);

        if (rect && rect.width > 0 && rect.height > 0) {
          const clipX = Math.max(0, rect.x - PAD);
          const clipY = Math.max(0, rect.y - PAD);
          clip = {
            x: clipX,
            y: clipY,
            width: Math.min(rect.width + PAD * 2, VIEWPORT.width - clipX),
            height: Math.min(rect.height + PAD * 2, VIEWPORT.height - clipY),
          };
          annotated = true;
        }
      }
    }

    // No usable selector, element not found, or not visible: fall back to a
    // real screenshot of the page itself so a capture is always shown.
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    await page.screenshot(clip ? { path: outPath, clip } : { path: outPath });

    return { available: true, path: publicPath(testId, issueId), annotated };
  } catch (err) {
    logger.warn(
      "componentSnapshot",
      `Capture failed for ${url}${selector ? ` (${selector})` : ""}: ${err.message}`,
    );
    return { available: false, reason: "capture_failed", error: err.message };
  } finally {
    await page.close();
  }
}

module.exports = { captureAnnotatedComponent };
