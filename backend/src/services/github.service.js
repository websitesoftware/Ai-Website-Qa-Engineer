/**
 * Minimal, real GitHub REST client (native fetch, no new dependency).
 *
 * Used to turn a QA remediation report into an actual pull request, and to
 * trigger / poll a real GitHub Actions workflow as the CI/CD gate.
 *
 * Zero manual setup by default: the token and the target repo are both
 * auto-resolved from the local git installation —
 *   - token:  pulled from the OS's git credential store (Git Credential
 *             Manager / macOS Keychain / libsecret — whatever `git push`
 *             already authenticates with on this machine). No new OAuth
 *             prompt is ever shown; it reuses the login that's already there.
 *   - repo:   parsed from `git remote get-url origin` in the project.
 * GITHUB_TOKEN / GITHUB_REPO in .env still work and take priority, for
 * environments with no local git identity (e.g. a headless server deploy).
 */

const path = require("path");
const config = require("../config/config");
const logger = require("../utils/logger");
const gitLocal = require("../utils/gitLocal");

const API = "https://api.github.com";
const REPO_ROOT = path.resolve(__dirname, "..", "..", "..");

let cachedToken = null;
let cachedRepo = null;

function resolveToken() {
  if (config.github.token) return config.github.token;
  if (!cachedToken) cachedToken = gitLocal.credentialFillToken("github.com");
  return cachedToken;
}

/** Default repo (this app's own), used when a caller doesn't pass an override. */
function resolveRepo() {
  if (config.github.repo) return config.github.repo;
  if (!cachedRepo) cachedRepo = gitLocal.getGithubRepoSlug(REPO_ROOT);
  return cachedRepo;
}

function isConfigured() {
  return Boolean(resolveRepo() && resolveToken());
}

/**
 * @param {string} [repoOverride] "owner/repo" (or full GitHub URL) for a
 *   specific repo, e.g. one matched by repoRegistry.matchRepoForUrl(). Falls
 *   back to this app's own configured/detected repo when omitted.
 */
function repoParts(repoOverride) {
  const raw = (repoOverride || resolveRepo() || "")
    .trim()
    .replace(/^https?:\/\/(www\.)?github\.com\//i, "")
    .replace(/\.git$/i, "")
    .replace(/^\/+|\/+$/g, "");
  const [owner, repo] = raw.split("/");
  return { owner, repo };
}

async function gh(path, options = {}, _retriedAuth = false) {
  const token = resolveToken();
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${token}`,
      "x-github-api-version": "2022-11-28",
      "content-type": "application/json",
      "user-agent": "ai-website-qa-engineer",
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!res.ok) {
    // The credential-manager token may have rotated; re-fetch once before failing.
    if (res.status === 401 && !_retriedAuth && !config.github.token) {
      logger.warn("github", "Token rejected, re-resolving from git credential store...");
      cachedToken = null;
      return gh(path, options, true);
    }
    // GitHub often puts the actionable detail in errors[], not the generic
    // top-level message (e.g. message: "Validation Failed", errors: [{message:
    // "A pull request already exists for owner:branch"}]) — surface that too.
    const detail = Array.isArray(body?.errors)
      ? body.errors.map((e) => e.message).filter(Boolean).join("; ")
      : "";
    const msg = [body?.message, detail].filter(Boolean).join(": ") || `GitHub ${res.status}`;
    throw new Error(`GitHub API ${res.status}: ${msg}`);
  }
  return body;
}

/** Base64 that also handles UTF-8 correctly. */
function toBase64(str) {
  return Buffer.from(str, "utf-8").toString("base64");
}

/**
 * Create a branch off the base branch, write a single file, and open a PR.
 * Returns { branchName, prTitle, prUrl, prNumber, status: 'Open' }.
 */
async function openRemediationPR({
  branchName,
  filePath,
  fileContent,
  prTitle,
  prBody,
  repo: repoOverride,
}) {
  const { owner, repo } = repoParts(repoOverride);
  const base = config.github.baseBranch;

  // 1. Get the base branch's latest commit SHA.
  const ref = await gh(`/repos/${owner}/${repo}/git/ref/heads/${base}`);
  const baseSha = ref.object.sha;

  // 2. Create the new branch (ignore "already exists" so re-runs don't crash).
  try {
    await gh(`/repos/${owner}/${repo}/git/refs`, {
      method: "POST",
      body: JSON.stringify({ ref: `refs/heads/${branchName}`, sha: baseSha }),
    });
  } catch (err) {
    if (!/already exists/i.test(err.message)) throw err;
  }

  // 3. Create or update the report file on that branch.
  let existingSha;
  try {
    const existing = await gh(
      `/repos/${owner}/${repo}/contents/${encodeURIComponent(filePath)}?ref=${branchName}`,
    );
    existingSha = existing.sha;
  } catch {
    /* file doesn't exist yet — fine */
  }

  await gh(`/repos/${owner}/${repo}/contents/${encodeURIComponent(filePath)}`, {
    method: "PUT",
    body: JSON.stringify({
      message: prTitle,
      content: toBase64(fileContent),
      branch: branchName,
      ...(existingSha ? { sha: existingSha } : {}),
    }),
  });

  // 4. Open the PR (reuse the existing one if it's already open).
  try {
    const pr = await gh(`/repos/${owner}/${repo}/pulls`, {
      method: "POST",
      body: JSON.stringify({
        title: prTitle,
        head: branchName,
        base,
        body: prBody,
      }),
    });
    return {
      branchName,
      prTitle,
      prUrl: pr.html_url,
      prNumber: pr.number,
      status: "Open",
    };
  } catch (err) {
    if (/A pull request already exists/i.test(err.message)) {
      const list = await gh(
        `/repos/${owner}/${repo}/pulls?head=${owner}:${branchName}&state=open`,
      );
      if (list[0]) {
        return {
          branchName,
          prTitle,
          prUrl: list[0].html_url,
          prNumber: list[0].number,
          status: "Open",
        };
      }
    }
    throw err;
  }
}

/** Dispatch a workflow_dispatch run. Requires config.github.workflow. */
async function dispatchWorkflow(inputs = {}, repoOverride) {
  const { owner, repo } = repoParts(repoOverride);
  const workflow = config.github.workflow;
  if (!workflow) throw new Error("GITHUB_WORKFLOW is not configured");

  await gh(
    `/repos/${owner}/${repo}/actions/workflows/${encodeURIComponent(workflow)}/dispatches`,
    {
      method: "POST",
      body: JSON.stringify({ ref: config.github.baseBranch, inputs }),
    },
  );

  // Give GitHub a moment, then grab the most recent run for this workflow.
  await new Promise((r) => setTimeout(r, 2500));
  const runs = await gh(
    `/repos/${owner}/${repo}/actions/workflows/${encodeURIComponent(workflow)}/runs?per_page=1`,
  );
  const run = runs.workflow_runs?.[0];
  return run
    ? {
        runId: run.id,
        url: run.html_url,
        status: run.status,
        conclusion: run.conclusion,
      }
    : null;
}

async function getRun(runId, repoOverride) {
  const { owner, repo } = repoParts(repoOverride);
  const run = await gh(`/repos/${owner}/${repo}/actions/runs/${runId}`);
  return {
    runId: run.id,
    url: run.html_url,
    status: run.status, // queued | in_progress | completed
    conclusion: run.conclusion, // success | failure | null
  };
}

/**
 * App-level substitute for GitHub's native branch-protection "required
 * reviews" gate, which GitHub disables for private repos below the Pro
 * plan. Reduces a PR's reviews to each reviewer's latest verdict and
 * reports whether it's safe to merge.
 */
async function getReviewDecision(prNumber, repoOverride) {
  const { owner, repo } = repoParts(repoOverride);
  const reviews = await gh(`/repos/${owner}/${repo}/pulls/${prNumber}/reviews`);

  const latestByUser = new Map();
  for (const r of reviews) {
    if (!r.user?.login || !r.submitted_at) continue;
    const prev = latestByUser.get(r.user.login);
    if (!prev || new Date(r.submitted_at) >= new Date(prev.submitted_at)) {
      latestByUser.set(r.user.login, r);
    }
  }
  const verdicts = [...latestByUser.values()];
  const approvals = verdicts.filter((r) => r.state === "APPROVED");
  const changesRequested = verdicts.filter(
    (r) => r.state === "CHANGES_REQUESTED",
  );

  return {
    approved: approvals.length > 0 && changesRequested.length === 0,
    approvalCount: approvals.length,
    changesRequestedCount: changesRequested.length,
    reviewers: verdicts.map((r) => ({ login: r.user.login, state: r.state })),
  };
}

/** Merge a PR — callers MUST have already checked getReviewDecision(). */
async function mergePullRequest(prNumber, repoOverride) {
  const { owner, repo } = repoParts(repoOverride);
  const result = await gh(`/repos/${owner}/${repo}/pulls/${prNumber}/merge`, {
    method: "PUT",
    body: JSON.stringify({ merge_method: "squash" }),
  });
  return { merged: Boolean(result.merged), sha: result.sha, message: result.message };
}

module.exports = {
  isConfigured,
  openRemediationPR,
  dispatchWorkflow,
  getRun,
  getReviewDecision,
  mergePullRequest,
};
