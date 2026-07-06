const testsRepo = require("../repositories/tests.repository");

/**
 * Compares this run's Core Web Vitals against the most recent previous
 * completed run for the same URL, so regressions/improvements show up
 * over time.
 */
function benchmarkPerformance(url, currentMetrics, excludeTestId) {
  const previousRuns = testsRepo
    .list()
    .filter(
      (t) =>
        t.id !== excludeTestId &&
        t.url === url &&
        (t.status === "passed" || t.status === "failed") &&
        t.performanceBenchmark?.metrics,
    )
    .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));

  const previous = previousRuns[0];
  const previousMetrics = previous?.performanceBenchmark?.metrics || null;

  const delta = {};
  if (previousMetrics) {
    for (const key of Object.keys(currentMetrics)) {
      const curr = currentMetrics[key];
      const prev = previousMetrics[key];
      if (typeof curr === "number" && typeof prev === "number") {
        delta[key] = Math.round(curr - prev); // negative = faster/better
      }
    }
  }

  return {
    metrics: currentMetrics,
    previousMetrics,
    delta,
    comparedAgainstTestId: previous?.id || null,
  };
}

module.exports = { benchmarkPerformance };
