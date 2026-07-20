const { v4: uuidv4 } = require("uuid");

const FREQUENCY_MS = {
  hourly: 60 * 60 * 1000,
  daily: 24 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000,
};

function createMonitor({ url, name, frequency, modules = [], alertOnCritical = true, createdBy }) {
  const now = new Date().toISOString();
  const freq = FREQUENCY_MS[frequency] ? frequency : "daily";
  return {
    id: uuidv4(),
    url,
    name: name || url,
    frequency: freq,
    modules,
    alertOnCritical,
    enabled: true,
    nextRunAt: Date.now() + FREQUENCY_MS[freq],
    lastRunAt: null,
    lastTestId: null,
    lastRunHadCriticalIssues: false,
    createdBy,
    createdAt: now,
  };
}

module.exports = { createMonitor, FREQUENCY_MS };
