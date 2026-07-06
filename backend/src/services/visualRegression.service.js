const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { PNG } = require("pngjs");
const pixelmatch = require("pixelmatch");
const config = require("../config/config");
const logger = require("../utils/logger");

const SCREENSHOT_ROOT = path.join(
  __dirname,
  "..",
  "..",
  config.storage.screenshotsDir,
);
const BASELINES_DIR = path.join(
  __dirname,
  "..",
  "..",
  config.storage.baselinesDir,
);
const DIFF_THRESHOLD_PERCENT = config.visualRegression.diffThresholdPercent;

function urlHash(url) {
  return crypto.createHash("md5").update(url).digest("hex").slice(0, 12);
}

/**
 * Compares this run's screenshots (already captured by responsive.service)
 * against a stored baseline for the same URL + viewport. First scan for a
 * URL establishes the baseline; later scans are flagged if the diff exceeds
 * `diffThresholdPercent`.
 */
async function runVisualRegression(url, testId, screenshots) {
  const hash = urlHash(url);
  const baselineDir = path.join(BASELINES_DIR, hash);
  fs.mkdirSync(baselineDir, { recursive: true });

  const results = [];

  for (const shot of screenshots) {
    if (shot.error) continue;

    const currentPath = path.join(
      SCREENSHOT_ROOT,
      testId,
      `${shot.viewport}.png`,
    );
    if (!fs.existsSync(currentPath)) continue;

    const baselinePath = path.join(baselineDir, `${shot.viewport}.png`);

    if (!fs.existsSync(baselinePath)) {
      fs.copyFileSync(currentPath, baselinePath);
      results.push({
        viewport: shot.viewport,
        isNewBaseline: true,
        diffPixels: 0,
        diffPercentage: 0,
        significant: false,
      });
      continue;
    }

    try {
      const img1 = PNG.sync.read(fs.readFileSync(baselinePath));
      const img2 = PNG.sync.read(fs.readFileSync(currentPath));
      const width = Math.min(img1.width, img2.width);
      const height = Math.min(img1.height, img2.height);
      const diff = new PNG({ width, height });

      const diffPixels = pixelmatch(
        img1.data,
        img2.data,
        diff.data,
        width,
        height,
        { threshold: 0.1 },
      );
      const diffPercentage =
        Math.round((diffPixels / (width * height)) * 10000) / 100;
      const significant = diffPercentage > DIFF_THRESHOLD_PERCENT;

      let diffImagePath = null;
      if (diffPixels > 0) {
        const diffFileName = `${shot.viewport}-diff.png`;
        fs.writeFileSync(
          path.join(baselineDir, diffFileName),
          PNG.sync.write(diff),
        );
        diffImagePath = `/baselines/${hash}/${diffFileName}`;
      }

      results.push({
        viewport: shot.viewport,
        isNewBaseline: false,
        diffPixels,
        diffPercentage,
        significant,
        diffImagePath,
        baselinePath: `/baselines/${hash}/${shot.viewport}.png`,
      });
    } catch (err) {
      logger.error(
        "visualRegression",
        `Compare failed (${shot.viewport}) for ${url}: ${err.message}`,
      );
      results.push({ viewport: shot.viewport, error: err.message });
    }
  }

  return results;
}

module.exports = { runVisualRegression };
