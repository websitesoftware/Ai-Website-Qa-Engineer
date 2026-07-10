// const app = require("./src/app");
// const config = require("./src/config/config");
// const logger = require("./src/utils/logger");
// const { closeBrowser } = require("./src/services/browser.service");

// const server = app.listen(config.port, () => {
//   logger.success("server", `AI QA Engineer backend running on http://localhost:${config.port}`);
// });

// async function shutdown(signal) {
//   logger.warn("server", `${signal} received. Shutting down gracefully...`);
//   server.close(async () => {
//     await closeBrowser();
//     process.exit(0);
//   });
// }

// process.on("SIGINT", () => shutdown("SIGINT"));
// process.on("SIGTERM", () => shutdown("SIGTERM"));
const app = require("./src/app");
const config = require("./src/config/config");
const logger = require("./src/utils/logger");
const { closeBrowser } = require("./src/services/browser.service");
const { chromium } = require("@playwright/test");
const { autoDiscoverAndGenerateSteps } = require("./src/utils/testGenerator");

// =========================================================================
// 🚀 INJECTING STUDIO API DIRECTLY ON APP INSTANCE TO FIX 404
// =========================================================================
app.post("/api/generate-playwright-code", async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res
      .status(400)
      .json({ error: "URL is required for live studio scan" });
  }

  let browser;
  try {
    logger.info("server", `[Studio API] Scan initiated for target: ${url}`);

    // 1. Headless browser launch karke HTML DOM tree extract karna
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });

    const pageHtmlSnippet = await page.evaluate(() => {
      const mainContent = document.querySelector("form, main, body");
      return mainContent ? mainContent.innerHTML.substring(0, 15000) : "";
    });

    await browser.close();

    // 2. AI Utility se steps array fetch karna
    logger.info("server", `[Studio API] HTML structure fetched. Calling AI...`);
    const generatedSteps = await autoDiscoverAndGenerateSteps(
      url,
      pageHtmlSnippet,
    );

    // 3. Playwright Automation spec format string builder
    const structuredCode = `
import { test, expect } from '@playwright/test';

test('Automated AI Studio Flow for ${url}', async ({ page }) => {
  // Navigate to target platform
  await page.goto('${url}', { waitUntil: 'networkidle' });

  ${generatedSteps
    .map((step, idx) => {
      if (step.action === "fill") {
        return `  // Step ${idx + 1}: Interactive Input field execution\n  await page.waitForSelector('${step.selector}', { state: 'visible' });\n  await page.fill('${step.selector}', '${step.value}');\n`;
      }
      if (step.action === "click") {
        return `  // Step ${idx + 1}: Trigger click action event\n  await page.waitForSelector('${step.selector}', { state: 'visible' });\n  await page.click('${step.selector}');\n`;
      }
      if (step.action === "assert_visible") {
        return `  // Step ${idx + 1}: Target UI state assertion check\n  await expect(page.locator('${step.selector}')).toBeVisible({ timeout: 5000 });\n`;
      }
      return "";
    })
    .join("\n")}
  console.log('E2E Studio Suite Execution Complete.');
});
    `.trim();

    logger.success(
      "server",
      `[Studio API] Playwright suite compiled for ${url}`,
    );
    return res.json({ code: structuredCode });
  } catch (error) {
    logger.error("server", `[Studio API] Critical failure: ${error.message}`);
    if (browser) await browser.close();
    return res.status(500).json({
      error: "Failed to scan target system",
      code: `// Real-time server parsing failed:\n// ${error.message}`,
    });
  }
});
// =========================================================================

// Server Setup Listening
const server = app.listen(config.port, () => {
  logger.success(
    "server",
    `AI QA Engineer backend running on http://localhost:${config.port}`,
  );
});

async function shutdown(signal) {
  logger.warn("server", `${signal} received. Shutting down gracefully...`);
  server.close(async () => {
    await closeBrowser();
    process.exit(0);
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
