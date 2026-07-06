// const { v4: uuidv4 } = require("uuid");

// /**
//  * Shape of a "Test" (a single QA scan run against one URL).
//  * This is the object the frontend dashboard (StatCard, TestsTable,
//  * TestPipeline, UnresolvedIssues, TestManagementPage) is expected to consume.
//  */
// function createTest({ url, name, options = {} }) {
//   const now = new Date().toISOString();
//   return {
//     id: uuidv4(),
//     name: name || url,
//     url,
//     status: "queued", // queued | running | passed | failed | error
//     progress: 0, // 0-100, updated as scan stages complete
//     currentStage: null, // crawling | responsive | links | console | lighthouse | done
//     score: null, // overall QA score 0-100, filled when completed
//     scores: {
//       performance: null,
//       accessibility: null,
//       seo: null,
//       bestPractices: null,
//     },
//     pagesScanned: 0,
//     issues: [], // array of issue objects, see issueDetector.service.js
//     brokenLinks: [],
//     consoleErrors: [],
//     screenshots: [], // [{ viewport, path, url }]
//     options: {
//       maxPages: options.maxPages,
//       maxDepth: options.maxDepth,
//       device: options.device || "all",
//     },
//     createdAt: now,
//     startedAt: null,
//     completedAt: null,
//     error: null,
//   };
// }

// module.exports = { createTest };
const { v4: uuidv4 } = require("uuid");

/**
 * Shape of a "Test" (a single QA scan run against one URL).
 * Phase 1 fields are unchanged. Phase 2 fields are always present but stay
 * empty/null unless the matching module was selected in `options.modules`.
 */
function createTest({ url, name, options = {} }) {
  const now = new Date().toISOString();
  return {
    id: uuidv4(),
    name: name || url,
    url,
    status: "queued", // queued | running | passed | failed | error
    progress: 0,
    currentStage: null,
    score: null,
    scores: {
      performance: null,
      accessibility: null,
      seo: null,
      bestPractices: null,
    },
    metrics: {
      firstContentfulPaint: null,
      largestContentfulPaint: null,
      totalBlockingTime: null,
      cumulativeLayoutShift: null,
      speedIndex: null,
      timeToInteractive: null,
    },
    pagesScanned: 0,
    issues: [],
    brokenLinks: [],
    consoleErrors: [],
    screenshots: [],

    // ---- Phase 2: Intelligent QA (populated only for selected modules) ----
    accessibility: { violations: [], passes: 0, incomplete: 0 },
    seo: { checks: [], score: null },
    visualRegression: [],
    crossBrowser: [],
    performanceBenchmark: null,

    options: {
      maxPages: options.maxPages,
      maxDepth: options.maxDepth,
      device: options.device || "all",
      // e.g. ["accessibility","seo","visual-regression","cross-browser","performance-benchmark"]
      modules: options.modules || [],
    },
    createdAt: now,
    startedAt: null,
    completedAt: null,
    error: null,
  };
}

module.exports = { createTest };
