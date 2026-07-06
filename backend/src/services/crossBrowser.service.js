const config = require("../config/config");
const logger = require("../utils/logger");

let playwright = null;
function getPlaywright() {
  if (!playwright) playwright = require("playwright");
  return playwright;
}

/**
 * Loads the URL in each configured browser engine and checks it actually
 * loads OK. Uses `domcontentloaded` instead of `networkidle` — many modern
 * sites (analytics, websockets, polling) never go fully network-idle,
 * which caused Chromium timeouts here.
 */
async function runCrossBrowserCheck(url) {
  let pw;
  try {
    pw = getPlaywright();
  } catch (err) {
    logger.error(
      "crossBrowser",
      "Playwright not installed — run `npx playwright install`.",
    );
    return config.crossBrowser.browsers.map((name) => ({
      browser: name,
      ok: false,
      error: "Playwright is not installed on the server",
    }));
  }

  const results = [];

  for (const browserName of config.crossBrowser.browsers) {
    const start = Date.now();
    let browser;
    try {
      browser = await pw[browserName].launch();
      const page = await browser.newPage({
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      });
      const consoleErrors = [];
      page.on("console", (msg) => {
        if (msg.type() === "error") consoleErrors.push(msg.text());
      });

      const response = await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: config.crossBrowser.timeoutMs,
      });

      results.push({
        browser: browserName,
        ok: !!response && response.ok(),
        statusCode: response ? response.status() : null,
        loadTimeMs: Date.now() - start,
        consoleErrors: consoleErrors.slice(0, 10),
      });
    } catch (err) {
      logger.warn(
        "crossBrowser",
        `${browserName} failed for ${url}: ${err.message}`,
      );
      results.push({
        browser: browserName,
        ok: false,
        error: err.message,
        loadTimeMs: Date.now() - start,
      });
    } finally {
      if (browser) await browser.close().catch(() => {});
    }
  }

  return results;
}

module.exports = { runCrossBrowserCheck };
