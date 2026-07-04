const { v4: uuidv4 } = require("uuid");

function makeIssue({ category, severity, title, description, url, suggestion }) {
  return {
    id: uuidv4(),
    category, // broken-link | console-error | performance | accessibility | seo | best-practices
    severity, // critical | high | medium | low
    title,
    description: description || "",
    url: url || null,
    suggestion: suggestion || null,
    resolved: false,
    detectedAt: new Date().toISOString(),
  };
}

function fromBrokenLinks(brokenLinks) {
  return brokenLinks.map((link) =>
    makeIssue({
      category: "broken-link",
      severity: link.statusCode === 0 ? "critical" : link.statusCode >= 500 ? "high" : "medium",
      title: `Broken link (${link.statusCode || "timeout"})`,
      description: link.error || `Request returned status ${link.statusCode}`,
      url: link.url,
      suggestion: "Fix or remove the link, or update it to a valid destination.",
    })
  );
}

function fromConsoleErrors(consoleErrors, pageUrl) {
  return consoleErrors.map((e) =>
    makeIssue({
      category: "console-error",
      severity: e.type === "pageerror" ? "high" : e.type === "error" ? "high" : "low",
      title: `Console ${e.type}: ${e.text.slice(0, 80)}`,
      description: e.text,
      url: pageUrl,
      suggestion: "Check browser devtools console and fix the underlying script error.",
    })
  );
}

function fromLighthouse(failingAudits, pageUrl) {
  return failingAudits.map((audit) => {
    const severity = audit.score < 0.5 ? "high" : audit.score < 0.75 ? "medium" : "low";
    return makeIssue({
      category: "lighthouse",
      severity,
      title: audit.title,
      description: audit.description,
      url: pageUrl,
      suggestion: audit.displayValue ? `Current value: ${audit.displayValue}` : null,
    });
  });
}

/**
 * Combines everything into one issue list and computes an overall 0-100
 * QA score (used by StatCard / TestsTable on the frontend).
 */
function buildIssuesAndScore({ brokenLinks, consoleErrors, lighthouseScores, failingAudits, pageUrl }) {
  const issues = [
    ...fromBrokenLinks(brokenLinks),
    ...fromConsoleErrors(consoleErrors, pageUrl),
    ...fromLighthouse(failingAudits, pageUrl),
  ];

  const weights = { critical: 10, high: 6, medium: 3, low: 1 };
  const penalty = issues.reduce((sum, i) => sum + (weights[i.severity] || 0), 0);

  const lhScores = Object.values(lighthouseScores).filter((s) => typeof s === "number");
  const lhAvg = lhScores.length ? lhScores.reduce((a, b) => a + b, 0) / lhScores.length : 100;

  const score = Math.max(0, Math.round(lhAvg - penalty));

  return { issues, score };
}

module.exports = { buildIssuesAndScore, makeIssue };
