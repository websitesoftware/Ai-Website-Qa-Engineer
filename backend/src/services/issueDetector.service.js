
const { v4: uuidv4 } = require("uuid");

// ---------------------------------------------------------------------------
// Issue type taxonomy — the coarse `category` field (broken-link,
// console-error, lighthouse, accessibility, seo, visual-regression,
// cross-browser) is what drives internal logic (fix patterns, locators), but
// it's an implementation detail, not what a QA/dev reads on a ticket. This
// maps to the familiar bug-tracker vocabulary instead: UI, API, Accessibility,
// CSS, Functional, SEO, Performance, Security. Lighthouse in particular
// spans several of these (it audits performance, a11y, SEO, and security
// best-practices all under one "lighthouse" category), so those are
// sub-classified by keyword from the audit's own title/description — no
// guessing, just reading what the audit itself already says it's about.
// ---------------------------------------------------------------------------
const SECURITY_KEYWORDS = /https|vulnerabilit|csp|content security policy|mixed content|clickjack|cross-origin|cve\b|insecure|deprecated api/i;
const ACCESSIBILITY_KEYWORDS = /accessib|aria|contrast|alt text|screen reader|wcag|\bfocus\b|keyboard|tabindex|\blabel\b|discernible/i;
const SEO_KEYWORDS = /\bseo\b|meta description|crawlable|indexable|canonical|structured data|robots\.txt|sitemap|hreflang/i;
const API_KEYWORDS = /\b(api|fetch|xhr|ajax|cors|endpoint)\b|\b4\d{2}\b|\b5\d{2}\b/i;

function classifyIssueType(category, title, description) {
  const text = `${title || ""} ${description || ""}`;
  switch (category) {
    case "accessibility":
      return "Accessibility";
    case "seo":
      return "SEO";
    case "visual-regression":
      return "UI";
    case "broken-link":
    case "cross-browser":
      return "Functional";
    case "console-error":
      return API_KEYWORDS.test(text) ? "API" : "Functional";
    case "lighthouse":
      if (SECURITY_KEYWORDS.test(text)) return "Security";
      if (ACCESSIBILITY_KEYWORDS.test(text)) return "Accessibility";
      if (SEO_KEYWORDS.test(text)) return "SEO";
      return "Performance";
    default:
      return "Functional";
  }
}

function makeIssue({
  category,
  severity,
  title,
  description,
  url,
  suggestion,
  selector,
  snippet,
  sourceLocation,
}) {
  return {
    id: uuidv4(),
    category,
    issueType: classifyIssueType(category, title, description),
    severity,
    title,
    description: description || "",
    url: url || null,
    suggestion: suggestion || null,
    resolved: false,
    detectedAt: new Date().toISOString(),
    // Real, observed locator info (when the scan captured one) — grounds
    // automated fix generation in the actual page/source instead of
    // guessing. Omitted (undefined) rather than fabricated when unknown.
    selector: selector || null,
    snippet: snippet || null,
    sourceLocation: sourceLocation || null,
    // Ticketing: who it's assigned to (team member ids) and its comment
    // thread — both empty until someone acts on the ticket page.
    assigneeIds: [],
    comments: [],
  };
}

function fromBrokenLinks(brokenLinks) {
  return brokenLinks.map((link) =>
    makeIssue({
      category: "broken-link",
      severity:
        link.statusCode === 0
          ? "critical"
          : link.statusCode >= 500
            ? "high"
            : "medium",
      title: `Broken link (${link.statusCode || "timeout"})`,
      description: link.error || `Request returned status ${link.statusCode}`,
      url: link.url,
      suggestion:
        "Fix or remove the link, or update it to a valid destination.",
    }),
  );
}

function fromConsoleErrors(consoleErrors, pageUrl) {
  return consoleErrors.map((e) =>
    makeIssue({
      category: "console-error",
      severity:
        e.type === "pageerror" ? "high" : e.type === "error" ? "high" : "low",
      title: `Console ${e.type}: ${e.text.slice(0, 80)}`,
      description: e.text,
      url: pageUrl,
      suggestion:
        "Check browser devtools console and fix the underlying script error.",
      sourceLocation: e.location?.url ? e.location : null,
    }),
  );
}

function fromLighthouse(failingAudits, pageUrl) {
  return failingAudits.map((audit) => {
    const severity =
      audit.score < 0.5 ? "high" : audit.score < 0.75 ? "medium" : "low";
    return makeIssue({
      category: "lighthouse",
      severity,
      title: audit.title,
      description: audit.description,
      url: pageUrl,
      suggestion: audit.displayValue
        ? `Current value: ${audit.displayValue}`
        : null,
      selector: audit.selector || null,
      snippet: audit.snippet || null,
      sourceLocation: audit.elementUrl ? { url: audit.elementUrl } : null,
    });
  });
}

// ---- Phase 2 issue builders ----

function fromAccessibility(violations, pageUrl) {
  return violations.map((v) => {
    const locator = v.locators?.[0];
    return makeIssue({
      category: "accessibility",
      severity:
        v.impact === "critical"
          ? "critical"
          : v.impact === "serious"
            ? "high"
            : v.impact === "moderate"
              ? "medium"
              : "low",
      title: v.categoryLabel || v.help,
      description: `${v.description} (${v.nodes} element${v.nodes === 1 ? "" : "s"} affected)`,
      url: pageUrl,
      suggestion: v.helpUrl,
      selector: locator?.selector || null,
      snippet: locator?.html || null,
    });
  });
}

function fromSEO(checks, pageUrl) {
  return checks
    .filter((c) => !c.passed)
    .map((c) =>
      makeIssue({
        category: "seo",
        severity: ["title", "meta-description", "h1"].includes(c.id)
          ? "medium"
          : "low",
        title: `SEO: ${c.id.replace(/-/g, " ")}`,
        description: c.message,
        url: pageUrl,
        suggestion: null,
        snippet: c.snippet || null,
      }),
    );
}

function fromVisualRegression(results, pageUrl) {
  return results
    .filter((r) => r.significant)
    .map((r) =>
      makeIssue({
        category: "visual-regression",
        severity: r.diffPercentage > 10 ? "high" : "medium",
        title: `Visual change detected (${r.viewport})`,
        description: `${r.diffPercentage}% of the ${r.viewport} viewport differs from the stored baseline.`,
        url: pageUrl,
        suggestion:
          "Review the diff image and update the baseline if the change is intentional.",
      }),
    );
}

function fromCrossBrowser(results, pageUrl) {
  return results
    .filter((r) => !r.ok)
    .map((r) =>
      makeIssue({
        category: "cross-browser",
        severity: "high",
        title: `Page failed to load in ${r.browser}`,
        description: r.error || `Non-OK response (status ${r.statusCode})`,
        url: pageUrl,
        suggestion: `Test manually in ${r.browser} to confirm the failure.`,
      }),
    );
}

/**
 * Combines everything into one issue list and computes an overall 0-100
 * QA score. Phase 2 arrays are optional so old callers keep working.
 */
function buildIssuesAndScore({
  brokenLinks,
  consoleErrors,
  lighthouseScores,
  failingAudits,
  pageUrl,
  accessibilityViolations = [],
  seoChecks = [],
  visualRegressionResults = [],
  crossBrowserResults = [],
}) {
  const issues = [
    ...fromBrokenLinks(brokenLinks),
    ...fromConsoleErrors(consoleErrors, pageUrl),
    ...fromLighthouse(failingAudits, pageUrl),
    ...fromAccessibility(accessibilityViolations, pageUrl),
    ...fromSEO(seoChecks, pageUrl),
    ...fromVisualRegression(visualRegressionResults, pageUrl),
    ...fromCrossBrowser(crossBrowserResults, pageUrl),
  ];

  // Overall score is the average of the four Lighthouse-style category
  // scores — the same number the combined-score policy grading (see
  // scanEngine.service.js#gradeCombinedScore) is built from, so this and
  // the policy grade never contradict each other on the same report.
  const lhScores = Object.values(lighthouseScores).filter(
    (s) => typeof s === "number",
  );
  const lhAvg = lhScores.length
    ? lhScores.reduce((a, b) => a + b, 0) / lhScores.length
    : 100;

  const score = Math.round(lhAvg);

  return { issues, score };
}

module.exports = { buildIssuesAndScore, makeIssue, classifyIssueType };
