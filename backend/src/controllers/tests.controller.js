const { v4: uuidv4 } = require("uuid");
const testsRepo = require("../repositories/tests.repository");
const usersRepo = require("../repositories/users.repository");
const policiesRepo = require("../repositories/policies.repository");
const { createTest } = require("../models/test.model");
const { enqueueScan } = require("../services/queue.service");

const VALID_MODULES = [
  "accessibility",
  "seo",
  "visual-regression",
  "cross-browser",
  "performance-benchmark",
];

const VALID_SEVERITIES = ["critical", "high", "medium", "low"];
const VALID_ISSUE_CATEGORIES = [
  "broken-link",
  "console-error",
  "cross-browser",
  "accessibility",
  "lighthouse",
  "visual-regression",
  "seo",
];

function isValidUrl(str) {
  try {
    const u = new URL(str);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

async function create(req, res) {
  const { url, name, maxPages, maxDepth, device, modules, policyId } = req.body || {};

  if (!url || !isValidUrl(url)) {
    return res
      .status(400)
      .json({ error: "A valid `url` (http/https) is required." });
  }

  const cleanModules = Array.isArray(modules)
    ? modules.filter((m) => VALID_MODULES.includes(m))
    : [];
  const cleanPolicyId = policyId && policiesRepo.get(policyId) ? policyId : null;

  const requester = req.user ? usersRepo.getById(req.user.sub) : null;

  const test = createTest({
    url,
    name,
    options: { maxPages, maxDepth, device, modules: cleanModules, policyId: cleanPolicyId },
    createdBy: requester ? requester.id : null,
    createdByName: requester ? requester.name : null,
  });
  await testsRepo.create(test);
  enqueueScan(test.id);

  res.status(201).json(test);
}

function list(req, res) {
  const { status, search } = req.query;
  const tests = testsRepo.list({ status, search });
  res.json(tests);
}

function getOne(req, res) {
  const test = testsRepo.get(req.params.id);
  if (!test) return res.status(404).json({ error: "Test not found" });
  res.json(test);
}

async function remove(req, res) {
  const ok = await testsRepo.remove(req.params.id);
  if (!ok) return res.status(404).json({ error: "Test not found" });
  res.status(204).send();
}

function getIssues(req, res) {
  const test = testsRepo.get(req.params.id);
  if (!test) return res.status(404).json({ error: "Test not found" });
  const { resolved } = req.query;
  let issues = test.issues || [];
  if (resolved === "false") issues = issues.filter((i) => !i.resolved);
  if (resolved === "true") issues = issues.filter((i) => i.resolved);
  res.json(issues);
}

async function updateIssue(req, res) {
  const test = testsRepo.get(req.params.id);
  if (!test) return res.status(404).json({ error: "Test not found" });

  const issue = (test.issues || []).find((i) => i.id === req.params.issueId);
  if (!issue) return res.status(404).json({ error: "Issue not found" });

  if (typeof req.body.resolved === "boolean")
    issue.resolved = req.body.resolved;

  if (Array.isArray(req.body.assigneeIds)) {
    // Full replace, filtered against real user ids — never let a stale or
    // made-up id get stuck on an issue as an "assignee".
    const validIds = new Set(usersRepo.list().map((u) => u.id));
    issue.assigneeIds = req.body.assigneeIds.filter((id) => validIds.has(id));
  }

  // Manual correction of what the AI/scan detected — e.g. re-titling,
  // reclassifying the category/severity, or rewriting the description —
  // used by the AI Automation page's "Edit issue" action.
  if (typeof req.body.title === "string" && req.body.title.trim()) {
    issue.title = req.body.title.trim();
  }
  if (typeof req.body.description === "string") {
    issue.description = req.body.description.trim();
  }
  if (typeof req.body.severity === "string" && VALID_SEVERITIES.includes(req.body.severity)) {
    issue.severity = req.body.severity;
  }
  if (typeof req.body.category === "string" && VALID_ISSUE_CATEGORIES.includes(req.body.category)) {
    issue.category = req.body.category;
  }

  const updated = await testsRepo.update(test.id, { issues: test.issues });
  res.json(updated.issues.find((i) => i.id === req.params.issueId));
}

/**
 * Permanently removes an issue from the test (not just marking it resolved)
 * — used by the AI Automation page's "Delete issue" action when the AI
 * misdetected something and the user wants it gone from prioritization
 * entirely, not just dismissed.
 */
async function deleteIssue(req, res) {
  const test = testsRepo.get(req.params.id);
  if (!test) return res.status(404).json({ error: "Test not found" });

  const exists = (test.issues || []).some((i) => i.id === req.params.issueId);
  if (!exists) return res.status(404).json({ error: "Issue not found" });

  const issues = (test.issues || []).filter((i) => i.id !== req.params.issueId);
  await testsRepo.update(test.id, { issues });
  res.status(204).send();
}

async function addIssueComment(req, res) {
  const test = testsRepo.get(req.params.id);
  if (!test) return res.status(404).json({ error: "Test not found" });

  const issue = (test.issues || []).find((i) => i.id === req.params.issueId);
  if (!issue) return res.status(404).json({ error: "Issue not found" });

  const { text } = req.body || {};
  if (!text || !text.trim()) {
    return res.status(400).json({ error: "Comment text is required" });
  }

  const author = req.user ? usersRepo.getById(req.user.sub) : null;
  if (!Array.isArray(issue.comments)) issue.comments = [];
  issue.comments.push({
    id: uuidv4(),
    authorId: author ? author.id : null,
    authorName: author ? author.name : "Unknown",
    text: text.trim(),
    createdAt: new Date().toISOString(),
  });

  const updated = await testsRepo.update(test.id, { issues: test.issues });
  res.status(201).json(updated.issues.find((i) => i.id === req.params.issueId));
}

async function rerun(req, res) {
  const test = testsRepo.get(req.params.id);
  if (!test) return res.status(404).json({ error: "Test not found" });

  const updated = await testsRepo.update(test.id, {
    status: "queued",
    progress: 0,
    currentStage: null,
    error: null,
    startedAt: null,
    completedAt: null,
  });
  enqueueScan(test.id);
  res.json(updated);
}

module.exports = {
  create,
  list,
  getOne,
  remove,
  getIssues,
  updateIssue,
  deleteIssue,
  addIssueComment,
  rerun,
};
