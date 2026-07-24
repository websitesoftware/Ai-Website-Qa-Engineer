const { v4: uuidv4 } = require("uuid");

const FREQUENCY_MS = {
  hourly: 60 * 60 * 1000,
  daily: 24 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000,
};

// Every Phase 2 module — a monitor with no explicit `modules` runs the full
// Phase 1 + Phase 2 suite on each scheduled scan, not just the Phase 1
// crawl/links/lighthouse baseline.
const ALL_MODULES = ["accessibility", "seo", "visual-regression", "cross-browser", "performance-benchmark"];

function createMonitor({ url, name, frequency, modules, alertOnCritical = true, createdBy }) {
  const now = new Date().toISOString();
  const freq = FREQUENCY_MS[frequency] ? frequency : "daily";
  return {
    id: uuidv4(),
    url,
    name: name || url,
    frequency: freq,
    modules: Array.isArray(modules) && modules.length > 0 ? modules : ALL_MODULES,
    alertOnCritical,
    enabled: true,
    nextRunAt: Date.now() + FREQUENCY_MS[freq],
    lastRunAt: null,
    lastTestId: null,
    lastRunHadCriticalIssues: false,
    lastRunReconciled: true, // no run has happened yet, so nothing "in progress"
    createdBy,
    createdAt: now,
  };
}

module.exports = { createMonitor, FREQUENCY_MS, ALL_MODULES };
