/**
 * Small shared wrapper around the local `git` binary. Used by github.service
 * (to auto-resolve the token/repo of this app's own project) and by
 * repoRegistry.service (to identify sibling project repos on disk) without
 * duplicating the same child_process plumbing in both places.
 */

const { execFileSync } = require("child_process");

function run(cwd, args) {
  try {
    return execFileSync("git", args, {
      cwd,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}

/** Ask the OS's git credential helper for a host's token (Git Credential Manager / Keychain / libsecret). */
function credentialFillToken(host = "github.com") {
  try {
    const out = execFileSync("git", ["credential", "fill"], {
      input: `protocol=https\nhost=${host}\n\n`,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "ignore"],
    });
    const match = out.match(/^password=(.*)$/m);
    return match ? match[1].trim() : null;
  } catch {
    return null;
  }
}

/** Parse "owner/repo" out of a GitHub remote URL (https, ssh, or with/without .git). */
function parseOwnerRepo(remoteUrl) {
  if (!remoteUrl) return null;
  const match = remoteUrl.match(/github\.com[:/]+([^/]+)\/(.+?)(\.git)?$/i);
  return match ? `${match[1]}/${match[2]}` : null;
}

/** "owner/repo" for the git repo checked out at `cwd`, or null if not a GitHub remote. */
function getGithubRepoSlug(cwd) {
  return parseOwnerRepo(run(cwd, ["config", "--get", "remote.origin.url"]));
}

module.exports = { run, credentialFillToken, parseOwnerRepo, getGithubRepoSlug };
