const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const path = require("path");
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
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "networkidle", timeout: 45000 });

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
        results.push({
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

    await browser.close();
    browser = null;

    if (!sections || sections.length === 0) {
      return res.status(502).json({
        error: "Could not detect any distinct page sections to scan.",
        steps: [],
      });
    }

    console.log(
      `[Studio API] Found ${sections.length} sections: ${sections.map((s) => s.name).join(", ")}`,
    );
    console.log("[Studio API] Compiling step matrix via Claude...");

    const { steps, error } = await autoDiscoverAndGenerateSteps(url, sections);

    if (error) {
      return res
        .status(502)
        .json({ error: `AI generation failed: ${error}`, steps: [] });
    }

    return res.json({
      steps,
      sectionOrder: sections.map((s) => s.name),
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
