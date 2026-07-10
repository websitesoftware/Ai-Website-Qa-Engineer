/**
 * Minimal, real GitHub REST client (native fetch, no new dependency).
 *
 * Used to turn a QA remediation report into an actual pull request, and to
 * trigger / poll a real GitHub Actions workflow as the CI/CD gate.
 *
 * Everything is gated on config.github.token + config.github.repo. When those
 * aren't set, `isConfigured()` is false and callers surface an honest
 * "not connected" state instead of fabricating a PR URL.
 */

const config = require("../config/config");

const API = "https://api.github.com";

function isConfigured() {
  return Boolean(config.github.token && config.github.repo);
}

function repoParts() {
  const [owner, repo] = (config.github.repo || "").split("/");
  return { owner, repo };
}

async function gh(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${config.github.token}`,
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
    const msg = body?.message || `GitHub ${res.status}`;
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
}) {
  const { owner, repo } = repoParts();
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
async function dispatchWorkflow(inputs = {}) {
  const { owner, repo } = repoParts();
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

async function getRun(runId) {
  const { owner, repo } = repoParts();
  const run = await gh(`/repos/${owner}/${repo}/actions/runs/${runId}`);
  return {
    runId: run.id,
    url: run.html_url,
    status: run.status, // queued | in_progress | completed
    conclusion: run.conclusion, // success | failure | null
  };
}

module.exports = {
  isConfigured,
  openRemediationPR,
  dispatchWorkflow,
  getRun,
};
