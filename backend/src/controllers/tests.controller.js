const crypto = require("crypto");
const { v4: uuidv4 } = require("uuid");
const testsRepo = require("../repositories/tests.repository");
const usersRepo = require("../repositories/users.repository");
const policiesRepo = require("../repositories/policies.repository");
const { createTest } = require("../models/test.model");
const { enqueueScan } = require("../services/queue.service");
const mailer = require("../services/mailer.service");
const config = require("../config/config");
const logger = require("../utils/logger");

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// Assigning a ticket to someone shouldn't require team-admin rights (unlike
// POST /team/invite) — any logged-in user can point a ticket at an email.
// Reuses the account if one exists; otherwise creates a pending-invite stub
// so the issue has a real assignee id, and emails them a heads-up (best-effort).
async function resolveAssigneeByEmail(email, invitedBy) {
  const existing = usersRepo.findByEmail(email);
  if (existing) return existing;

  const rawToken = crypto.randomBytes(32).toString("hex");
  const inviteTokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  const created = await usersRepo.createInvite({
    email,
    role: "viewer",
    invitedBy: invitedBy || null,
    inviteTokenHash,
    inviteTokenExpire: Date.now() + INVITE_TTL_MS,
  });

  const inviter = invitedBy ? usersRepo.getById(invitedBy) : null;
  const inviteLink = `${config.email.frontendUrl}/accept-invite?token=${rawToken}`;
  mailer
    .sendInviteEmail(email, inviteLink, inviter ? inviter.name : "A teammate", "viewer")
    .catch((err) => logger.warn("tests", `Could not send assignment invite email: ${err.message}`));

  return created;
}

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
 * Assigns a ticket straight from an email address — deliberately not behind
 * `protect`. The ticket page's "paste an email, assign it" box needs to work
 * even when nobody is logged in in that browser tab; this is a low-stakes
 * convenience action (tagging a ticket with who owns it), not a security-
 * sensitive one, so it doesn't need a session the way editing scan config or
 * team management does.
 */
async function assignByEmail(req, res) {
  const test = testsRepo.get(req.params.id);
  if (!test) return res.status(404).json({ error: "Test not found" });

  const issue = (test.issues || []).find((i) => i.id === req.params.issueId);
  if (!issue) return res.status(404).json({ error: "Issue not found" });

  const email = String((req.body && req.body.assigneeEmail) || "").trim().toLowerCase();
  if (!email) return res.status(400).json({ error: "assigneeEmail is required" });

  const assignee = await resolveAssigneeByEmail(email, req.user && req.user.sub);
  issue.assigneeIds = Array.isArray(issue.assigneeIds) ? issue.assigneeIds : [];
  if (!issue.assigneeIds.includes(assignee.id)) {
    issue.assigneeIds = [...issue.assigneeIds, assignee.id];
  }

  const updated = await testsRepo.update(test.id, { issues: test.issues });
  res.json(updated.issues.find((i) => i.id === req.params.issueId));
}

/**
 * Full-replace of an issue's assignee list — public for the same reason as
 * assignByEmail above: the ticket page's assignee chips (add/remove) need to
 * work without a login session in that tab.
 */
async function setAssignees(req, res) {
  const test = testsRepo.get(req.params.id);
  if (!test) return res.status(404).json({ error: "Test not found" });

  const issue = (test.issues || []).find((i) => i.id === req.params.issueId);
  if (!issue) return res.status(404).json({ error: "Issue not found" });

  if (!Array.isArray(req.body.assigneeIds)) {
    return res.status(400).json({ error: "assigneeIds must be an array" });
  }
  const validIds = new Set(usersRepo.list().map((u) => u.id));
  issue.assigneeIds = req.body.assigneeIds.filter((id) => validIds.has(id));

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

  // Comments work without a login session (this route isn't behind
  // `protect`) — an anonymous commenter identifies themselves by email
  // instead, same convention as assign-by-email. If that email belongs to
  // a real account, show that account's name too; otherwise the email
  // itself is the only identity shown.
  const author = req.user ? usersRepo.getById(req.user.sub) : null;
  const authorEmail = String((req.body && req.body.authorEmail) || "").trim().toLowerCase();
  const emailUser = !author && authorEmail ? usersRepo.findByEmail(authorEmail) : null;

  if (!Array.isArray(issue.comments)) issue.comments = [];
  issue.comments.push({
    id: uuidv4(),
    authorId: author ? author.id : emailUser ? emailUser.id : null,
    authorName: author ? author.name : emailUser && emailUser.name ? emailUser.name : authorEmail || "Unknown",
    authorEmail: author ? author.email : authorEmail || null,
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
  assignByEmail,
  setAssignees,
  deleteIssue,
  addIssueComment,
  rerun,
};
