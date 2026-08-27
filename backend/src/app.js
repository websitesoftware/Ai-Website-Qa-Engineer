const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { chromium } = require("@playwright/test");


const config = require("./config/config");
const routes = require("./routes");
const { notFound, errorHandler } = require("./middleware/errorHandler");
const { autoDiscoverAndGenerateSteps } = require("./utils/testGenerator");

const app = express();

app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(morgan(config.env === "development" ? "dev" : "combined"));

// serve captured screenshots so the frontend can render them directly
app.use(
  "/screenshots",
  express.static(path.join(__dirname, "..", config.storage.screenshotsDir)),
);
app.use(
  "/baselines",
  express.static(path.join(__dirname, "..", config.storage.baselinesDir)),
); // Phase 2: visual regression
app.use(
  "/branding",
  express.static(path.join(__dirname, "..", config.storage.brandingDir)),
); // Phase 4: white-label logo

// =========================================================================
// 🚀 FIX FOR THE 404 STATUS REPEATED CRASH
// =========================================================================
app.get("/api/ai-automation/status", (req, res) => {
  return res.json({ status: "idle", engine: "ready", timestamp: new Date() });
});

// =========================================================================
// 🚀 REAL-TIME STUDIO SCANNING ENDPOINT (EXCEL/WORD MATRIX GENERATOR)
// Scans the page as ordered, named sections (Header, Nav, Hero, each
// content block, each Form, Footer) so the AI can tag every test case with
// the real component it belongs to, in real page order. Also captures the
// page's real title so downstream documents can be headed with the actual
// website + page name instead of a generic label.
// =========================================================================
app.post("/api/generate-playwright-code", async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: "URL is required for live scanning" });
  }

  let browser;
  try {
    console.log(`[Studio API] Scanning full page: ${url}`);

    browser = await chromium.launch({ headless: true });
    // deviceScaleFactor:2 renders at 2x pixel density so section screenshots
    // aren't soft/blurry when displayed at full width in the report/PDF.
    const page = await browser.newPage({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 2,
    });
    await page.goto(url, { waitUntil: "networkidle", timeout: 45000 });

    // Cookie/consent banners render a full-viewport dark backdrop that gets
    // baked into every section screenshot underneath them, making captures
    // look dark and "blurry". Hide the common patterns before we scroll or
    // shoot anything.
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

    // Force lazy-loaded sections (common footer/nav pattern) to render
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

    const pageTitle = await page.title();

    // Walk the DOM top-to-bottom and pull out named, discrete sections:
    // Header -> Nav -> Hero/Banner -> each main content block -> each Form -> Footer
    const sections = await page.evaluate(() => {
      const results = [];
      const seen = new Set();
      const MAX_HTML_PER_SECTION = 8000;
      const MAX_SECTIONS = 12;

      const labelFor = (el, fallback) => {
        const heading = el.querySelector(
          'h1, h2, h3, [class*="title" i], [class*="heading" i]',
        );
        const text = heading?.textContent?.trim();
        return text ? text.substring(0, 60) : fallback;
      };

      const pushSection = (el, fallbackName) => {
        if (!el || seen.has(el) || results.length >= MAX_SECTIONS) return;
        seen.add(el);
        const shotId = `qa-shot-${results.length}`;
        el.setAttribute("data-qa-shot-id", shotId);
        results.push({
          shotId,
          name: labelFor(el, fallbackName),
          html: el.innerHTML.substring(0, MAX_HTML_PER_SECTION),
        });
      };

      // 1. Header / top nav
      pushSection(document.querySelector('header, [role="banner"]'), "Header");
      const navEl = document.querySelector("nav");
      if (navEl && !seen.has(navEl)) pushSection(navEl, "Navigation");

      // 2. Hero / banner block
      const hero = document.querySelector(
        '[class*="hero" i], [id*="hero" i], [class*="banner" i], [class*="jumbotron" i]',
      );
      pushSection(hero, "Hero Banner");

      // 3. Main content, broken into its top-level blocks
      const main = document.querySelector("main") || document.body;
      const blocks = main.querySelectorAll(":scope > section, :scope > div");
      let count = 1;
      blocks.forEach((block) => {
        if (seen.has(block)) return;
        const text = block.innerText ? block.innerText.trim() : "";
        if (text.length > 40) {
          pushSection(block, `Content Section ${count}`);
          count += 1;
        }
      });
      if (count === 1) {
        // Nothing granular found — fall back to the whole main block
        pushSection(main, "Main Content");
      }

      // 4. Any forms anywhere on the page
      document.querySelectorAll("form").forEach((form, i) => {
        if (!seen.has(form)) pushSection(form, `Form ${i + 1}`);
      });

      // 5. Footer
      pushSection(document.querySelector("footer"), "Footer");

      return results;
    });

    if (!sections || sections.length === 0) {
      await browser.close();
      return res.status(502).json({
        error: "Could not detect any distinct page sections to scan.",
        steps: [],
      });
    }

    console.log(
      `[Studio API] Found ${sections.length} sections: ${sections.map((s) => s.name).join(", ")}`,
    );

    // Capture one screenshot per detected section so the exported test pack
    // can show a real "here's the component under test" image below its
    // steps. Each element was tagged with a unique data-qa-shot-id above, so
    // it can be re-located and screenshotted individually (Playwright
    // auto-scrolls the element into view before capturing it).
    const runId = crypto.randomBytes(6).toString("hex");
    const shotsDir = path.join(
      __dirname,
      "..",
      config.storage.screenshotsDir,
      "studio",
      runId,
    );
    fs.mkdirSync(shotsDir, { recursive: true });

    const sectionScreenshots = {};
    for (const section of sections) {
      try {
        const locator = page.locator(`[data-qa-shot-id="${section.shotId}"]`);
        const fileName = `${section.shotId}.png`;
        await locator.screenshot({
          path: path.join(shotsDir, fileName),
          timeout: 8000,
        });
        sectionScreenshots[section.name] =
          `${req.protocol}://${req.get("host")}/screenshots/studio/${runId}/${fileName}`;
      } catch (shotError) {
        console.warn(
          `[Studio API] Could not screenshot section "${section.name}": ${shotError.message}`,
        );
      }
    }

    console.log(
      `[Studio API] Captured ${Object.keys(sectionScreenshots).length}/${sections.length} section screenshots`,
    );

    await browser.close();
    browser = null;

    console.log("[Studio API] Compiling step matrix via Gemini...");

    const { steps, error } = await autoDiscoverAndGenerateSteps(url, sections);

    if (error) {
      return res
        .status(502)
        .json({ error: `AI generation failed: ${error}`, steps: [] });
    }

    return res.json({
      steps,
      sectionOrder: sections.map((s) => s.name),
      sectionScreenshots,
      pageTitle,
    });
  } catch (error) {
    console.error("[Studio API] Execution error:", error);
    if (browser) await browser.close();
    return res.status(500).json({
      error: error.message || "Failed to scan and compile test steps",
      steps: [],
    });
  }
});
// =========================================================================

app.use("/api", routes);

app.get("/", (req, res) => {
  res.json({
    name: "AI Website QA Engineer — Backend",
    status: "running",
    docs: "/api/health",
  });
});

app.use(notFound);
app.use(errorHandler);

module.exports = app;
