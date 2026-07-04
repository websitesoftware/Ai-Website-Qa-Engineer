const puppeteer = require("puppeteer");
const logger = require("../utils/logger");

let browserPromise = null;

/**
 * Returns a shared, lazily-launched Puppeteer browser instance.
 * Re-launches automatically if the previous instance died.
 */
async function getBrowser() {
  if (browserPromise) {
    try {
      const b = await browserPromise;
      if (b.isConnected()) return b;
    } catch (e) {
      // fall through to relaunch
    }
  }

  logger.info("browser", "Launching headless Chromium...");
  browserPromise = puppeteer.launch({
    headless: "new",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
    ],
  });
  return browserPromise;
}

async function closeBrowser() {
  if (!browserPromise) return;
  const b = await browserPromise;
  await b.close();
  browserPromise = null;
}

module.exports = { getBrowser, closeBrowser };
