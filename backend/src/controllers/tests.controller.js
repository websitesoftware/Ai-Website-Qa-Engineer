const testsRepo = require("../repositories/tests.repository");
const { createTest } = require("../models/test.model");
const { enqueueScan } = require("../services/queue.service");

function isValidUrl(str) {
  try {
    const u = new URL(str);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

async function create(req, res) {
  const { url, name, maxPages, maxDepth, device } = req.body || {};

  if (!url || !isValidUrl(url)) {
    return res.status(400).json({ error: "A valid `url` (http/https) is required." });
  }

  const test = createTest({ url, name, options: { maxPages, maxDepth, device } });
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

  if (typeof req.body.resolved === "boolean") issue.resolved = req.body.resolved;

  const updated = await testsRepo.update(test.id, { issues: test.issues });
  res.json(updated.issues.find((i) => i.id === req.params.issueId));
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

module.exports = { create, list, getOne, remove, getIssues, updateIssue, rerun };
