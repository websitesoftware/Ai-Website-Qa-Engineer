const pLimit = require("p-limit");
const logger = require("../utils/logger");
const { runScan } = require("./scanEngine.service");

// Only 2 scans run at once by default — Puppeteer + Lighthouse are heavy.
const limit = pLimit(parseInt(process.env.SCAN_CONCURRENCY || "2", 10));

function enqueueScan(testId) {
  logger.info("queue", `Queued scan ${testId}`);
  limit(() => runScan(testId)).catch((err) => {
    logger.error("queue", `Unhandled error running scan ${testId}: ${err.message}`);
  });
}

function pendingCount() {
  return limit.pendingCount;
}

function activeCount() {
  return limit.activeCount;
}

module.exports = { enqueueScan, pendingCount, activeCount };
