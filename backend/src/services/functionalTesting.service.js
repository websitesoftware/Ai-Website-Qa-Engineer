const fs = require("fs");
const path = require("path");
const { chromium } = require("@playwright/test");

const config = require("../config/config");
const logger = require("../utils/logger");
const gemini = require("../services/gemini.service");
const llm = require("../services/llm.service");
const {
  discoverComponents,
  prepPageForScan,
  captureComponentScreenshots,
} = require("../utils/pageScanner");
const { classifyByRules, generateStepsByRules } = require("../utils/ruleBasedScan");

const SCREENSHOTS_DIR = path.join(__dirname, "..", "..", config.storage.screenshotsDir);

async function callAI(callArgs) {
  const useGemini = gemini.isEnabled();
  if (!useGemini && !llm.isEnabled()) return null;
  let json = useGemini ? await gemini.completeJSON(callArgs) : null;
  if (!json && llm.isEnabled()) json = await llm.completeJSON(callArgs);
  return json;
}

/**
 * Every component always gets a deterministic, rules-based classification
 * first (see ruleBasedScan.js) — instant, free, no API key needed. The AI
 * call then REFINES that baseline where it succeeds; if the LLM is
 * disabled, out of quota, or errors for a given component, the rules-based
 * result is what ships, instead of a generic placeholder.
 */
async function classifyComponents(components) {
  const withRuleBase = components.map((c) => ({ ...c, ...classifyByRules(c.html) }));

  const blocks = components
    .map((c) => `--- COMPONENT "${c.componentId}" ("${c.name}") ---\n${c.html}`)
    .join("\n\n");

  const json = await callAI({
    system:
      "You are a senior QA engineer classifying page components. Always " +
      "respond with a single JSON object only — no markdown fences, no " +
      "commentary.",
    prompt: `
      For EACH component below, identify what functionality it provides and
      write a short (under 12 words) description, based only on what is
      actually present in its HTML. Do not invent functionality that isn't
      there.

      ${blocks}

      Output a JSON object with this exact shape:
      {
        "components": [
          { "componentId": "one of the ids above", "functionality": "short label, e.g. 'Product search'", "description": "short description" }
        ]
      }
    `,
    maxTokens: 4096,
    temperature: 0.2,
  });

  const byId = new Map((json?.components || []).map((c) => [c.componentId, c]));
  return withRuleBase.map((c) => ({
    ...c,
    functionality: byId.get(c.componentId)?.functionality || c.functionality,
    description: byId.get(c.componentId)?.description || c.description,
  }));
}

/**
 * Every component always gets a deterministic rules-based step baseline
 * (fill the first fillable input, click the first button, or click the
 * first real link for nav-only components) — the AI call overrides it with
 * richer, multi-step coverage where it succeeds, batched into ONE call for
 * the whole page (not one call per component) since LLM free tiers cap
 * requests per day, not tokens per request.
 */
async function generateExecutableStepsForJob(components) {
  const ruleSteps = new Map(components.map((c) => [c.componentId, generateStepsByRules(c.html)]));

  const blocks = components
    .map((c) => `--- COMPONENT "${c.componentId}" ("${c.name}", functionality: ${c.functionality || "unknown"}) ---\n${c.html}`)
    .join("\n\n");

  const json = await callAI({
    system:
      "You are a senior QA automation engineer writing REAL, executable " +
      "Playwright test steps. Always respond with a single JSON object " +
      "only — no markdown fences, no commentary.",
    prompt: `
      For EACH component below, write 1 to 5 executable steps that exercise
      its REAL functionality, using ONLY elements actually present in that
      component's own HTML. Each step is one of:
        - { "action": "fill", "selector": "<CSS selector RELATIVE to that component's HTML>", "value": "realistic sample input", "expected": "" }
        - { "action": "click", "selector": "<CSS selector RELATIVE to that component's HTML>", "value": "", "expected": "" }
        - { "action": "select", "selector": "<CSS selector for a <select> element, RELATIVE to that component's HTML>", "value": "the <option>'s value attribute to select", "expected": "" }
        - { "action": "assert_visible", "selector": "<CSS selector RELATIVE to that component's HTML>", "value": "", "expected": "short description of what should be visible" }

      Never generate a "click" step on a tel: or mailto: link — verify it
      with "assert_visible" instead, since clicking it hands off to the
      OS dialer/mail app rather than producing a browser-testable result.

      Selectors must be resolvable against the HTML snippet given for that
      component (prefer id/name/aria-label/role/text-based selectors over
      fragile generated class names). If a component has no meaningfully
      testable interactive element, give it an empty steps array.

      ${blocks}

      Output a JSON object with this exact shape:
      {
        "components": [
          { "componentId": "one of the ids above", "steps": [ { "action": "fill|click|select|assert_visible", "selector": "string", "value": "string", "expected": "string" } ] }
        ]
      }
    `,
    maxTokens: 8192,
    temperature: 0.2,
  });

  const byId = new Map((json?.components || []).map((c) => [c.componentId, c]));
  return components.map((c) => {
    const aiSteps = byId.get(c.componentId)?.steps;
    const validAiSteps = Array.isArray(aiSteps)
      ? aiSteps.filter((s) => s && typeof s.selector === "string" && ["fill", "click", "select", "assert_visible"].includes(s.action))
      : [];
    const steps = validAiSteps.length > 0 ? validAiSteps : ruleSteps.get(c.componentId) || [];
    return { ...c, steps };
  });
}

// `.first()` matters even for selectors that "should" be unique: rule-based
// and AI-generated selectors alike are best-effort, and real nav/menu
// markup commonly repeats the same tag+type/text across many elements.
// Without `.first()`, Playwright's strict mode throws "resolved to N
// elements" instead of acting on the first match, like a human tester would.
function buildLocator(page, component, step) {
  const root = page.locator(component.selector);
  return (step.selector ? root.locator(step.selector) : root).first();
}

// Lets the page settle after an action before the next step/screenshot:
// clicks may trigger navigation, a search request, or an accordion
// animation, and capturing state a beat too early leaves the after-shot on
// a still-loading frame instead of the actual result.
async function settleAfterAction(page, { isNav } = {}) {
  await page.waitForLoadState("networkidle", { timeout: isNav ? 8000 : 3000 }).catch(() => {});
  await page.waitForTimeout(isNav ? 600 : 300);
}

/**
 * Actually runs one component's generated steps for real against a fresh
 * page load (fill/click/assert), logging pass/fail per step and capturing
 * a before/after screenshot pair.
 */
async function executeComponent(url, component, testId) {
  const stepsLog = [];
  let overallStatus = "passed";
  let browser;

  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(url, { waitUntil: "networkidle", timeout: 45000 });
    await prepPageForScan(page);

    // component.selector (e.g. [data-qa-component-id="qa-component-3"]) was
    // injected live during the original scan's page.evaluate — this is a
    // brand new page load, so that attribute doesn't exist yet. Re-run
    // discovery here to re-tag the DOM in the same deterministic walk
    // order, which reassigns the same componentId to the same component
    // (relies on the page rendering the same structure on reload).
    await discoverComponents(page);

    const originalUrl = page.url();

    for (const step of component.steps) {
      const description =
        step.action === "fill"
          ? `Filled "${step.selector}" with "${step.value}"`
          : step.action === "click"
          ? step.nav
            ? `Clicked "${step.selector}" (expects navigation)`
            : `Clicked "${step.selector}"`
          : step.action === "select"
          ? `Selected "${step.value}" on "${step.selector}"`
          : `Verified "${step.selector}" is visible`;

      try {
        // eslint-disable-next-line no-await-in-loop -- steps must run in order, each depending on the page state left by the last
        const locator = buildLocator(page, component, step);
        // eslint-disable-next-line no-await-in-loop
        await locator.waitFor({ state: "visible", timeout: 8000 });

        if (step.action === "fill") {
          // eslint-disable-next-line no-await-in-loop
          await locator.fill(step.value || "test");
          // eslint-disable-next-line no-await-in-loop
          await settleAfterAction(page);
        } else if (step.action === "click") {
          // eslint-disable-next-line no-await-in-loop
          await locator.click();
          // eslint-disable-next-line no-await-in-loop
          await settleAfterAction(page, { isNav: step.nav });
        } else if (step.action === "select") {
          // eslint-disable-next-line no-await-in-loop
          await locator.selectOption(step.value);
          // eslint-disable-next-line no-await-in-loop
          await settleAfterAction(page);
        } else if (step.action === "assert_visible") {
          // eslint-disable-next-line no-await-in-loop
          const visible = await locator.isVisible();
          if (!visible) throw new Error("Element is not visible");
        }

        stepsLog.push({ description, status: "ok", error: null });
      } catch (stepErr) {
        stepsLog.push({ description, status: "failed", error: stepErr.message });
        overallStatus = "failed";
        break; // later steps likely depend on this one — stop rather than cascade false failures
      }
    }

    const navigatedAway = page.url() !== originalUrl;

    let afterScreenshotPath = null;
    try {
      const shotsDir = path.join(SCREENSHOTS_DIR, testId, "functional-after");
      fs.mkdirSync(shotsDir, { recursive: true });
      const fileName = `${component.componentId}.png`;
      const shotPath = path.join(shotsDir, fileName);
      if (navigatedAway) {
        // The click carried us to a real new page — show that page, not a
        // component selector that no longer exists post-navigation.
        await page.screenshot({ path: shotPath, timeout: 8000 });
      } else {
        await page.locator(component.selector).first().screenshot({ path: shotPath, timeout: 8000 });
      }
      afterScreenshotPath = `/screenshots/${testId}/functional-after/${fileName}`;
    } catch {
      // component may have navigated away or been removed by its own last step — not fatal
    }

    await browser.close();
    browser = null;

    return { status: overallStatus, stepsLog, afterScreenshotPath, executedAt: new Date().toISOString() };
  } catch (err) {
    if (browser) await browser.close().catch(() => {});
    return {
      status: "failed",
      stepsLog: stepsLog.length ? stepsLog : [{ description: "Run component", status: "failed", error: err.message }],
      afterScreenshotPath: null,
      executedAt: new Date().toISOString(),
    };
  }
}

/**
 * Phase 3: scans `url` into named components, classifies each one's real
 * functionality, generates real executable steps, and actually runs each
 * component's steps for real via Playwright — returning results ready to
 * attach directly to a test record (test.functionalTesting).
 */
async function runFunctionalTesting(url, testId) {
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 2,
    });
    await page.goto(url, { waitUntil: "networkidle", timeout: 45000 });
    await prepPageForScan(page);

    const discovered = await discoverComponents(page);
    if (!discovered.length) {
      await browser.close();
      return [];
    }

    const screenshotPaths = await captureComponentScreenshots({
      page,
      components: discovered,
      screenshotsDir: SCREENSHOTS_DIR,
      subDir: `${testId}/functional`,
    });

    await browser.close();
    browser = null;

    const withScreenshots = discovered.map((c) => ({
      ...c,
      screenshotPath: screenshotPaths[c.componentId] || null,
    }));

    logger.info("functionalTesting", `Classifying ${withScreenshots.length} components via AI...`);
    const classified = await classifyComponents(withScreenshots);

    logger.info("functionalTesting", `Generating executable steps for ${classified.length} components...`);
    const withSteps = await generateExecutableStepsForJob(classified);

    const results = [];
    for (const component of withSteps) {
      if (!component.steps || component.steps.length === 0) {
        results.push({
          componentId: component.componentId,
          selector: component.selector,
          name: component.name,
          functionality: component.functionality,
          description: component.description,
          screenshotPath: component.screenshotPath,
          steps: [],
          execution: {
            status: "skipped",
            stepsLog: [],
            afterScreenshotPath: null,
            executedAt: new Date().toISOString(),
          },
        });
        continue;
      }

      // eslint-disable-next-line no-await-in-loop -- one browser session per component, run sequentially to bound resource usage
      const execution = await executeComponent(url, component, testId);
      results.push({
        componentId: component.componentId,
        selector: component.selector,
        name: component.name,
        functionality: component.functionality,
        description: component.description,
        screenshotPath: component.screenshotPath,
        steps: component.steps,
        execution,
      });
    }

    return results;
  } catch (err) {
    if (browser) await browser.close().catch(() => {});
    logger.error("functionalTesting", `Functional testing failed for ${url}: ${err.message}`);
    return [];
  }
}

module.exports = { runFunctionalTesting };
