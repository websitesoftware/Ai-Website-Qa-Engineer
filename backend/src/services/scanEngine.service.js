

const fs = require("fs");
const path = require("path");
const config = require("../config/config");
const logger = require("../utils/logger");
const testsRepo = require("../repositories/tests.repository");
const policiesRepo = require("../repositories/policies.repository");
const { getBrowser } = require("./browser.service");
const { crawlSite } = require("./crawler.service");
const { checkLinks } = require("./linkChecker.service");
const { captureResponsiveScreenshots } = require("./responsive.service");
const { detectConsoleErrors } = require("./consoleError.service");
const { runLighthouseAudit } = require("./lighthouse.service");
const { runAccessibilityAudit } = require("./accessibility.service");
const { auditSEO } = require("./seo.service");
const { runVisualRegression } = require("./visualRegression.service");
const { runCrossBrowserCheck } = require("./crossBrowser.service");
const { benchmarkPerformance } = require("./performanceBenchmark.service");
const { buildIssuesAndScore } = require("./issueDetector.service");

const REPORTS_DIR = path.join(__dirname, "..", "..", config.storage.reportsDir);

async function updateStage(testId, stage, progress) {
  await testsRepo.update(testId, { currentStage: stage, progress });
}

const SEVERITY_RANK = { critical: 3, high: 2, medium: 1, low: 0 };

function evaluatePolicy(policy, { score, scores, issues }) {
  const violations = [];

  Object.entries(policy.thresholds).forEach(([key, min]) => {
    if (min === null || min === undefined) return;
    const actual = key === "overallScore" ? score : scores[key];
    if (actual !== null && actual !== undefined && actual < min) {
      violations.push(`${key} score ${actual} is below the required minimum of ${min}`);
    }
  });

  if (policy.failSeverity !== "none") {
    const threshold = SEVERITY_RANK[policy.failSeverity];
    const breaching = issues.filter(
      (i) => SEVERITY_RANK[i.severity] !== undefined && SEVERITY_RANK[i.severity] >= threshold
    );
    if (breaching.length) {
      violations.push(
        `${breaching.length} issue(s) at or above "${policy.failSeverity}" severity`
      );
    }
  }

  return { passed: violations.length === 0, violations };
}

function hasModule(test, name) {
  return (
    Array.isArray(test.options.modules) && test.options.modules.includes(name)
  );
}

/**
 * Phase 1 (always runs): crawl, broken links, responsive screenshots,
 * console errors, Lighthouse.
 * Phase 2 (opt-in via test.options.modules): accessibility, SEO,
 * visual regression, cross-browser, performance benchmarking.
 */
async function runScan(testId) {
  const test = testsRepo.get(testId);
  if (!test) throw new Error(`Test ${testId} not found`);

  await testsRepo.update(testId, {
    status: "running",
    startedAt: new Date().toISOString(),
  });

  try {
    // ---- Phase 1 ----
    await updateStage(testId, "crawling", 8);
    const { pages, externalLinks } = await crawlSite(test.url, {
      maxPages: test.options.maxPages,
      maxDepth: test.options.maxDepth,
    });

    await updateStage(testId, "links", 18);
    const internalBroken = pages
      .filter((p) => p.statusCode === 0 || p.statusCode >= 400)
      .map((p) => ({ url: p.url, statusCode: p.statusCode, error: p.error }));
    const externalBroken = await checkLinks(externalLinks);
    const brokenLinks = [...internalBroken, ...externalBroken];

    const browser = await getBrowser();

    await updateStage(testId, "responsive", 30);
    const screenshots = await captureResponsiveScreenshots(
      browser,
      test.url,
      testId,
    );

    await updateStage(testId, "console", 40);
    const consoleErrors = await detectConsoleErrors(browser, test.url);

    await updateStage(testId, "lighthouse", 50);
    const { scores, metrics, failingAudits } = await runLighthouseAudit(
      test.url,
    );

    // ---- Phase 2 (only what the user selected) ----
    let accessibilityResult = { violations: [], passes: 0, incomplete: 0 };
    if (hasModule(test, "accessibility")) {
      await updateStage(testId, "accessibility", 58);
      accessibilityResult = await runAccessibilityAudit(browser, test.url);
    }

    let seoResult = { checks: [], score: null };
    if (hasModule(test, "seo")) {
      await updateStage(testId, "seo", 64);
      // seoResult = await auditSEO(test.url);
      seoResult = await auditSEO(browser, test.url);
    }

    let visualRegressionResults = [];
    if (hasModule(test, "visual-regression")) {
      await updateStage(testId, "visual-regression", 72);
      visualRegressionResults = await runVisualRegression(
        test.url,
        testId,
        screenshots,
      );
    }

    let crossBrowserResults = [];
    if (hasModule(test, "cross-browser")) {
      await updateStage(testId, "cross-browser", 84);
      crossBrowserResults = await runCrossBrowserCheck(test.url);
    }

    let performanceBenchmark = null;
    if (hasModule(test, "performance-benchmark")) {
      await updateStage(testId, "performance-benchmark", 90);
      performanceBenchmark = benchmarkPerformance(test.url, metrics, testId);
    }

    // ---- Aggregate ----
    await updateStage(testId, "aggregating", 95);
    const { issues, score } = buildIssuesAndScore({
      brokenLinks,
      consoleErrors,
      lighthouseScores: scores,
      failingAudits,
      pageUrl: test.url,
      accessibilityViolations: accessibilityResult.violations,
      seoChecks: seoResult.checks,
      visualRegressionResults,
      crossBrowserResults,
    });

    const completedAt = new Date().toISOString();
    let finalStatus = issues.some(
      (i) => i.severity === "critical" || i.severity === "high",
    )
      ? "failed"
      : "passed";

    const activePolicy = policiesRepo.getActive();
    let policyResult = null;
    if (activePolicy) {
      const { passed, violations } = evaluatePolicy(activePolicy, { score, scores, issues });
      policyResult = { policyId: activePolicy.id, policyName: activePolicy.name, passed, violations };
      if (!passed) finalStatus = "failed";
    }

    const report = {
      testId,
      url: test.url,
      generatedAt: completedAt,
      pagesScanned: pages.length,
      pages,
      score,
      scores,
      metrics,
      issues,
      brokenLinks,
      consoleErrors,
      screenshots,
      accessibility: accessibilityResult,
      seo: seoResult,
      visualRegression: visualRegressionResults,
      crossBrowser: crossBrowserResults,
      performanceBenchmark,
      policyResult,
    };

    fs.mkdirSync(REPORTS_DIR, { recursive: true });
    fs.writeFileSync(
      path.join(REPORTS_DIR, `${testId}.json`),
      JSON.stringify(report, null, 2),
    );

    await testsRepo.update(testId, {
      status: finalStatus,
      progress: 100,
      currentStage: "done",
      score,
      scores,
      metrics,
      pagesScanned: pages.length,
      issues,
      brokenLinks,
      consoleErrors,
      screenshots,
      accessibility: accessibilityResult,
      seo: seoResult,
      visualRegression: visualRegressionResults,
      crossBrowser: crossBrowserResults,
      performanceBenchmark,
      policyResult,
      completedAt,
    });

    logger.success(
      "scanEngine",
      `Scan complete for ${test.url} — score ${score}, status ${finalStatus}`,
    );
  } catch (err) {
    logger.error("scanEngine", `Scan failed for ${test.url}: ${err.message}`);
    await testsRepo.update(testId, {
      status: "error",
      error: err.message,
      completedAt: new Date().toISOString(),
    });
  }
}

module.exports = { runScan };
