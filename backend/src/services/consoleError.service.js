const config = require("../config/config");

/**
 * Navigates to `url` and captures browser console errors/warnings and
 * uncaught page exceptions (JS runtime errors) — the classic "open devtools
 * and see red text" QA check.
 */
async function detectConsoleErrors(browser, url) {
  const page = await browser.newPage();
  const errors = [];

  page.on("console", (msg) => {
    const type = msg.type();
    if (type === "error" || type === "warning") {
      errors.push({
        type,
        text: msg.text(),
        location: msg.location(),
      });
    }
  });

  page.on("pageerror", (err) => {
    errors.push({ type: "pageerror", text: err.message });
  });

  page.on("requestfailed", (req) => {
    errors.push({
      type: "requestfailed",
      text: `${req.method()} ${req.url()} — ${req.failure()?.errorText || "failed"}`,
    });
  });

  try {
    await page.goto(url, { waitUntil: "networkidle2", timeout: config.crawler.timeoutMs });
    // give async scripts a moment to throw
    await new Promise((r) => setTimeout(r, 1500));
  } catch (err) {
    errors.push({ type: "navigation", text: err.message });
  } finally {
    await page.close();
  }

  return errors;
}

module.exports = { detectConsoleErrors };
