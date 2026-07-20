const { v4: uuidv4 } = require("uuid");

/**
 * A Custom Testing Policy: the minimum acceptable scores a scan must hit.
 * Only one policy can be `active` at a time — scanEngine checks the active
 * one after every scan and can force a test to "failed" if it's violated.
 */
function createPolicy({ name, thresholds = {}, failSeverity, active = false, createdBy = null }) {
  const now = new Date().toISOString();
  return {
    id: uuidv4(),
    name: name || "Untitled Policy",
    thresholds: {
      overallScore: thresholds.overallScore ?? null,
      performance: thresholds.performance ?? null,
      accessibility: thresholds.accessibility ?? null,
      seo: thresholds.seo ?? null,
      bestPractices: thresholds.bestPractices ?? null,
    },
    // if any unresolved issue at/above this severity exists, the policy fails
    // the test regardless of scores. 'none' disables this check.
    failSeverity: ["critical", "high", "medium", "none"].includes(failSeverity)
      ? failSeverity
      : "critical",
    active,
    createdBy,
    createdAt: now,
    updatedAt: now,
  };
}

module.exports = { createPolicy };
