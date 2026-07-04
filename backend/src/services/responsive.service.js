const fs = require("fs");
const path = require("path");
const config = require("../config/config");
const logger = require("../utils/logger");

const SCREENSHOT_ROOT = path.join(__dirname, "..", "..", config.storage.screenshotsDir);

/**
 * Captures full-page screenshots of `url` at each configured viewport
 * (mobile / tablet / desktop) so the dashboard can show responsive previews
 * and (later) visual regression diffs.
 */
async function captureResponsiveScreenshots(browser, url, testId) {
  const outDir = path.join(SCREENSHOT_ROOT, testId);
  fs.mkdirSync(outDir, { recursive: true });

  const results = [];
  const page = await browser.newPage();

  try {
    for (const viewport of config.viewports) {
      await page.setViewport({ width: viewport.width, height: viewport.height });
      try {
        await page.goto(url, { waitUntil: "networkidle2", timeout: config.crawler.timeoutMs });
        const fileName = `${viewport.name}.png`;
        const filePath = path.join(outDir, fileName);
        await page.screenshot({ path: filePath, fullPage: true });

        results.push({
          viewport: viewport.name,
          width: viewport.width,
          height: viewport.height,
          path: `/screenshots/${testId}/${fileName}`,
        });
      } catch (err) {
        logger.warn("responsive", `Failed screenshot (${viewport.name}) for ${url}: ${err.message}`);
        results.push({ viewport: viewport.name, error: err.message });
      }
    }
  } finally {
    await page.close();
  }

  return results;
}

module.exports = { captureResponsiveScreenshots };
