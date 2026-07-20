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
const fileLocator = require("./fileLocator.service");
const logger = require("../utils/logger");

function normalizeWhitespace(str) {
  return String(str || "")
    .replace(/\s+/g, " ")
    .trim();
}

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
        original:
          '<img src="banner.png" alt="Describe the image\'s content or purpose">',
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

/**
 * Deterministic transform applied directly to a REAL snippet read from the
 * matched repo's source file. Only returns autoFixable:true for the narrow
 * set of cases we can safely patch without knowing the app's intent (a
 * missing attribute/tag) — never for things like "what should this broken
 * link actually point to" or "what should this script do instead."
 */
function buildGroundedPatch(issue, located) {
  const original = located.original;

  if (issue.category === "accessibility" || /image-alt/i.test(issue.title)) {
    if (/<img\b/i.test(original) && !/\balt\s*=/i.test(original)) {
      const patched = original.replace(
        /<img\b([^>]*?)(\/?)>/i,
        (_m, attrs, selfClose) =>
          `<img${attrs} alt="Describe this image's content or purpose"${selfClose ? " /" : ""}>`,
      );
      if (patched !== original) return { patched, autoFixable: true };
    }
  }

  if (issue.category === "seo") {
    if (/title/i.test(issue.title) && !/<title>/i.test(original)) {
      const patched = original.replace(
        /(<head[^>]*>)/i,
        `$1\n  <title>Add a clear, unique page title (50-60 characters)</title>`,
      );
      if (patched !== original) return { patched, autoFixable: true };
    }
    if (
      /meta description/i.test(issue.title) &&
      !/name=["']description["']/i.test(original)
    ) {
      const patched = original.replace(
        /(<\/head>)/i,
        `  <meta name="description" content="A concise, unique summary of this page (120-160 characters)." />\n$1`,
      );
      if (patched !== original) return { patched, autoFixable: true };
    }
    if (/\bh1\b/i.test(issue.title) && !/<h1[\s>]/i.test(original)) {
      const patched = original.replace(
        /(<body[^>]*>)/i,
        `$1\n  <h1>Page heading — replace with a concise, descriptive title</h1>`,
      );
      if (patched !== original) return { patched, autoFixable: true };
    }
  }

  return { patched: original, autoFixable: false };
}

async function buildFixes(test, prioritization, repoMatch) {
  if (!prioritization) return null;
  const issue = (test.issues || []).find(
    (i) => i.id === prioritization.issueId,
  );
  if (!issue) return null;

  const located = repoMatch?.path
    ? fileLocator.locate(repoMatch.path, issue)
    : null;

  if (located) {
    const grounded = buildGroundedPatch(issue, located);
    let patched = grounded.patched;
    let source = "rules";

    if (llm.isEnabled()) {
      const json = await llm.completeJSON({
        system:
          "You are a senior web QA engineer. You are given the EXACT real snippet " +
          "from the target repository's source file. Echo it back verbatim as " +
          '"original", and return a minimal "patched" version that fixes ONLY the ' +
          "described issue — do not alter unrelated code, formatting, or " +
          'surrounding markup. Return ONLY JSON with keys "original" and "patched".',
        prompt: JSON.stringify({
          filePath: located.relPath,
          url: issue.url || test.url,
          category: issue.category,
          severity: issue.severity,
          title: issue.title,
          description: issue.description,
          original: located.original,
        }),
        maxTokens: 600,
        temperature: 0.1,
      });
      if (
        json &&
        typeof json.original === "string" &&
        typeof json.patched === "string" &&
        normalizeWhitespace(json.original) ===
          normalizeWhitespace(located.original)
      ) {
        patched = json.patched;
        source = llm.providerName();
      }
      // else: grounding check failed (LLM didn't echo the real snippet back
      // exactly) — discard its output and keep the deterministic patch above
      // rather than risk applying a fabricated diff to a real file.
    }

    return {
      original: located.original,
      patched,
      filePath: located.relPath,
      fileFullPath: located.absPath,
      line: located.line,
      grounded: true,
      autoFixable: Boolean(
        grounded.autoFixable && patched !== located.original,
      ),
      source,
    };
  }

  // No confident match in the matched repo (or no repo matched at all) —
  // keep the best-effort guess, but say so honestly rather than presenting
  // it as a verified fix.
  const fallback = deterministicFix(issue);

  if (!llm.isEnabled()) {
    return {
      ...fallback,
      grounded: false,
      autoFixable: false,
      source: "rules",
    };
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
      grounded: false,
      autoFixable: false,
      source: llm.providerName(),
    };
  }
  return { ...fallback, grounded: false, autoFixable: false, source: "rules" };
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
// PR description (metadata on the PR itself — never a file committed into
// the repo). Only ever called once we already have a real, grounded,
// auto-fixable patch — so it always has a genuine diff, never a guess.
// ---------------------------------------------------------------------------
function buildPrBody(prioritization, fixes) {
  const lines = [];
  lines.push(`## ${prioritization.title} — \`${fixes.filePath}\``);
  lines.push(
    `**Severity:** ${prioritization.severity}  |  **Priority score:** ${prioritization.score}/100`,
  );
  lines.push("");
  lines.push("```diff");
  lines.push("- " + fixes.original.split("\n").join("\n- "));
  lines.push("+ " + fixes.patched.split("\n").join("\n+ "));
  lines.push("```");
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
    (sameCategoryCount > 1
      ? ` One of ${sameCategoryCount} in that category.`
      : "");

  return {
    bugId: `QA-${
      issue.id
        .replace(/[^a-z0-9]/gi, "")
        .slice(0, 8)
        .toUpperCase() || "PASTED"
    }`,
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
    category: (categoryMatch?.[1] || "other")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-"),
    severity: (severityMatch?.[1] || "medium").toLowerCase(),
    title,
    description: (analysisMatch?.[1] || "").trim() || title,
    suggestion: suggestionMatch?.[1]?.trim() || null,
    url: urlMatch[1],
    resolved: false,
  };
  const test = {
    id: null,
    url: issue.url,
    issues: [issue],
    consoleErrors: [],
    score: null,
  };
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
  const match = repoRegistry.matchRepoForUrl(issue.url);
  const repoMatch = {
    name: match.name,
    path: match.path,
    matchedBy: match.matchedBy,
  };
  const fixes = await buildFixes(test, prioritization, match);

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

  const canPatchRealFile = Boolean(
    fixes?.grounded && fixes?.autoFixable && fixes?.filePath,
  );
  if (!canPatchRealFile) {
    result.pullRequest = {
      configured: true,
      noCodeChange: true,
      error:
        "No auto-fixable code change was found for this issue in the matched repo — " +
        "nothing real to open a PR for.",
      repoMatch,
    };
    return result;
  }

  const short = issue.id.replace(/[^a-z0-9]/gi, "").slice(0, 8) || "issue";
  const branchName = `ai-qa/paste-${short}`;
  const prTitle = `fix(qa): ${prioritization.title} (QA-${short.toUpperCase()})`;
  const prBody = buildPrBody(prioritization, fixes);

  try {
    const pr = await github.applyRemediation({
      branchName,
      prTitle,
      prBody,
      repo: match.githubRepo,
      filePatch: {
        path: fixes.filePath,
        original: fixes.original,
        patched: fixes.patched,
      },
    });
    logger.success(
      "aiAutomation",
      `Opened PR ${pr.prUrl} from pasted issue (repo: ${match.githubRepo}, matched by ${match.matchedBy}, patched ${fixes.filePath})`,
    );
    // Only persist appliedFix for real, previously-scanned issues (source ===
    // "linked") — the free-text "pasted" fallback has a synthetic test.id
    // (null) with nothing in testsRepo to attach it to.
    if (source === "linked") {
      await recordAppliedFix(test, issue.id, {
        fixes,
        pr,
        repo: match.githubRepo,
      });
    }
    result.pullRequest = {
      configured: true,
      ...pr,
      repo: match.githubRepo,
      repoMatch,
    };
  } catch (err) {
    logger.error(
      "aiAutomation",
      `PR creation from pasted issue failed: ${err.message}`,
    );
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
  const repoMatch = repoRegistry.matchRepoForUrl(test.url);
  const fixes = await buildFixes(test, prioritization, repoMatch);
  const cicd = buildCicdSummary(test);

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
  if (
    match.matchedBy === "ambiguous_hostname" ||
    match.matchedBy === "ambiguous_port"
  ) {
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
 * Open a real PR on the configured GitHub repo that patches the actual
 * source file for the top-priority issue. Returns { configured:false } if
 * GitHub isn't set up, and refuses to open a PR at all — rather than a
 * hollow "report" one — when no auto-fixable code change was found.
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
  const repoMatch = {
    name: match.name,
    path: match.path,
    matchedBy: match.matchedBy,
  };
  if (!match.githubRepo) {
    return {
      configured: true,
      error: describeRepoMatchFailure(match, test.url),
      repoMatch,
    };
  }

  const automation = await runAutomation(test.id);
  const fixes = automation.fixes;
  const canPatchRealFile = Boolean(
    automation.prioritization &&
    fixes?.grounded &&
    fixes?.autoFixable &&
    fixes?.filePath,
  );
  if (!canPatchRealFile) {
    return {
      configured: true,
      noCodeChange: true,
      error:
        "No auto-fixable code change was found for the top-priority issue in the matched " +
        "repo — nothing real to open a PR for.",
      repoMatch,
    };
  }

  const short = test.id.slice(0, 8);
  const branchName = `ai-qa/fix-${short}`;
  const prTitle = `fix(qa): ${automation.prioritization.title} (QA-${short.toUpperCase()})`;
  const prBody = buildPrBody(automation.prioritization, fixes);

  try {
    const pr = await github.applyRemediation({
      branchName,
      prTitle,
      prBody,
      repo: match.githubRepo,
      filePatch: {
        path: fixes.filePath,
        original: fixes.original,
        patched: fixes.patched,
      },
    });
    logger.success(
      "aiAutomation",
      `Opened PR ${pr.prUrl} (repo: ${match.githubRepo}, matched by ${match.matchedBy}, patched ${fixes.filePath})`,
    );
    await recordAppliedFix(test, automation.prioritization.issueId, {
      fixes,
      pr,
      repo: match.githubRepo,
    });
    return { configured: true, ...pr, repo: match.githubRepo, repoMatch };
  } catch (err) {
    logger.error("aiAutomation", `PR creation failed: ${err.message}`);
    return { configured: true, error: err.message, repoMatch };
  }
}

/**
 * Persist the real patch that was actually applied in a PR onto the issue
 * record, so the UI can show the real fixed code instead of a generic
 * template, and so mergePullRequest() can later find this issue again by
 * prNumber/repo to auto-mark it resolved on a real merge. Only ever called
 * after a successful github.applyRemediation() — i.e. a real file patch.
 */
async function recordAppliedFix(test, issueId, { fixes, pr, repo }) {
  if (!test?.id || !fixes) return;
  const issue = (test.issues || []).find((i) => i.id === issueId);
  if (!issue) return;
  issue.appliedFix = {
    filePath: fixes.filePath,
    original: fixes.original,
    patched: fixes.patched,
    grounded: true,
    autoFixable: true,
    repo,
    prNumber: pr.prNumber,
    prUrl: pr.prUrl,
    branchName: pr.branchName,
    appliedAt: new Date().toISOString(),
    mergedAt: null,
  };
  await testsRepo.update(test.id, { issues: test.issues });
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
      reason:
        decision.changesRequestedCount > 0
          ? "changes_requested"
          : "awaiting_approval",
      ...decision,
    };
  }
  const result = await github.mergePullRequest(prNumber, repo);
  logger.success("aiAutomation", `Merged PR #${prNumber} (${result.sha})`);
  if (result.merged) {
    await markIssueResolvedByMerge(prNumber, repo);
  }
  return { configured: true, ...result, ...decision };
}

/**
 * A merged PR is a real, verifiable signal that a fix landed — so unlike the
 * manual "Mark As Fixed" toggle, this can safely auto-resolve the issue it
 * came from. Finds the issue across all tests by the prNumber/repo recorded
 * in recordAppliedFix() and flips it, keeping the applied diff attached so
 * the UI can show exactly what fixed it.
 */
async function markIssueResolvedByMerge(prNumber, repo) {
  for (const test of testsRepo.list()) {
    const issue = (test.issues || []).find(
      (i) => i.appliedFix?.prNumber === prNumber && i.appliedFix?.repo === repo,
    );
    if (!issue) continue;
    issue.resolved = true;
    issue.appliedFix.mergedAt = new Date().toISOString();
    await testsRepo.update(test.id, { issues: test.issues });
    logger.success(
      "aiAutomation",
      `Auto-resolved issue ${issue.id} on merge of PR #${prNumber} (${repo})`,
    );
    return;
  }
}

module.exports = {
  runAutomation,
  createPullRequest,
  runCicd,
  latestCompletedTest,
  mergePullRequest,
  analyzePastedIssue,
};
