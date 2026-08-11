const fs = require("fs");
const path = require("path");

/**
 * Walks the live DOM top-to-bottom and pulls out named, discrete components:
 * Header -> Nav -> Hero/Banner -> each main content block -> each Form ->
 * Footer -> any other block containing interactive elements (buttons,
 * inputs, links) that wasn't already captured above.
 *
 * Each component gets a real, re-locatable CSS selector (via a unique
 * data-qa-component-id attribute) so callers can screenshot it, and later
 * re-locate + interact with it in a fresh page load for execution.
 */
async function discoverComponents(page) {
  return page.evaluate(() => {
    const results = [];
    const seen = new Set();
    const MAX_HTML_PER_COMPONENT = 8000;
    const MAX_COMPONENTS = 14;

    const labelFor = (el, fallback) => {
      const heading = el.querySelector(
        'h1, h2, h3, [class*="title" i], [class*="heading" i]',
      );
      const text = heading?.textContent?.trim();
      return text ? text.substring(0, 60) : fallback;
    };

    const push = (el, fallbackName) => {
      if (!el || seen.has(el) || results.length >= MAX_COMPONENTS) return;
      seen.add(el);
      const componentId = `qa-component-${results.length}`;
      el.setAttribute("data-qa-component-id", componentId);
      results.push({
        componentId,
        selector: `[data-qa-component-id="${componentId}"]`,
        name: labelFor(el, fallbackName),
        html: el.innerHTML.substring(0, MAX_HTML_PER_COMPONENT),
      });
    };

    // 1. Header / top nav
    push(document.querySelector('header, [role="banner"]'), "Header");
    const navEl = document.querySelector("nav");
    if (navEl && !seen.has(navEl)) push(navEl, "Navigation");

    // 2. Hero / banner block
    push(
      document.querySelector(
        '[class*="hero" i], [id*="hero" i], [class*="banner" i], [class*="jumbotron" i]',
      ),
      "Hero Banner",
    );

    // 3. Main content, broken into its top-level blocks
    const main = document.querySelector("main") || document.body;
    const blocks = main.querySelectorAll(":scope > section, :scope > div");
    let count = 1;
    blocks.forEach((block) => {
      if (seen.has(block)) return;
      const text = block.innerText ? block.innerText.trim() : "";
      const hasInteractive = block.querySelector("button, input, a, select, textarea");
      if (text.length > 40 || hasInteractive) {
        push(block, `Content Section ${count}`);
        count += 1;
      }
    });
    if (count === 1) {
      push(main, "Main Content");
    }

    // 4. Any forms anywhere on the page
    document.querySelectorAll("form").forEach((form, i) => {
      if (!seen.has(form)) push(form, `Form ${i + 1}`);
    });

    // 5. Footer
    push(document.querySelector("footer"), "Footer");

    return results;
  });
}

/**
 * Hides common cookie/consent banners and lazy-loads below-the-fold
 * content so screenshots/HTML capture reflect the real rendered page.
 */
async function prepPageForScan(page) {
  await page.addStyleTag({
    content: `
      [id*="cookie" i], [class*="cookie" i],
      [id*="consent" i], [class*="consent" i],
      [id*="gdpr" i], [class*="gdpr" i],
      [aria-label*="cookie" i], [aria-label*="consent" i] {
        display: none !important;
      }
    `,
  });

  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let total = 0;
      const distance = 400;
      const timer = setInterval(() => {
        window.scrollBy(0, distance);
        total += distance;
        if (total >= document.body.scrollHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 150);
    });
  });
  await page.waitForTimeout(500);
}

/**
 * Screenshots each component individually (not the full page), writing
 * files under `<screenshotsDir>/<subDir>/`. Returns a map of
 * componentId -> a relative `/screenshots/...` path (same convention as
 * responsive.service.js), NOT an absolute URL — callers/consumers resolve
 * it against API_ORIGIN on the frontend via `api.screenshotUrl()`, since
 * this runs inside the background scan pipeline with no HTTP request to
 * build an absolute URL from.
 */
async function captureComponentScreenshots({ page, components, screenshotsDir, subDir }) {
  const shotsDir = path.join(screenshotsDir, subDir);
  fs.mkdirSync(shotsDir, { recursive: true });

  const paths = {};
  for (const component of components) {
    try {
      const locator = page.locator(component.selector);
      const fileName = `${component.componentId}.png`;
      // eslint-disable-next-line no-await-in-loop -- sequential so each shot scrolls the right element into view first
      await locator.screenshot({ path: path.join(shotsDir, fileName), timeout: 8000 });
      paths[component.componentId] = `/screenshots/${subDir}/${fileName}`;
    } catch (err) {
      // Element may be hidden/zero-size — leave it without a screenshot rather than failing the whole scan.
    }
  }
  return paths;
}

module.exports = { discoverComponents, prepPageForScan, captureComponentScreenshots };
