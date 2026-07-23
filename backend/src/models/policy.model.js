const { v4: uuidv4 } = require("uuid");

const SCORE_KEYS = ["overallScore", "performance", "accessibility", "seo", "bestPractices"];

// Permissive by default (0-100 = always in range) so a freshly created
// policy doesn't fail every scan until each range is actually configured.
const DEFAULT_SCORE_RANGES = SCORE_KEYS.reduce((acc, key) => {
  acc[key] = { min: 0, max: 100 };
  return acc;
}, {});

function normalizeRange(range, fallback) {
  const min = Number.isFinite(range?.min) ? range.min : fallback.min;
  const max = Number.isFinite(range?.max) ? range.max : fallback.max;
  return { min, max };
}

/**
 * A Custom Testing Policy: a min-max acceptable range for each of the five
 * scores a scan produces (Overall, Performance, Accessibility, SEO, Best
 * Practices). A scan passes only when every score falls inside its range.
 * Only one policy can be `active` at a time — scanEngine falls back to the
 * active one for any test that didn't explicitly pick a policy.
 */
function createPolicy({ name, scoreRanges = {}, active = false, createdBy = null }) {
  const now = new Date().toISOString();
  return {
    id: uuidv4(),
    name: name || "Untitled Policy",
    scoreRanges: SCORE_KEYS.reduce((acc, key) => {
      acc[key] = normalizeRange(scoreRanges[key], DEFAULT_SCORE_RANGES[key]);
      return acc;
    }, {}),
    active,
    createdBy,
    createdAt: now,
    updatedAt: now,
  };
}

module.exports = { createPolicy, SCORE_KEYS, DEFAULT_SCORE_RANGES };
