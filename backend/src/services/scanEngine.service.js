const fs = require("fs");
const path = require("path");
const config = require("../config/config");
const logger = require("../utils/logger");
const testsRepo = require("../repositories/tests.repository");
const { getBrowser } = require("./browser.service");
const { crawlSite } = require("./crawler.service");
const { checkLinks } = require("./linkChecker.service");
const { captureResponsiveScreenshots } = require("./responsive.service");
const { detectConsoleErrors } = require("./consoleError.service");
const { runLighthouseAudit } = require("./lighthouse.service");
const { buildIssuesAndScore } = require("./issueDetector.service");

const REPORTS_DIR = path.join(__dirname, "..", "..", config.storage.reportsDir);

async function updateStage(testId, stage, progress) {
  await testsRepo.update(testId, { currentStage: stage, progress });
}

/**
 * Runs the full Phase-1 MVP QA scan for a single Test record:
 *   1. Crawl site (discover internal pages, collect external links)
 *   2. Broken link detection (external + a sample of internal pages)
 *   3. Responsive screenshots (mobile/tablet/desktop) of the homepage
 *   4. Console error detection on the homepage
 *   5. Lighthouse audit (performance/accessibility/seo/best-practices)
 *   6. Aggregate into issues[] + an overall score, persist report + test record
 */
async function runScan(testId) {
  const test = testsRepo.get(testId);
  if (!test) throw new Error(`Test ${testId} not found`);

  await testsRepo.update(testId, { status: "running", startedAt: new Date().toISOString() });

  try {
    // 1. Crawl
    await updateStage(testId, "crawling", 10);
    const { pages, externalLinks } = await crawlSite(test.url, {
      maxPages: test.options.maxPages,
      maxDepth: test.options.maxDepth,
    });

    // 2. Broken links (all external links + any internal page that already 4xx/5xx'd)
    await updateStage(testId, "links", 30);
    const internalBroken = pages
      .filter((p) => p.statusCode === 0 || p.statusCode >= 400)
      .map((p) => ({ url: p.url, statusCode: p.statusCode, error: p.error }));
    const externalBroken = await checkLinks(externalLinks);
    const brokenLinks = [...internalBroken, ...externalBroken];

    // 3 & 4. Responsive screenshots + console errors (homepage, via shared browser)
    const browser = await getBrowser();

    await updateStage(testId, "responsive", 50);
    const screenshots = await captureResponsiveScreenshots(browser, test.url, testId);

    await updateStage(testId, "console", 65);
    const consoleErrors = await detectConsoleErrors(browser, test.url);

    // 5. Lighthouse
    await updateStage(testId, "lighthouse", 80);
    const { scores, failingAudits } = await runLighthouseAudit(test.url);

    // 6. Aggregate
    await updateStage(testId, "aggregating", 95);
    const { issues, score } = buildIssuesAndScore({
      brokenLinks,
      consoleErrors,
      lighthouseScores: scores,
      failingAudits,
      pageUrl: test.url,
    });

    const completedAt = new Date().toISOString();
    const finalStatus = issues.some((i) => i.severity === "critical" || i.severity === "high")
      ? "failed"
      : "passed";

    const report = {
      testId,
      url: test.url,
      generatedAt: completedAt,
      pagesScanned: pages.length,
      pages,
      score,
      scores,
      issues,
      brokenLinks,
      consoleErrors,
      screenshots,
    };

    fs.mkdirSync(REPORTS_DIR, { recursive: true });
    fs.writeFileSync(path.join(REPORTS_DIR, `${testId}.json`), JSON.stringify(report, null, 2));

    await testsRepo.update(testId, {
      status: finalStatus,
      progress: 100,
      currentStage: "done",
      score,
      scores,
      pagesScanned: pages.length,
      issues,
      brokenLinks,
      consoleErrors,
      screenshots,
      completedAt,
    });

    logger.success("scanEngine", `Scan complete for ${test.url} — score ${score}, status ${finalStatus}`);
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
