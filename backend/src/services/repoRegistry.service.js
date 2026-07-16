/**
 * Multi-repo detection: figures out which local repo a scanned URL actually
 * belongs to, so PR generation targets the right project instead of always
 * this QA engine's own repo.
 *
 * There's no public API for "which folders does VS Code have open right
 * now", but VS Code itself keeps a real, read-only record for crash
 * recovery: `backupWorkspaces.folders` in its own
 * `%APPDATA%/Code/User/globalStorage/storage.json`. Every folder open in any
 * window (this app's own, or any other project) shows up there. This module
 * reads that file, plus a couple of fixed fallback roots, expands each
 * folder to the git repos it contains (itself, or its immediate
 * subfolders — VS Code is often opened on a parent folder containing
 * several projects), and matches a scanned URL against them by:
 *   - hostname, from each repo's package.json "homepage" or a
 *     SITE_URL/APP_URL-style .env key (for real domains),
 *   - which repo's dev server is *actually* listening on the URL's port
 *     right now (netstat -> owning PID -> that process's command line,
 *     which for `next dev`/`vite` etc. includes the project path) — this is
 *     what survives a dev server auto-incrementing off its usual port,
 *   - the URL path's first segment against each repo's folder name (e.g.
 *     Live Server serving http://127.0.0.1:5501/my-repo/index.html from a
 *     parent workspace folder), or
 *   - a static guess at the dev-server port from each repo's `npm run dev`
 *     script, as a last resort when the live-process lookup isn't available.
 * If nothing matches (or more than one candidate matches equally), it
 * reports "unmatched" rather than guessing — in particular it never
 * silently falls back to this QA engine's own repo just because it's one of
 * the candidates. (An earlier version did that, which meant a scan of some
 * unrelated site — e.g. a LAN IP with no matching repo — would silently
 * open a PR against this app's own codebase. Same "don't fabricate
 * confidence" principle the rest of this engine follows.)
 */

const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");
const gitLocal = require("../utils/gitLocal");

const PROJECT_ROOT = path.resolve(__dirname, "..", "..", "..");
const SCAN_ROOT = process.env.REPO_SCAN_ROOT
  ? path.resolve(process.env.REPO_SCAN_ROOT)
  : path.resolve(PROJECT_ROOT, "..");

// Where an app's real config tends to live relative to a repo's root.
const SUBDIRS = ["", "frontend", "client", "web", "app"];

const ENV_URL_KEYS = [
  "SITE_URL",
  "APP_URL",
  "PUBLIC_URL",
  "BASE_URL",
  "NEXT_PUBLIC_SITE_URL",
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_BASE_URL",
  "VITE_SITE_URL",
  "VITE_APP_URL",
  "REACT_APP_SITE_URL",
  "REACT_APP_URL",
];

function isGitRepo(dir) {
  try {
    return fs.statSync(path.join(dir, ".git")).isDirectory();
  } catch {
    return false;
  }
}

/** "file:///c%3A/Users/x/foo" -> "C:\Users\x\foo" (Windows); passes non-file:// paths through. */
function decodeFolderUri(uri) {
  if (!uri) return null;
  if (!uri.startsWith("file://")) return uri;
  const p = decodeURIComponent(uri.replace(/^file:\/\/\/?/, ""));
  return path.normalize(p);
}

/** Folders VS Code currently has open (any window) — read from its own crash-recovery state. */
function vsCodeOpenFolders() {
  const bases = [
    path.join(os.homedir(), "AppData", "Roaming", "Code"),
    path.join(os.homedir(), "AppData", "Roaming", "Code - Insiders"),
  ];
  const folders = new Set();
  for (const base of bases) {
    const storageFile = path.join(base, "User", "globalStorage", "storage.json");
    const data = readJsonSafe(storageFile);
    const backup = data?.backupWorkspaces;
    if (!backup) continue;
    for (const f of backup.folders || []) {
      const p = decodeFolderUri(f.folderUri);
      if (p) folders.add(p);
    }
    for (const w of backup.workspaces || []) {
      const p = decodeFolderUri(w.configURIPath || w.configPath);
      if (p) folders.add(path.dirname(p)); // workspace file -> its containing folder
    }
  }
  return [...folders];
}

/** Expand a folder to the git repo(s) it represents: itself, or its immediate git subfolders. */
function expandToRepoPaths(folder) {
  if (isGitRepo(folder)) return [folder];
  let entries;
  try {
    entries = fs.readdirSync(folder, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries
    .filter((e) => e.isDirectory())
    .map((e) => path.join(folder, e.name))
    .filter(isGitRepo);
}

/** Case-insensitive dedup key for a Windows path, while keeping the original casing for display/fs use. */
function pathKey(p) {
  return path.normalize(p).toLowerCase();
}

function listAllRepoPaths() {
  const roots = [SCAN_ROOT, ...vsCodeOpenFolders()];
  const byKey = new Map();
  for (const root of roots) {
    for (const repoPath of expandToRepoPaths(root)) {
      const key = pathKey(repoPath);
      if (!byKey.has(key)) byKey.set(key, path.normalize(repoPath));
    }
  }
  return [...byKey.values()];
}

function readJsonSafe(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf-8"));
  } catch {
    return null;
  }
}

function readEnvSafe(file) {
  try {
    const out = {};
    for (const line of fs.readFileSync(file, "utf-8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/i);
      if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
    return out;
  } catch {
    return null;
  }
}

function hostnameOf(rawUrl) {
  try {
    return new URL(rawUrl).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return null;
  }
}

// RFC1918 private ranges + loopback/link-local — a scan against any of these
// is still "this dev machine" (e.g. testing from a phone over Wi-Fi via
// http://192.168.1.5:3000), so it should get the same port-based matching as
// localhost, not be treated as an unrelated real-world domain.
const LOCAL_HOST_PATTERNS = [
  /^localhost$/i,
  /^0\.0\.0\.0$/,
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^169\.254\./,
  /^\[?::1\]?$/,
];

function isLocalAddress(hostname) {
  return LOCAL_HOST_PATTERNS.some((re) => re.test(hostname));
}

function collectHostnames(repoPath) {
  const hostnames = new Set();
  for (const sub of SUBDIRS) {
    const dir = path.join(repoPath, sub);
    const pkg = readJsonSafe(path.join(dir, "package.json"));
    const fromHomepage = pkg?.homepage && hostnameOf(pkg.homepage);
    if (fromHomepage) hostnames.add(fromHomepage);

    for (const envFile of [".env", ".env.local", ".env.production"]) {
      const env = readEnvSafe(path.join(dir, envFile));
      if (!env) continue;
      for (const key of ENV_URL_KEYS) {
        const host = env[key] && hostnameOf(env[key]);
        if (host) hostnames.add(host);
      }
    }
  }
  return [...hostnames];
}

function detectDevPort(repoPath) {
  for (const sub of SUBDIRS) {
    const pkg = readJsonSafe(path.join(repoPath, sub, "package.json"));
    const devScript = pkg?.scripts?.dev || pkg?.scripts?.start;
    if (!devScript) continue;
    const explicit =
      devScript.match(/(?:-p|--port)[= ]?(\d{2,5})/i) ||
      devScript.match(/PORT=(\d{2,5})/);
    if (explicit) return Number(explicit[1]);
    if (/next/i.test(devScript)) return 3000;
    if (/vite/i.test(devScript)) return 5173;
  }
  return null;
}

/**
 * Ask the OS which process is actually listening on `port` right now, and
 * return its full command line. This is what makes port-based matching work
 * even when a dev server auto-incremented off its usual port (e.g. Next.js
 * falling back to 3001 because 3000 was already taken by another repo) —
 * instead of guessing a port from package.json, it asks the real, current
 * state of the machine. Windows-only (netstat/CIM); returns null elsewhere
 * or if anything about the lookup fails, so callers just fall back to the
 * weaker static-port heuristic.
 */
function commandLineOfProcessListeningOnPort(port) {
  if (process.platform !== "win32") return null;
  try {
    const netstatOut = execFileSync("netstat", ["-ano", "-p", "tcp"], {
      encoding: "utf-8",
      windowsHide: true,
    });
    let pid = null;
    for (const line of netstatOut.split("\n")) {
      const m = line.match(/^\s*TCP\s+\S*:(\d+)\s+\S+\s+LISTENING\s+(\d+)/i);
      if (m && Number(m[1]) === port) {
        pid = Number(m[2]);
        break;
      }
    }
    if (!pid) return null;

    const cmdLine = execFileSync(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        `(Get-CimInstance Win32_Process -Filter "ProcessId=${pid}").CommandLine`,
      ],
      { encoding: "utf-8", windowsHide: true },
    ).trim();
    return cmdLine || null;
  } catch {
    return null;
  }
}

/** Which candidate repo (if exactly one) is the dev server actually listening on `port`. */
function findRepoActuallyServingPort(port, candidates) {
  const cmdLine = commandLineOfProcessListeningOnPort(port);
  if (!cmdLine) return null;
  const lower = cmdLine.toLowerCase();
  const matches = candidates.filter((c) => lower.includes(c.path.toLowerCase()));
  return matches.length === 1 ? matches[0] : null;
}

function getRepoIdentity(repoPath) {
  return {
    path: repoPath,
    name: path.basename(repoPath),
    githubRepo: gitLocal.getGithubRepoSlug(repoPath),
    hostnames: collectHostnames(repoPath),
    devPort: detectDevPort(repoPath),
  };
}

/** All repos this process can see — from VS Code's open folders plus SCAN_ROOT — with their identifying signals. */
function discoverRepos() {
  return listAllRepoPaths().map(getRepoIdentity);
}

/** Shape returned when no repo could be confidently identified. */
function unmatched(candidates, reason) {
  return {
    path: null,
    name: null,
    githubRepo: null,
    hostnames: [],
    devPort: null,
    matchedBy: reason, // "unmatched" | "ambiguous_hostname" | "ambiguous_port" | "invalid_url"
    candidates,
  };
}

/**
 * Match a scanned test URL to the local repo it most likely belongs to.
 * Returns an "unmatched" result (githubRepo: null) rather than guessing when
 * there's no confident signal — callers must treat that as "can't determine
 * the target repo," not silently fall back to any particular one.
 */
function matchRepoForUrl(url) {
  const candidates = discoverRepos();

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return unmatched(candidates, "invalid_url");
  }

  const hostname = parsed.hostname.replace(/^www\./i, "").toLowerCase();

  // Hostname match applies regardless of local/public — a repo can declare
  // SITE_URL=http://192.168.1.5:3000 for LAN testing just as validly as a
  // real domain.
  const hostMatches = candidates.filter((c) => c.hostnames.includes(hostname));
  if (hostMatches.length === 1) {
    return { ...hostMatches[0], matchedBy: "hostname", candidates };
  }
  if (hostMatches.length > 1) {
    return unmatched(candidates, "ambiguous_hostname");
  }

  if (!isLocalAddress(hostname)) {
    return unmatched(candidates, "unmatched");
  }

  const port = Number(parsed.port) || 80;

  // Ask the OS which repo's dev server is *actually* listening on this port
  // right now — handles the common case of a dev server auto-incrementing
  // off its usual port (Next.js falling back to 3001+ because 3000 was
  // already taken), which a static "package.json says 3000" guess can't.
  const liveMatch = findRepoActuallyServingPort(port, candidates);
  if (liveMatch) {
    return { ...liveMatch, matchedBy: "live-port", candidates };
  }

  // Live Server (and similar) often serve a parent folder, so the URL path's
  // first segment is literally the project's folder name, e.g.
  // http://127.0.0.1:5501/my-repo/index.html — a stronger signal than a
  // static port guess, which many local dev servers share by default.
  const firstSegment = parsed.pathname.split("/").filter(Boolean)[0];
  if (firstSegment) {
    const nameMatches = candidates.filter(
      (c) => c.name.toLowerCase() === firstSegment.toLowerCase(),
    );
    if (nameMatches.length === 1) {
      return { ...nameMatches[0], matchedBy: "url-path", candidates };
    }
  }

  const portMatches = candidates.filter((c) => c.devPort === port);
  if (portMatches.length === 1) {
    return { ...portMatches[0], matchedBy: "port", candidates };
  }
  if (portMatches.length > 1) {
    return unmatched(candidates, "ambiguous_port");
  }
  return unmatched(candidates, "unmatched");
}

module.exports = { discoverRepos, matchRepoForUrl, SCAN_ROOT };
