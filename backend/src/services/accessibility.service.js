const fs = require("fs");
const config = require("../config/config");
const logger = require("../utils/logger");
const { mapAxeRuleToCategory } = require("../utils/accessibilityCategories");
const { runCustomAccessibilityChecks } = require("./accessibilityCustomChecks");

const axeSource = fs.readFileSync(
  require.resolve("axe-core/axe.min.js"),
  "utf-8",
);

/**
 * Injects axe-core into the already-rendered page and runs a WCAG audit.
 * Uses the shared Puppeteer browser (same one used for screenshots/console).
 */
async function runAccessibilityAudit(browser, url) {
  const page = await browser.newPage();
  try {
    await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
    await page.evaluate(axeSource);

    const results = await page.evaluate(async (standards) => {
      // eslint-disable-next-line no-undef
      return axe.run(document, { runOnly: standards });
    }, config.accessibility.standards);

    const axeViolations = results.violations.map((v) => ({
      id: v.id,
      categoryLabel: mapAxeRuleToCategory(v.id),
      impact: v.impact,
      description: v.description,
      help: v.help,
      helpUrl: v.helpUrl,
      nodes: v.nodes.length,
      targets: v.nodes.slice(0, 5).map((n) => n.target.join(" ")),
      // Real, observed markup for the first few violating nodes — used to
      // ground automated fixes in the actual source instead of guessing.
      locators: v.nodes.slice(0, 3).map((n) => ({
        selector: n.target.join(" "),
        html: n.html,
      })),
    }));

    // axe-core doesn't have (or ships disabled) rules for some of the
    // categories QA wants covered — see accessibilityCustomChecks.js.
    const customViolations = await runCustomAccessibilityChecks(page);

    return {
      violations: [...axeViolations, ...customViolations],
      passes: results.passes.length,
      incomplete: results.incomplete.length,
    };
  } catch (err) {
    logger.error("accessibility", `Audit failed for ${url}: ${err.message}`);
    return { violations: [], passes: 0, incomplete: 0, error: err.message };
  } finally {
    await page.close();
  }
}

module.exports = { runAccessibilityAudit };
