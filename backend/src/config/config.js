require("dotenv").config();

module.exports = {
  port: process.env.PORT || 5000,
  env: process.env.NODE_ENV || "development",
  crawler: {
    maxPages: parseInt(process.env.MAX_CRAWL_PAGES || "15", 10), // pages per site scan
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
  storage: {
    screenshotsDir: "storage/screenshots",
    reportsDir: "storage/reports",
  },
};
