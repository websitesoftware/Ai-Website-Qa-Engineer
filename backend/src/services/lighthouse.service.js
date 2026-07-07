
// module.exports = { runLighthouseAudit };
const chromeLauncher = require("chrome-launcher");
const config = require("../config/config");
const logger = require("../utils/logger");

async function runLighthouseAudit(url) {
  let chrome;
  try {
    const { default: lighthouse } = await import("lighthouse");

    chrome = await chromeLauncher.launch({
      chromeFlags: [
        "--headless=new",
        "--no-sandbox",
        "--disable-gpu",
        "--disable-dev-shm-usage",
      ],
    });

    const result = await lighthouse(url, {
      port: chrome.port,
      output: "json",
      onlyCategories: config.lighthouse.categories,
      logLevel: "error",
    });

    const lhr = result.lhr;
    const scores = {
      performance: Math.round((lhr.categories.performance?.score || 0) * 100),
      accessibility: Math.round(
        (lhr.categories.accessibility?.score || 0) * 100,
      ),
      seo: Math.round((lhr.categories.seo?.score || 0) * 100),
      bestPractices: Math.round(
        (lhr.categories["best-practices"]?.score || 0) * 100,
      ),
    };

    // Core Web Vitals — used by performanceBenchmark.service.js for trend comparison
    const metrics = {
      firstContentfulPaint:
        lhr.audits["first-contentful-paint"]?.numericValue ?? null,
      largestContentfulPaint:
        lhr.audits["largest-contentful-paint"]?.numericValue ?? null,
      totalBlockingTime:
        lhr.audits["total-blocking-time"]?.numericValue ?? null,
      cumulativeLayoutShift:
        lhr.audits["cumulative-layout-shift"]?.numericValue ?? null,
      speedIndex: lhr.audits["speed-index"]?.numericValue ?? null,
      timeToInteractive: lhr.audits["interactive"]?.numericValue ?? null,
    };

    const failingAudits = Object.values(lhr.audits)
      .filter(
        (a) =>
          a.score !== null && a.score < 0.9 && a.scoreDisplayMode !== "manual",
      )
      .sort((a, b) => (a.score ?? 1) - (b.score ?? 1))
      .slice(0, 20)
      .map((a) => ({
        id: a.id,
        title: a.title,
        description: a.description?.replace(/\[.*?\]\(.*?\)/g, "").trim(),
        score: a.score,
        displayValue: a.displayValue || null,
      }));

    return { scores, metrics, failingAudits };
  } catch (err) {
    logger.error("lighthouse", `Audit failed for ${url}: ${err.message}`);
    return {
      scores: {
        performance: null,
        accessibility: null,
        seo: null,
        bestPractices: null,
      },
      metrics: {
        firstContentfulPaint: null,
        largestContentfulPaint: null,
        totalBlockingTime: null,
        cumulativeLayoutShift: null,
        speedIndex: null,
        timeToInteractive: null,
      },
      failingAudits: [],
      error: err.message,
    };
  } finally {
    if (chrome) await chrome.kill();
  }
}

module.exports = { runLighthouseAudit };
