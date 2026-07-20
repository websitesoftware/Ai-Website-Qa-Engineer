const aiAutomation = require("../services/aiAutomation.service");

/**
 * GET /api/ai-automation/status?testId=...
 * Backwards-compatible with the frontend's original fetch. Runs the analysis
 * pipeline against the given (or latest completed) test and returns real data.
 */
async function getStatus(req, res, next) {
  try {
    const result = await aiAutomation.runAutomation(req.query.testId);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/ai-automation/run   body: { testId? }
 * Same as status but via POST (used by the "Run pipeline" button).
 */
async function run(req, res, next) {
  try {
    const result = await aiAutomation.runAutomation(req.body?.testId);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/ai-automation/pr   body: { testId? }
 * Opens a real pull request on the configured GitHub repo (or reports that
 * GitHub isn't connected).
 */
async function createPr(req, res, next) {
  try {
    const result = await aiAutomation.createPullRequest(req.body?.testId);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/ai-automation/cicd   body: { testId? }
 * Runs the CI/CD quality gate (real scan-derived summary + optional Actions run).
 */
async function cicd(req, res, next) {
  try {
    const result = await aiAutomation.runCicd(req.body?.testId);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/ai-automation/merge   body: { prNumber, repo? }
 * App-level approval gate: merges only if the PR has >=1 approving review
 * and no pending changes-requested (the free-plan substitute for GitHub's
 * native required-review branch protection). `repo` ("owner/repo") should be
 * the same repo the PR was opened in, as returned by /ai-automation/pr.
 */
async function merge(req, res, next) {
  try {
    const prNumber = req.body?.prNumber;
    if (!prNumber) return res.status(400).json({ error: "prNumber is required" });
    const result = await aiAutomation.mergePullRequest(prNumber, req.body?.repo);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/ai-automation/analyze-issue   body: { pastedText }
 * The "paste an issue, get a PR" flow: recovers the issue (from an embedded
 * testId/issueId reference when copied via IssuesPage, or best-effort free-
 * text parsing otherwise), runs the same prioritize -> RCA -> fix pipeline as
 * a real scan, auto-detects the target repo from the issue's URL, and opens
 * a real PR — all in one request.
 */
async function analyzeIssue(req, res, next) {
  try {
    const pastedText = req.body?.pastedText;
    if (!pastedText || !String(pastedText).trim()) {
      return res.status(400).json({ error: "pastedText is required" });
    }
    const result = await aiAutomation.analyzePastedIssue(pastedText);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/ai-automation/locate?testId=...&issueId=...
 * Read-only: resolves the local repo file + line an issue lives in without
 * running the full pipeline (no LLM call, no PR) — powers the "file to
 * modify" hint shown on the issue detail panel.
 */
async function locate(req, res, next) {
  try {
    const { testId, issueId } = req.query;
    if (!testId || !issueId) {
      return res.status(400).json({ error: "testId and issueId are required" });
    }
    const result = await aiAutomation.locateIssue(testId, issueId);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = { getStatus, run, createPr, cicd, merge, analyzeIssue, locate };
