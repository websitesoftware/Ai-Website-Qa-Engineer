/**
 * Finds the real, on-disk source file (and exact literal snippet) that an
 * issue actually lives in, inside a repo that repoRegistry.service.js has
 * already matched to the scanned URL. This is what lets aiAutomation.service
 * generate a fix grounded in the real codebase instead of a guessed/generic
 * template — the whole point being: never fabricate a patch against code we
 * haven't actually read.
 *
 * Returns null (never a fuzzy/best-guess file) when no confident match is
 * found — callers must treat that as "can't ground this fix," not as license
 * to invent a location.
 */

const fs = require("fs");
const path = require("path");

const EXCLUDED_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  ".next",
  "out",
  "coverage",
  ".turbo",
  ".cache",
]);

const CANDIDATE_EXT = new Set([
  ".html",
  ".htm",
  ".jsx",
  ".tsx",
  ".js",
  ".ts",
  ".vue",
  ".svelte",
  ".astro",
  ".php",
  ".ejs",
  ".hbs",
]);

const MAX_FILES = 4000;
const MAX_FILE_BYTES = 1_000_000;

// A single "locate this issue" or "find first patchable issue" call can walk
// the same repo many times in a row (once per candidate issue) — caching the
// file list for a short window avoids re-walking a potentially large repo
// tree from scratch on every one of those, without risking a stale list
// across genuinely separate requests.
const CANDIDATE_CACHE_TTL_MS = 30_000;
const candidateCache = new Map(); // repoPath -> { files, expiresAt }

/** Depth-first walk of `repoPath`, returning candidate source file paths (capped, cached briefly). */
function listCandidateFiles(repoPath) {
  const cached = candidateCache.get(repoPath);
  if (cached && cached.expiresAt > Date.now()) return cached.files;

  const results = [];
  const stack = [repoPath];
  while (stack.length && results.length < MAX_FILES) {
    const dir = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (!EXCLUDED_DIRS.has(entry.name) && !entry.name.startsWith(".")) {
          stack.push(path.join(dir, entry.name));
        }
        continue;
      }
      if (CANDIDATE_EXT.has(path.extname(entry.name).toLowerCase())) {
        results.push(path.join(dir, entry.name));
        if (results.length >= MAX_FILES) break;
      }
    }
  }
  candidateCache.set(repoPath, { files: results, expiresAt: Date.now() + CANDIDATE_CACHE_TTL_MS });
  return results;
}

function readFileSafe(absPath) {
  try {
    const stat = fs.statSync(absPath);
    if (stat.size > MAX_FILE_BYTES) return null;
    return fs.readFileSync(absPath, "utf-8");
  } catch {
    return null;
  }
}

function lineOf(content, index) {
  return content.slice(0, index).split("\n").length;
}

/** Small, real context window (a few lines) around a literal match — the actual file text, verbatim. */
function contextAround(content, index, matchLength) {
  const start = content.lastIndexOf("\n", Math.max(0, index - 1));
  let end = content.indexOf("\n", index + matchLength);
  if (end === -1) end = content.length;
  // widen by one line on each side when available, without pulling in the whole file
  const widenedStart = content.lastIndexOf("\n", Math.max(0, start - 1));
  const nextEnd = content.indexOf("\n", end + 1);
  const from = widenedStart === -1 ? 0 : widenedStart + 1;
  const to = nextEnd === -1 ? content.length : nextEnd;
  return content.slice(from, to).trim();
}

function normalizeWhitespace(str) {
  return String(str || "").replace(/\s+/g, " ").trim();
}

/** Exact literal substring search across candidate files. */
function searchExact(files, needle) {
  const trimmed = normalizeWhitespace(needle);
  if (!trimmed) return null;
  for (const absPath of files) {
    const content = readFileSafe(absPath);
    if (!content) continue;
    // Try the raw needle first (preserves original whitespace/formatting for a clean patch).
    let idx = content.indexOf(needle.trim());
    let matchLength = needle.trim().length;
    if (idx === -1) {
      // Fall back to whitespace-insensitive matching against a normalized copy,
      // then map back to the real, un-normalized file text for the actual patch.
      const normalizedContent = normalizeWhitespace(content);
      const normIdx = normalizedContent.indexOf(trimmed);
      if (normIdx === -1) continue;
      // Can't cleanly map normalized offsets back to raw offsets, so just
      // return the raw context around the first line containing a solid
      // substring of the needle instead.
      const anchor = trimmed.slice(0, Math.min(40, trimmed.length));
      idx = content.indexOf(anchor);
      if (idx === -1) continue;
      matchLength = anchor.length;
    }
    return {
      absPath,
      line: lineOf(content, idx),
      original: contextAround(content, idx, matchLength),
    };
  }
  return null;
}

/** Attribute-anchored search: find a tag containing `attr="value"`, return that whole tag. */
function searchByAttribute(files, attrName, attrValue) {
  if (!attrValue) return null;
  const escaped = attrValue.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(
    `<[a-zA-Z][^<>]*\\b${attrName}\\s*=\\s*["'\`]${escaped}["'\`][^<>]*>`,
    "s",
  );
  for (const absPath of files) {
    const content = readFileSafe(absPath);
    if (!content) continue;
    const m = re.exec(content);
    if (!m) continue;
    return {
      absPath,
      line: lineOf(content, m.index),
      original: m[0],
    };
  }
  return null;
}

/** Try to resolve a browser-reported script URL directly onto a repo file (dev-server source paths). */
function resolveSourceLocationFile(repoPath, sourceLocation) {
  if (!sourceLocation?.url) return null;
  let urlPath;
  try {
    urlPath = new URL(sourceLocation.url).pathname;
  } catch {
    return null;
  }
  const candidates = [
    urlPath,
    urlPath.replace(/^\/_next\/static\/chunks\/pages/, "/pages"),
    urlPath.replace(/^\/src\//, "/src/"),
  ];
  for (const rel of candidates) {
    const clean = rel.replace(/^\/+/, "");
    for (const prefix of ["", "src", "app", "pages", "frontend/src", "frontend/pages"]) {
      const abs = path.join(repoPath, prefix, clean);
      const content = readFileSafe(abs);
      if (!content) continue;
      const lineNumber = sourceLocation.lineNumber
        ? Number(sourceLocation.lineNumber) + 1
        : null;
      const lines = content.split("\n");
      if (lineNumber && lines[lineNumber - 1] !== undefined) {
        const from = Math.max(0, lineNumber - 2);
        const to = Math.min(lines.length, lineNumber + 1);
        return {
          absPath: abs,
          line: lineNumber,
          original: lines.slice(from, to).join("\n").trim(),
        };
      }
    }
  }
  return null;
}

function toResult(repoPath, found) {
  if (!found) return null;
  return {
    absPath: found.absPath,
    relPath: path.relative(repoPath, found.absPath).replace(/\\/g, "/"),
    line: found.line,
    original: found.original,
  };
}

/**
 * Locate the real source snippet for `issue` inside `repoPath`. Returns
 * `{ absPath, relPath, line, original }` on an exact/confident match, or
 * `null` if nothing in the repo can be tied to this issue.
 */
function locate(repoPath, issue) {
  if (!repoPath || !issue) return null;

  if (issue.category === "console-error" && issue.sourceLocation) {
    const direct = resolveSourceLocationFile(repoPath, issue.sourceLocation);
    if (direct) return toResult(repoPath, direct);
    return null; // bundled/served-from-memory paths don't map to a real file — be honest
  }

  const files = listCandidateFiles(repoPath);
  if (!files.length) return null;

  if (issue.snippet) {
    const exact = searchExact(files, issue.snippet);
    if (exact) return toResult(repoPath, exact);
  }

  if (issue.category === "accessibility" && issue.snippet) {
    const srcMatch = issue.snippet.match(/\bsrc\s*=\s*["']([^"']+)["']/);
    if (srcMatch) {
      const byAttr = searchByAttribute(files, "src", srcMatch[1]);
      if (byAttr) return toResult(repoPath, byAttr);
    }
  }

  if (issue.category === "broken-link" && issue.url) {
    const byHref = searchByAttribute(files, "href", issue.url);
    if (byHref) return toResult(repoPath, byHref);
    try {
      const relative = new URL(issue.url).pathname;
      const byRelativeHref = searchByAttribute(files, "href", relative);
      if (byRelativeHref) return toResult(repoPath, byRelativeHref);
    } catch {
      /* not a valid absolute URL — nothing more to try */
    }
  }

  return null;
}

module.exports = { locate, listCandidateFiles, readFileSafe };
