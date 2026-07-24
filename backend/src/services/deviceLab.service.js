const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { chromium, firefox, webkit } = require("@playwright/test");

const config = require("../config/config");
const logger = require("../utils/logger");
const { DEVICE_LIST, getDeviceDescriptor } = require("../data/deviceCatalog");

const SCREENSHOT_ROOT = path.join(__dirname, "..", "..", config.storage.screenshotsDir, "device-lab");
const RENDER_TIMEOUT_MS = 30000;

const ENGINES = { chromium, firefox, webkit };

function listDevices() {
  return DEVICE_LIST;
}

/**
 * Launches a real browser engine (Chromium/Firefox/WebKit) with a
 * Playwright device descriptor applied, navigates to `url`, and captures a
 * viewport screenshot — actual engine rendering, not a CSS mockup.
 */
async function renderDevice({ url, deviceId, orientation = "portrait", browserOverride }) {
  const found = getDeviceDescriptor(deviceId);
  if (!found) {
    const err = new Error(`Unknown device: ${deviceId}`);
    err.status = 400;
    throw err;
  }
  const { meta, descriptor } = found;

  let viewport = descriptor.viewport;
  if (orientation === "landscape" && meta.isMobile) {
    viewport = { width: viewport.height, height: viewport.width };
  }

  const engineName = browserOverride || meta.defaultBrowserType;
  const engine = ENGINES[engineName] || chromium;

  const runId = crypto.randomBytes(6).toString("hex");
  fs.mkdirSync(SCREENSHOT_ROOT, { recursive: true });
  const fileName = `${runId}.png`;
  const filePath = path.join(SCREENSHOT_ROOT, fileName);

  const startedAt = Date.now();
  let browser;
  try {
    browser = await engine.launch({ headless: true });
    const context = await browser.newContext({
      ...descriptor,
      viewport,
    });
    const page = await context.newPage();

    let statusCode = null;
    const response = await page.goto(url, {
      waitUntil: "networkidle",
      timeout: RENDER_TIMEOUT_MS,
    });
    statusCode = response ? response.status() : null;

    await page.screenshot({ path: filePath });
    await context.close();

    return {
      screenshotUrl: `/screenshots/device-lab/${fileName}`,
      device: meta,
      orientation,
      browserEngine: engineName,
      statusCode,
      loadTimeMs: Date.now() - startedAt,
    };
  } catch (err) {
    logger.error("device-lab", `Render failed for ${url} on ${deviceId}: ${err.message}`);
    const wrapped = new Error(`Failed to render ${url} on ${meta.name}: ${err.message}`);
    wrapped.status = 502;
    throw wrapped;
  } finally {
    if (browser) await browser.close();
  }
}

module.exports = { listDevices, renderDevice };
