const testsRepo = require("../repositories/tests.repository");

function getStats(req, res) {
  const tests = testsRepo.list();

  const total = tests.length;
  const passed = tests.filter((t) => t.status === "passed").length;
  const failed = tests.filter((t) => t.status === "failed").length;
  const running = tests.filter((t) => t.status === "running" || t.status === "queued").length;

  const completed = tests.filter((t) => t.score !== null);
  const avgScore = completed.length
    ? Math.round(completed.reduce((sum, t) => sum + t.score, 0) / completed.length)
    : null;

  const allIssues = tests.flatMap((t) => t.issues || []);
  const unresolvedIssues = allIssues.filter((i) => !i.resolved);
  const issuesBySeverity = {
    critical: unresolvedIssues.filter((i) => i.severity === "critical").length,
    high: unresolvedIssues.filter((i) => i.severity === "high").length,
    medium: unresolvedIssues.filter((i) => i.severity === "medium").length,
    low: unresolvedIssues.filter((i) => i.severity === "low").length,
  };

  res.json({
    total,
    passed,
    failed,
    running,
    avgScore,
    totalIssues: allIssues.length,
    unresolvedIssues: unresolvedIssues.length,
    issuesBySeverity,
  });
}

module.exports = { getStats };
