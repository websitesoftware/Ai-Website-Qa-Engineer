// require("dotenv").config();

// module.exports = {
//   port: process.env.PORT || 5000,
//   env: process.env.NODE_ENV || "development",
//   crawler: {
//     maxPages: parseInt(process.env.MAX_CRAWL_PAGES || "15", 10),
//     maxDepth: parseInt(process.env.MAX_CRAWL_DEPTH || "2", 10),
//     concurrency: parseInt(process.env.CRAWL_CONCURRENCY || "4", 10),
//     timeoutMs: parseInt(process.env.CRAWL_TIMEOUT_MS || "15000", 10),
//   },
//   viewports: [
//     { name: "mobile", width: 375, height: 812 },
//     { name: "tablet", width: 768, height: 1024 },
//     { name: "desktop", width: 1440, height: 900 },
//   ],
//   lighthouse: {
//     categories: ["performance", "accessibility", "seo", "best-practices"],
//   },
//   // ---- Phase 2 config ----
//   accessibility: {
//     standards: ["wcag2a", "wcag2aa", "best-practice"],
//   },
//   visualRegression: {
//     diffThresholdPercent: parseFloat(process.env.VISUAL_DIFF_THRESHOLD || "1"),
//   },
//   crossBrowser: {
//     browsers: ["chromium", "firefox", "webkit"],
//     timeoutMs: parseInt(process.env.CROSS_BROWSER_TIMEOUT_MS || "30000", 10),
//   },
//   storage: {
//     screenshotsDir: "storage/screenshots",
//     reportsDir: "storage/reports",
//     baselinesDir: "storage/baselines",
//   },
// };
require("dotenv").config();

module.exports = {
  port: process.env.PORT || 5000,
  env: process.env.NODE_ENV || "development",
  crawler: {
    maxPages: parseInt(process.env.MAX_CRAWL_PAGES || "15", 10),
    maxDepth: parseInt(process.env.MAX_CRAWL_DEPTH || "2", 10),
    concurrency: parseInt(process.env.CRAWL_CONCURRENCY || "4", 10),
    timeoutMs: parseInt(process.env.CRAWL_TIMEOUT_MS || "15000", 10),
  },
  viewports: [
    { name: "mobile", width: 375, height: 812 },
    { name: "tablet", width: 768, height: 1024 },
    { name: "desktop", width: 1440, height: 900 },
  ],
  lighthouse: {
    categories: ["performance", "accessibility", "seo", "best-practices"],
  },
  // ---- Phase 2 config ----
  accessibility: {
    standards: ["wcag2a", "wcag2aa", "best-practice"],
  },
  visualRegression: {
    diffThresholdPercent: parseFloat(process.env.VISUAL_DIFF_THRESHOLD || "1"),
  },
  crossBrowser: {
    browsers: ["chromium", "firefox", "webkit"],
    timeoutMs: parseInt(process.env.CROSS_BROWSER_TIMEOUT_MS || "30000", 10),
  },
  storage: {
    screenshotsDir: "storage/screenshots",
    reportsDir: "storage/reports",
    baselinesDir: "storage/baselines",
    brandingDir: "storage/branding",
  },

  // ---- Phase 3: AI Automation ----
  // LLM is optional. If no key is set, the engine falls back to deterministic
  // rules and still works fully.
  ai: {
    // "anthropic" | "openai" | "none"
    provider: (process.env.AI_PROVIDER || "none").toLowerCase(),
    anthropic: {
      apiKey: process.env.ANTHROPIC_API_KEY || "",
      model: process.env.ANTHROPIC_MODEL || "claude-3-5-haiku-latest",
      baseUrl: process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com",
    },
    openai: {
      apiKey: process.env.OPENAI_API_KEY || "",
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      // works with OpenAI, Groq, Together, Ollama, LM Studio, etc.
      baseUrl: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
    },
    // Used specifically for AI-assisted source-file location (see
    // gemini.service.js), independent of `provider` above — Gemini's large
    // context window lets it look at far more candidate files at once than
    // the primary fix-writing model, which matters more for "which of these
    // 40 files is this DOM element in" than for writing a patch.
    gemini: {
      apiKey: process.env.GEMINI_API_KEY || "",
      model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
    },
  },

  // Email invites are optional. Without RESEND_API_KEY, invites still work —
  // the API response includes the raw invite link instead of sending it.
  email: {
    resendApiKey: process.env.RESEND_API_KEY || "",
    fromAddress: process.env.EMAIL_FROM || "onboarding@resend.dev",
    frontendUrl: process.env.FRONTEND_URL || "http://localhost:3000",
  },

  // GitHub is optional. Needed only for real PR creation + Actions dispatch.
  github: {
    token: process.env.GITHUB_TOKEN || "",
    repo: process.env.GITHUB_REPO || "", // "owner/name"
    baseBranch: process.env.GITHUB_BASE_BRANCH || "main",
    workflow: process.env.GITHUB_WORKFLOW || "", // e.g. "qa.yml" (optional)
  },
};
