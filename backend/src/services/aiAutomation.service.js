/**
 * AI Automation engine (Phase 3).
 *
 * Turns the REAL output of a completed QA scan (test.issues, console errors,
 * lighthouse scores, etc.) into an actionable automation pipeline:
 *
 *   prioritization -> root cause analysis -> suggested fix -> PR -> CI/CD gate
 *
 * Design principle: everything here is derived from data the scan actually
 * observed. Nothing is fabricated. Where the browser cannot know something
 * (e.g. which source file in a repo we don't own is at fault), we say so and
 * report the location the browser DID observe (script url:line, page + selector).
 *
 * The LLM is optional. If a key is configured it writes tailored fixes and
 * explanations; if not, deterministic rules produce correct, concrete output.
 */

const testsRepo = require("../repositories/tests.repository");
const llm = require("./llm.service");
const github = require("./github.service");
const repoRegistry = require("./repoRegistry.service");
const logger = require("../utils/logger");

// ---------------------------------------------------------------------------
// Severity / category weighting
// ---------------------------------------------------------------------------
const SEVERITY_BASE = { critical: 92, high: 74, medium: 48, low: 22 };
const SEVERITY_LABEL = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

// Functional breakages hurt users more than cosmetic/meta issues.
const CATEGORY_WEIGHT = {
  "broken-link": 8,
  "console-error": 8,
  "cross-browser": 7,
  accessibility: 5,
  lighthouse: 4,
  "visual-regression": 3,
  seo: 2,
};

/**
 * Real priority score 0-100 from a single issue plus how many issues of the
 * same category exist (a category with many hits is a systemic problem).
 */
function scoreIssue(issue, sameCategoryCount) {
  const base = SEVERITY_BASE[issue.severity] ?? 20;
  const catWeight = CATEGORY_WEIGHT[issue.category] ?? 3;
  const spread = Math.min(10, (sameCategoryCount - 1) * 2); // more hits => higher
  return Math.max(0, Math.min(100, Math.round(base + catWeight + spread)));
}

/**
 * Pick the single most important open issue and build the prioritization card.
 * Returns null if the test has no open issues.
 */
function buildPrioritization(test) {
  const open = (test.issues || []).filter((i) => !i.resolved);
  if (!open.length) return null;

  const counts = open.reduce((acc, i) => {
    acc[i.category] = (acc[i.category] || 0) + 1;
    return acc;
  }, {});

  const ranked = open
    .map((i) => ({ issue: i, score: scoreIssue(i, counts[i.category]) }))
    .sort((a, b) => b.score - a.score);

  const top = ranked[0];
  const i = top.issue;

  const criticalCount = open.filter((x) => x.severity === "critical").length;
  const highCount = open.filter((x) => x.severity === "high").length;

  const impactSummary =
    `${open.length} open issue${open.length === 1 ? "" : "s"} on ${test.url} ` +
    `(${criticalCount} critical, ${highCount} high). ` +
    `Top item is a ${i.severity} ${i.category.replace(/-/g, " ")} issue` +
    (counts[i.category] > 1
      ? `, one of ${counts[i.category]} in that category.`
      : ".");

  return {
    bugId: `QA-${i.id.slice(0, 8).toUpperCase()}`,
    issueId: i.id,
    category: i.category,
    title: i.title,
    severity: SEVERITY_LABEL[i.severity] || "Low",
    score: top.score,
    impactSummary,
    // full ranked list so the UI/PR can show more than just the top item
    ranked: ranked.slice(0, 10).map((r) => ({
      id: r.issue.id,
      title: r.issue.title,
      category: r.issue.category,
      severity: SEVERITY_LABEL[r.issue.severity] || "Low",
      score: r.score,
      url: r.issue.url,
    })),
  };
}

// ---------------------------------------------------------------------------
// Root cause analysis — only what the browser actually observed
// ---------------------------------------------------------------------------

/** Find the raw console-error record (with location) that matches an issue. */
function findConsoleRecord(test, issue) {
  const errs = test.consoleErrors || [];
  return (
    errs.find((e) => issue.description && issue.description.includes(e.text)) ||
    null
  );
}

function buildRootCause(test, prioritization) {
  if (!prioritization) return null;
  const issue = (test.issues || []).find(
    (i) => i.id === prioritization.issueId,
  );
  if (!issue) return null;

  let location = issue.url || test.url || "unknown";
  let confidence = 0.55;
  let explanation = issue.description || issue.title;

  switch (issue.category) {
    case "console-error": {
      const rec = findConsoleRecord(test, issue);
      const loc = rec && rec.location;
      if (loc && loc.url) {
        location = `${loc.url}:${loc.lineNumber ?? 0}:${loc.columnNumber ?? 0}`;
        confidence = 0.9; // the browser told us exactly where it threw
      } else {
        confidence = 0.7;
      }
      explanation =
        `A JavaScript ${rec?.type || "error"} fired while loading the page: ` +
        `"${issue.description}". This is the deployed bundle location reported by ` +
        `the browser — map it back to source with your build's source maps.`;
      break;
    }
    case "broken-link": {
      location = issue.url;
      confidence = 0.98; // it's a measured HTTP fact
      explanation =
        `${issue.title}. The request to this URL did not return a healthy ` +
        `response, so any navigation or asset relying on it is broken.`;
      break;
    }
    case "accessibility": {
      confidence = 0.8;
      explanation =
        `${issue.description} Accessibility failures are located on the rendered ` +
        `page (${issue.url}); the linked rule explains which elements violate it.`;
      break;
    }
    case "seo": {
      confidence = 0.85;
      explanation =
        `${issue.description} This is a document-level SEO gap in the <head> / ` +
        `markup of ${issue.url} and is fixable directly in the page template.`;
      break;
    }
    case "lighthouse": {
      confidence = 0.65;
      explanation =
        `${issue.description || issue.title}. ${issue.suggestion || ""} ` +
        `Lighthouse flags this at the page level rather than a single line.`;
      break;
    }
    case "visual-regression":
    case "cross-browser": {
      confidence = 0.75;
      explanation = `${issue.description} Location is the affected page: ${issue.url}.`;
      break;
    }
    default:
      confidence = 0.5;
  }

  return {
    culpritFile: location, // honest: URL / script:line / page, not a fake repo path
    errorLine: 0, // kept for UI compatibility; real line is inside culpritFile when known
    explanation: explanation.trim().replace(/\s+/g, " "),
    confidence: Number(confidence.toFixed(2)),
  };
}

// ---------------------------------------------------------------------------
// Suggested fixes — LLM-tailored when available, deterministic otherwise
// ---------------------------------------------------------------------------

function deterministicFix(issue) {
  switch (issue.category) {
    case "seo":
      if (/meta-description|meta description/i.test(issue.title))
        return {
          original: "<head>\n  <title>...</title>\n</head>",
          patched:
            '<head>\n  <title>...</title>\n  <meta name="description"\n    content="A concise, unique 120-160 character summary of this page." />\n</head>',
        };
      if (/title/i.test(issue.title))
        return {
          original: "<head>\n  <!-- no <title> -->\n</head>",
          patched:
            "<head>\n  <title>Clear, unique page title (50-60 chars)</title>\n</head>",
        };
      if (/h1/i.test(issue.title))
        return {
          original: "<body>\n  <!-- no single <h1> -->\n</body>",
          patched:
            "<body>\n  <h1>One descriptive H1 that states the page's purpose</h1>\n</body>",
        };
      return {
        original: "<!-- SEO gap: " + issue.title + " -->",
        patched:
          "<!-- " +
          (issue.suggestion ||
            issue.description ||
            "Address the SEO check above.") +
          " -->",
      };

    case "accessibility":
      return {
        original: '<img src="banner.png">',
        patched:
          '<img src="banner.png" alt="Describe the image\'s content or purpose">\n' +
          "<!-- Rule details: " +
          (issue.suggestion || "see WCAG reference") +
          " -->",
      };

    case "broken-link":
      return {
        original: `<a href="${issue.url}">link</a>`,
        patched:
          `<!-- ${issue.title} -->\n` +
          `<!-- Replace with a valid destination, or remove the link. -->\n` +
          `<a href="/correct-destination">link</a>`,
      };

    case "console-error":
      return {
        original:
          "// Uncaught error at runtime:\n// " +
          (issue.description || issue.title),
        patched:
          "// Guard the failing call and handle the error path:\n" +
          "try {\n  // ...the operation that threw...\n} catch (err) {\n" +
          "  console.error('Handled:', err);\n  // graceful fallback\n}",
      };

    case "lighthouse":
      return {
        original: "// Lighthouse: " + issue.title,
        patched:
          "// Remediation: " +
          (issue.suggestion ||
            issue.description ||
            "Follow the Lighthouse guidance for this audit."),
      };

    default:
      return {
        original: "// Issue: " + issue.title,
        patched:
          "// Suggested action: " +
          (issue.suggestion || issue.description || "Investigate and resolve."),
      };
  }
}

async function buildFixes(test, prioritization) {
  if (!prioritization) return null;
  const issue = (test.issues || []).find(
    (i) => i.id === prioritization.issueId,
  );
  if (!issue) return null;

  const fallback = deterministicFix(issue);

  if (!llm.isEnabled()) {
    return { ...fallback, source: "rules" };
  }

  const json = await llm.completeJSON({
    system:
      "You are a senior web QA engineer. Given a single real, browser-detected " +
      "website issue, output a concrete remediation. Return ONLY JSON with keys " +
      '"original" (the problematic markup/code as it likely appears) and ' +
      '"patched" (the corrected version). Keep each under 15 lines. Do not invent ' +
      "framework-specific file paths you cannot know.",
    prompt: JSON.stringify({
      url: issue.url || test.url,
      category: issue.category,
      severity: issue.severity,
      title: issue.title,
      description: issue.description,
      suggestion: issue.suggestion,
    }),
    maxTokens: 500,
    temperature: 0.2,
  });

  if (
    json &&
    typeof json.original === "string" &&
    typeof json.patched === "string"
  ) {
    return {
      original: json.original,
      patched: json.patched,
      source: llm.providerName(),
    };
  }
  return { ...fallback, source: "rules" };
}

// ---------------------------------------------------------------------------
// CI/CD gate — a real validation summary of the actual scan
// ---------------------------------------------------------------------------
function buildCicdSummary(test) {
  const open = (test.issues || []).filter((i) => !i.resolved);
  const blocking = open.filter(
    (i) => i.severity === "critical" || i.severity === "high",
  );
  const passed = blocking.length === 0;

  const s = test.scores || {};
  const fmt = (v) => (typeof v === "number" ? `${v}/100` : "n/a");

  const logs = [
    `[INFO] Validation target: ${test.url}`,
    `[INFO] Pages scanned: ${test.pagesScanned ?? 0}`,
    `[INFO] Overall QA score: ${test.score ?? "n/a"}/100`,
    `[INFO] Lighthouse — perf ${fmt(s.performance)}, a11y ${fmt(s.accessibility)}, seo ${fmt(s.seo)}, best-practices ${fmt(s.bestPractices)}`,
    `[RUNNING] Evaluating quality gate (block on critical/high)...`,
    `[INFO] Open issues: ${open.length} (blocking: ${blocking.length})`,
    passed
      ? `[SUCCESS] Quality gate passed — no critical or high issues.`
      : `[FAILED] Quality gate failed — ${blocking.length} blocking issue${blocking.length === 1 ? "" : "s"} must be resolved.`,
  ];

  return { status: passed ? "Passed" : "Failed", passed, logs };
}

// ---------------------------------------------------------------------------
// PR body / remediation report (used for the real GitHub PR)
// ---------------------------------------------------------------------------
function buildReportMarkdown(test, automation) {
  const p = automation.prioritization;
  const lines = [];
  lines.push(`# QA Remediation Report`);
  lines.push("");
  lines.push(`**Target:** ${test.url}`);
  lines.push(`**Scan ID:** ${test.id}`);
  lines.push(`**Overall score:** ${test.score ?? "n/a"}/100`);
  lines.push(`**Generated:** ${new Date().toISOString()}`);
  lines.push("");
  if (p) {
    lines.push(`## Top priority: ${p.title}`);
    lines.push(
      `- **Severity:** ${p.severity}  |  **Priority score:** ${p.score}/100`,
    );
    lines.push(`- **Impact:** ${p.impactSummary}`);
    if (automation.rca) {
      lines.push(`- **Observed location:** \`${automation.rca.culpritFile}\``);
      lines.push(`- **Analysis:** ${automation.rca.explanation}`);
    }
    if (automation.fixes) {
      lines.push("");
      lines.push("### Suggested fix");
      lines.push("```diff");
      lines.push("- " + automation.fixes.original.split("\n").join("\n- "));
      lines.push("+ " + automation.fixes.patched.split("\n").join("\n+ "));
      lines.push("```");
    }
    lines.push("");
    lines.push("## All prioritized issues");
    lines.push("| # | Severity | Category | Score | Issue | URL |");
    lines.push("|---|----------|----------|-------|-------|-----|");
    p.ranked.forEach((r, idx) => {
      lines.push(
        `| ${idx + 1} | ${r.severity} | ${r.category} | ${r.score} | ${String(r.title).replace(/\|/g, "\\|")} | ${r.url || "-"} |`,
      );
    });
  } else {
    lines.push(
      `No open issues were found in this scan. Nothing to remediate. ✅`,
    );
  }
  return lines.join("\n");
}

/**
 * Build the same prioritization-card shape as buildPrioritization(), but for
 * one already-known issue instead of picking the top-ranked one. Used by the
 * paste-an-issue flow, where the caller already knows exactly which issue.
 */
function buildPrioritizationForIssue(test, issue) {
  const open = (test.issues || []).filter((i) => !i.resolved);
  const counts = open.reduce((acc, i) => {
    acc[i.category] = (acc[i.category] || 0) + 1;
    return acc;
  }, {});
  const sameCategoryCount = counts[issue.category] || 1;
  const score = scoreIssue(issue, sameCategoryCount);

  const impactSummary =
    `A ${issue.severity} ${issue.category.replace(/-/g, " ")} issue on ${issue.url || test.url}.` +
    (sameCategoryCount > 1 ? ` One of ${sameCategoryCount} in that category.` : "");

  return {
    bugId: `QA-${issue.id.replace(/[^a-z0-9]/gi, "").slice(0, 8).toUpperCase() || "PASTED"}`,
    issueId: issue.id,
    category: issue.category,
    title: issue.title,
    severity: SEVERITY_LABEL[issue.severity] || "Medium",
    score,
    impactSummary,
    ranked: [
      {
        id: issue.id,
        title: issue.title,
        category: issue.category,
        severity: SEVERITY_LABEL[issue.severity] || "Medium",
        score,
        url: issue.url,
      },
    ],
  };
}

/**
 * Recover a real, already-scanned issue from a "Copy Issue" clipboard payload
 * (see IssuesPage.tsx handleCopyForAutomation) — it embeds the exact
 * testId/issueId, so this looks the real issue up rather than re-parsing
 * free text. Falls back to best-effort free-text parsing (URL/severity/title/
 * category/analysis/suggestion lines) for hand-edited or externally-sourced
 * paste content, so the feature still works if the marker is missing.
 */
function parsePastedIssue(pastedText) {
  const text = String(pastedText || "");

  const refMatch = text.match(/testId=(\S+)\s+issueId=(\S+)/i);
  if (refMatch) {
    const test = testsRepo.get(refMatch[1]);
    const issue = test?.issues.find((i) => i.id === refMatch[2]);
    if (test && issue) return { test, issue, source: "linked" };
  }

  const urlMatch = text.match(/URL:\s*(\S+)/i);
  if (!urlMatch) return null; // nothing to target a repo/PR with

  const severityMatch = text.match(/^\s*\[?(critical|high|medium|low)\]?/im);
  const categoryMatch = text.match(/Category:\s*(.+)/i);
  const analysisMatch = text.match(
    /Analysis:\s*([\s\S]*?)(?:\n\s*\n\s*(?:Suggestion|Code Fix Snippet):|$)/i,
  );
  const suggestionMatch = text.match(
    /Suggestion:\s*([\s\S]*?)(?:\n\s*\n\s*Code Fix Snippet:|$)/i,
  );
  const firstLine = text.split("\n")[0] || "";
  const title =
    firstLine.replace(/^\s*(\[[^\]]*\]\s*)+/, "").trim() || "Pasted issue";

  const issue = {
    id: `pasted-${Date.now()}`,
    category: (categoryMatch?.[1] || "other").trim().toLowerCase().replace(/\s+/g, "-"),
    severity: (severityMatch?.[1] || "medium").toLowerCase(),
    title,
    description: (analysisMatch?.[1] || "").trim() || title,
    suggestion: suggestionMatch?.[1]?.trim() || null,
    url: urlMatch[1],
    resolved: false,
  };
  const test = { id: null, url: issue.url, issues: [issue], consoleErrors: [], score: null };
  return { test, issue, source: "pasted" };
}

/**
 * The paste-box "Analyze" action: recover the issue, run the same
 * prioritize -> RCA -> fix pipeline as a real scan, auto-detect which local
 * repo the issue's URL belongs to, and open a real PR in one step.
 */
async function analyzePastedIssue(pastedText) {
  const parsed = parsePastedIssue(pastedText);
  if (!parsed) {
    return { ready: false, reason: "could_not_parse" };
  }
  const { test, issue, source } = parsed;

  const prioritization = buildPrioritizationForIssue(test, issue);
  const rca = buildRootCause(test, prioritization);
  const fixes = await buildFixes(test, prioritization);
  const match = repoRegistry.matchRepoForUrl(issue.url);
  const repoMatch = { name: match.name, path: match.path, matchedBy: match.matchedBy };

  const result = {
    ready: true,
    source, // "linked" (real scan data) | "pasted" (free-text fallback)
    url: issue.url,
    generatedAt: new Date().toISOString(),
    llm: { enabled: llm.isEnabled(), provider: llm.providerName() },
    github: {
      configured: github.isConfigured(),
      repo: match.githubRepo || null,
      repoName: match.name,
      matchedBy: match.matchedBy,
    },
    prioritization,
    rca,
    fixes,
    pullRequest: null,
  };

  if (!github.isConfigured()) {
    result.pullRequest = { configured: false, reason: "github_not_configured" };
    return result;
  }
  if (!match.githubRepo) {
    result.pullRequest = {
      configured: true,
      error: describeRepoMatchFailure(match, issue.url),
      repoMatch,
    };
    return result;
  }

  const short = issue.id.replace(/[^a-z0-9]/gi, "").slice(0, 8) || "issue";
  const branchName = `ai-qa/paste-${short}`;
  const filePath = `qa-reports/paste-${short}.md`;
  const prTitle = `fix(qa): ${prioritization.title} (QA-${short.toUpperCase()})`;
  const markdown = buildReportMarkdown(test, { prioritization, rca, fixes });

  try {
    const pr = await github.openRemediationPR({
      branchName,
      filePath,
      fileContent: markdown,
      prTitle,
      prBody: markdown,
      repo: match.githubRepo,
    });
    logger.success(
      "aiAutomation",
      `Opened PR ${pr.prUrl} from pasted issue (repo: ${match.githubRepo}, matched by ${match.matchedBy})`,
    );
    result.pullRequest = { configured: true, ...pr, repo: match.githubRepo, repoMatch };
  } catch (err) {
    logger.error("aiAutomation", `PR creation from pasted issue failed: ${err.message}`);
    result.pullRequest = { configured: true, error: err.message, repoMatch };
  }

  return result;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Most recent completed (passed/failed) test, or null. */
function latestCompletedTest() {
  const tests = testsRepo.list();
  return (
    tests.find((t) => t.status === "passed" || t.status === "failed") || null
  );
}

/**
 * Run the full analysis pipeline (prioritize -> RCA -> fix -> CI gate) against
 * a completed test. Does NOT open a PR (that's an explicit, separate action).
 */
async function runAutomation(testId) {
  const test = testId ? testsRepo.get(testId) : latestCompletedTest();
  if (!test) {
    return { ready: false, reason: "no_completed_test" };
  }
  if (test.status !== "passed" && test.status !== "failed") {
    return {
      ready: false,
      reason: "test_not_complete",
      status: test.status,
      testId: test.id,
    };
  }

  const prioritization = buildPrioritization(test);
  const rca = buildRootCause(test, prioritization);
  const fixes = await buildFixes(test, prioritization);
  const cicd = buildCicdSummary(test);
  const repoMatch = repoRegistry.matchRepoForUrl(test.url);

  return {
    ready: true,
    testId: test.id,
    url: test.url,
    generatedAt: new Date().toISOString(),
    llm: { enabled: llm.isEnabled(), provider: llm.providerName() },
    github: {
      configured: github.isConfigured(),
      repo: repoMatch.githubRepo || null,
      repoName: repoMatch.name,
      matchedBy: repoMatch.matchedBy, // "hostname" | "live-port" | "url-path" | "port" | "unmatched" | "ambiguous_*"
    },
    prioritization,
    rca,
    fixes,
    cicd,
    pullRequest: null, // filled only when the user explicitly triggers PR creation
  };
}

/**
 * A human-readable reason `match.githubRepo` is missing — either no repo
 * could be identified at all, or one was but it has no GitHub remote.
 */
function describeRepoMatchFailure(match, url) {
  if (match.matchedBy === "ambiguous_hostname" || match.matchedBy === "ambiguous_port") {
    return (
      `Multiple local repos matched ${url} (${match.matchedBy.replace("ambiguous_", "")} ` +
      `collision) — can't safely pick one. Set a unique SITE_URL/dev port per repo, or ` +
      `narrow REPO_SCAN_ROOT.`
    );
  }
  if (match.name) {
    return `Matched local repo "${match.name}" (${match.path}) has no GitHub remote configured.`;
  }
  return (
    `Could not determine which local repo ${url} belongs to. Open its project folder in ` +
    `VS Code (or place it under the scan root), and make sure it declares its site URL ` +
    `(package.json "homepage", or a SITE_URL/APP_URL .env key) or dev-server port.`
  );
}

/**
 * Open a real PR on the configured GitHub repo containing the remediation
 * report for a test. Returns { configured:false } if GitHub isn't set up.
 */
async function createPullRequest(testId) {
  if (!github.isConfigured()) {
    return { configured: false, reason: "github_not_configured" };
  }
  const test = testId ? testsRepo.get(testId) : latestCompletedTest();
  if (!test) return { configured: true, error: "no_completed_test" };

  // Figure out which local repo the scanned URL actually belongs to — not
  // always this QA engine's own repo — so the PR lands in the right project.
  const match = repoRegistry.matchRepoForUrl(test.url);
  const repoMatch = { name: match.name, path: match.path, matchedBy: match.matchedBy };
  if (!match.githubRepo) {
    return {
      configured: true,
      error: describeRepoMatchFailure(match, test.url),
      repoMatch,
    };
  }

  const automation = await runAutomation(test.id);
  const short = test.id.slice(0, 8);
  const branchName = `ai-qa/fix-${short}`;
  const filePath = `qa-reports/${short}.md`;
  const prTitle = automation.prioritization
    ? `fix(qa): ${automation.prioritization.title} (QA-${short.toUpperCase()})`
    : `chore(qa): QA report for ${short}`;
  const markdown = buildReportMarkdown(test, automation);

  try {
    const pr = await github.openRemediationPR({
      branchName,
      filePath,
      fileContent: markdown,
      prTitle,
      prBody: markdown,
      repo: match.githubRepo,
    });
    logger.success(
      "aiAutomation",
      `Opened PR ${pr.prUrl} (repo: ${match.githubRepo}, matched by ${match.matchedBy})`,
    );
    return { configured: true, ...pr, repo: match.githubRepo, repoMatch };
  } catch (err) {
    logger.error("aiAutomation", `PR creation failed: ${err.message}`);
    return { configured: true, error: err.message, repoMatch };
  }
}

/**
 * Run the CI/CD gate. If a GitHub Actions workflow is configured, dispatch it
 * and return the real run reference alongside the scan-derived gate summary.
 */
async function runCicd(testId) {
  const test = testId ? testsRepo.get(testId) : latestCompletedTest();
  if (!test)
    return { status: "Idle", logs: ["[INFO] No completed scan to validate."] };

  const summary = buildCicdSummary(test);

  if (github.isConfigured() && require("../config/config").github.workflow) {
    const match = repoRegistry.matchRepoForUrl(test.url);
    if (!match.githubRepo) {
      summary.logs.push(
        `[INFO] GitHub Actions dispatch skipped: ${describeRepoMatchFailure(match, test.url)}`,
      );
    } else {
      try {
        const run = await github.dispatchWorkflow(
          { target_url: test.url },
          match.githubRepo,
        );
        if (run) {
          summary.logs.push(
            `[INFO] Dispatched GitHub Actions run on ${match.githubRepo}: ${run.url}`,
          );
          summary.workflowRun = run;
        }
      } catch (err) {
        summary.logs.push(
          `[INFO] GitHub Actions dispatch skipped: ${err.message}`,
        );
      }
    }
  }

  return summary;
}

/**
 * Merge a PR opened by this engine, but only if it has been approved.
 * This is the free-plan-safe replacement for GitHub's native branch
 * protection ("Merge cannot proceed" without an approval) — see
 * github.service.js#getReviewDecision.
 */
async function mergePullRequest(prNumber, repo) {
  if (!github.isConfigured()) {
    return { configured: false, reason: "github_not_configured" };
  }
  const decision = await github.getReviewDecision(prNumber, repo);
  if (!decision.approved) {
    return {
      configured: true,
      merged: false,
      reason: decision.changesRequestedCount > 0
        ? "changes_requested"
        : "awaiting_approval",
      ...decision,
    };
  }
  const result = await github.mergePullRequest(prNumber, repo);
  logger.success("aiAutomation", `Merged PR #${prNumber} (${result.sha})`);
  return { configured: true, ...result, ...decision };
}

module.exports = {
  runAutomation,
  createPullRequest,
  runCicd,
  latestCompletedTest,
  mergePullRequest,
  analyzePastedIssue,
};
