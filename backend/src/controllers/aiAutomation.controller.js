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

module.exports = { getStatus, run, createPr, cicd };
