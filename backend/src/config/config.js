// require("dotenv").config();

// module.exports = {
//   port: process.env.PORT || 5000,
//   env: process.env.NODE_ENV || "development",
//   crawler: {
//     maxPages: parseInt(process.env.MAX_CRAWL_PAGES || "15", 10), // pages per site scan
//     maxDepth: parseInt(process.env.MAX_CRAWL_DEPTH || "2", 10),
//     concurrency: parseInt(process.env.CRAWL_CONCURRENCY || "4", 10),
//     timeoutMs: parseInt(process.env.CRAWL_TIMEOUT_MS || "15000", 10),
//   },
//   viewports: [
//     { name: "mobile", width: 375, height: 812 },
//     { name: "tablet", width: 768, height: 1024 },
//     { name: "desktop", width: 1440, height: 900 },
//   ],
//   lighthouse: {
//     categories: ["performance", "accessibility", "seo", "best-practices"],
//   },
//   storage: {
//     screenshotsDir: "storage/screenshots",
//     reportsDir: "storage/reports",
//   },
// };
require("dotenv").config();

module.exports = {
  port: process.env.PORT || 5000,
  env: process.env.NODE_ENV || "development",
  crawler: {
    maxPages: parseInt(process.env.MAX_CRAWL_PAGES || "15", 10),
    maxDepth: parseInt(process.env.MAX_CRAWL_DEPTH || "2", 10),
    concurrency: parseInt(process.env.CRAWL_CONCURRENCY || "4", 10),
    timeoutMs: parseInt(process.env.CRAWL_TIMEOUT_MS || "15000", 10),
  },
  viewports: [
    { name: "mobile", width: 375, height: 812 },
    { name: "tablet", width: 768, height: 1024 },
    { name: "desktop", width: 1440, height: 900 },
  ],
  lighthouse: {
    categories: ["performance", "accessibility", "seo", "best-practices"],
  },
  // ---- Phase 2 config ----
  accessibility: {
    standards: ["wcag2a", "wcag2aa", "best-practice"],
  },
  visualRegression: {
    diffThresholdPercent: parseFloat(process.env.VISUAL_DIFF_THRESHOLD || "1"),
  },
  crossBrowser: {
    browsers: ["chromium", "firefox", "webkit"],
    timeoutMs: parseInt(process.env.CROSS_BROWSER_TIMEOUT_MS || "30000", 10),
  },
  storage: {
    screenshotsDir: "storage/screenshots",
    reportsDir: "storage/reports",
    baselinesDir: "storage/baselines",
  },
};
