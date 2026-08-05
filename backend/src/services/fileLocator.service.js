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
    // Normalize CRLF -> LF: on Windows checkouts (core.autocrlf), the local
    // file has \r\n even though git/GitHub store \n-only blobs. Without this,
    // any multi-line snippet captured here would never match the file
    // content fetched from the GitHub API, and applyRemediation's drift
    // check (an exact substring match) would always false-positive.
    return fs.readFileSync(absPath, "utf-8").replace(/\r\n/g, "\n");
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

/**
 * Finds the full opening-tag boundaries `[start, end)` containing `index` —
 * needed because a match can land inside a multi-line JSX tag (e.g. a
 * `className` several attribute-lines below the tag name), where a plain
 * "widen by one line" context grab never reaches the actual `<tagname`.
 * Tracks `{}` depth and quote state while scanning forward so a stray `>`
 * inside a JSX expression (e.g. an arrow function `(e) => {...}` in an event
 * handler prop) isn't mistaken for the tag's closing `>`. Tries progressively
 * earlier `<` candidates if a closer one turns out not to actually enclose
 * `index`. Returns null if no enclosing tag can be found nearby.
 */
function findEnclosingTag(content, index) {
  let searchFrom = index;
  for (let attempt = 0; attempt < 5; attempt++) {
    const start = content.lastIndexOf("<", searchFrom);
    if (start === -1) return null;
    if (!/[A-Za-z]/.test(content[start + 1] || "")) {
      searchFrom = start - 1;
      continue;
    }

    let depth = 0;
    let quote = null;
    for (let i = start; i < content.length; i++) {
      const ch = content[i];
      if (quote) {
        if (ch === quote) quote = null;
        continue;
      }
      if (ch === '"' || ch === "'" || ch === "`") {
        quote = ch;
        continue;
      }
      if (ch === "{") {
        depth++;
        continue;
      }
      if (ch === "}") {
        depth--;
        continue;
      }
      if (ch === ">" && depth === 0) {
        if (i >= index) return { start, end: i + 1 };
        break; // this tag closed before reaching index — not the right one
      }
    }
    searchFrom = start - 1;
  }
  return null;
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

/** Pull the value out of a `class="..."` (or `className="..."`) attribute in a rendered/JSX snippet. */
function classListOf(snippet) {
  if (!snippet) return null;
  const m = snippet.match(/\bclass(?:Name)?\s*=\s*["'`]([^"'`]+)["'`]/);
  return m ? m[1] : null;
}

/**
 * Search for the literal class-LIST VALUE (not the surrounding tag), matched
 * independent of attribute name and of the whitespace between classes. The
 * browser DOM axe/Lighthouse capture always renders `class="..."`, but in
 * JSX/TSX/Vue/Svelte source the same value sits behind `className="..."`
 * (or a bound `:class`) — so a plain `searchExact` on the full
 * `<tag class="...">` snippet can never match there even though the class
 * string itself appears in the file verbatim. Classes are also commonly
 * written one-per-line (as Prettier does for long Tailwind lists), so the
 * gap between tokens is matched as `\s+` rather than requiring identical
 * whitespace. Requires several classes so a short/generic value (e.g. a
 * single "flex") can't false-match an unrelated element.
 */
// Lighthouse (and some other reporters) truncate long node snippets with a
// trailing ellipsis mid-class-name (e.g. "...border-slat…"). Matches either
// a real "…" or the mojibake 3-byte sequence it sometimes turns into after
// passing through a codepage that isn't UTF-8.
const TRAILING_ELLIPSIS_RE = /(…|â€¦|\.\.\.)+$/;

function searchByClassList(files, rawClassList) {
  if (!rawClassList) return null;
  const classes = rawClassList.trim().split(/\s+/).filter(Boolean);
  if (classes.length < 3 || classes.join(" ").length < 20) return null;

  // If the reporter truncated mid last-class, treat that class as a prefix
  // match instead of requiring the (unknown) rest of its name too.
  const lastIdx = classes.length - 1;
  const truncatedLast = TRAILING_ELLIPSIS_RE.test(classes[lastIdx]);
  if (truncatedLast) {
    const cleaned = classes[lastIdx].replace(TRAILING_ELLIPSIS_RE, "");
    if (cleaned.length < 2) classes.pop();
    else classes[lastIdx] = cleaned;
  }
  if (classes.length < 3) return null;

  const pattern = classes
    .map((c, i) => {
      const escaped = c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return truncatedLast && i === classes.length - 1 ? `${escaped}\\S*` : escaped;
    })
    .join("\\s+");
  const re = new RegExp(pattern);

  for (const absPath of files) {
    const content = readFileSafe(absPath);
    if (!content) continue;
    const m = re.exec(content);
    if (!m) continue;

    // Prefer the full enclosing opening tag (needed for patches like adding
    // an aria-label to the <button ...> itself) — fall back to a plain
    // line-window if no clean tag boundary is found.
    const tag = findEnclosingTag(content, m.index);
    if (tag) {
      return {
        absPath,
        line: lineOf(content, tag.start),
        original: content.slice(tag.start, tag.end),
      };
    }
    return {
      absPath,
      line: lineOf(content, m.index),
      original: contextAround(content, m.index, m[0].length),
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

/**
 * Find a Next.js App Router `export const metadata = {...}` (or `:
 * Metadata =`) declaration — the real location document-level SEO fields
 * (canonical, openGraph, etc.) belong in this codebase, instead of the
 * literal `<meta>`/`<link>` tags a plain HTML/older-React site would use.
 */
function searchNextMetadataExport(files) {
  const re = /export const metadata(?:\s*:\s*Metadata)?\s*=\s*\{/;
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

    const byClassList = searchByClassList(files, classListOf(issue.snippet));
    if (byClassList) return toResult(repoPath, byClassList);
  }

  if (issue.category === "accessibility" && issue.snippet) {
    const srcMatch = issue.snippet.match(/\bsrc\s*=\s*["']([^"']+)["']/);
    if (srcMatch) {
      const byAttr = searchByAttribute(files, "src", srcMatch[1]);
      if (byAttr) return toResult(repoPath, byAttr);
    }
  }

  // Document-level SEO checks (canonical, open graph, ...) have no element
  // snippet at all — a Next.js App Router site declares these in a
  // `metadata` export object, not literal <meta>/<link> tags, so there's
  // nothing in the DOM for the scan to have captured a snippet of.
  if (issue.category === "seo") {
    const metaExport = searchNextMetadataExport(files);
    if (metaExport) return toResult(repoPath, metaExport);
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
