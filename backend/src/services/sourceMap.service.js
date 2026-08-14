/**
 * Real source-map resolution for browser-reported console-error locations.
 *
 * A console error's `sourceLocation` is a line:column in the DEPLOYED bundle
 * (often minified, e.g. `/_next/static/chunks/pages/_app-8f2c1a.js:1:48213`)
 * — never the original React/JSX/TypeScript file the developer actually
 * wrote. Without decoding the bundle's source map, fileLocator.service.js
 * has no real chance of grounding a fix for that error in the real repo.
 *
 * Everything here is best-effort and network-dependent (the map may not be
 * published at all in production, or may be behind auth) — every failure
 * path returns null rather than a guess.
 */

const { SourceMapConsumer } = require("source-map-js");

const FETCH_TIMEOUT_MS = 5000;
const MAX_BYTES = 3_000_000;

async function fetchText(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    const text = await res.text();
    if (text.length > MAX_BYTES) return null;
    return text;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Last `//# sourceMappingURL=...` (or legacy `//@`) comment in a JS file. */
function findSourceMappingUrl(jsText) {
  const matches = [...jsText.matchAll(/\/\/[#@]\s*sourceMappingURL=(\S+)\s*$/gm)];
  return matches.length ? matches[matches.length - 1][1] : null;
}

function decodeDataUri(uri) {
  const m = uri.match(/^data:application\/json;(?:charset=[^;]+;)?base64,(.+)$/s);
  if (!m) return null;
  try {
    return Buffer.from(m[1], "base64").toString("utf-8");
  } catch {
    return null;
  }
}

/**
 * Fetches the deployed bundle at `sourceUrl`, locates its source map (either
 * the `${url}.map` convention or an embedded `sourceMappingURL` comment —
 * inline base64 or a relative/absolute reference), and maps the compiled
 * (line, column) back to the original source file the browser can never
 * report directly. Returns `{ source, line, column, name, sourceContent }`
 * or null if any step fails (missing map, unparsable map, no match, etc.).
 */
async function resolveOriginalPosition(sourceUrl, line, column) {
  if (!sourceUrl || !line) return null;

  let mapText = await fetchText(`${sourceUrl}.map`);
  let mapUrl = mapText ? `${sourceUrl}.map` : null;

  if (!mapText) {
    const jsText = await fetchText(sourceUrl);
    if (!jsText) return null;
    const ref = findSourceMappingUrl(jsText);
    if (!ref) return null;
    if (ref.startsWith("data:")) {
      mapText = decodeDataUri(ref);
    } else {
      try {
        mapUrl = new URL(ref, sourceUrl).toString();
      } catch {
        return null;
      }
      mapText = await fetchText(mapUrl);
    }
  }
  if (!mapText) return null;

  let rawMap;
  try {
    rawMap = JSON.parse(mapText);
  } catch {
    return null;
  }

  let consumer;
  try {
    consumer = new SourceMapConsumer(rawMap);
  } catch {
    return null;
  }

  const pos = consumer.originalPositionFor({
    line: Number(line),
    column: Number(column) || 0,
  });
  if (!pos || !pos.source || pos.line == null) return null;

  const idx = consumer.sources.indexOf(pos.source);
  const sourceContent =
    idx !== -1 && Array.isArray(consumer.sourcesContent)
      ? consumer.sourcesContent[idx] || null
      : null;

  return {
    source: pos.source,
    line: pos.line,
    column: pos.column,
    name: pos.name || null,
    sourceContent,
  };
}

/**
 * Cleans a source-map "source" entry — e.g. "webpack://_N_E/./src/Header.tsx",
 * "webpack-internal:///./pages/index.js", "../../src/App.jsx" — down to a
 * plain relative-path suffix that can be matched against real files on disk.
 */
function cleanSourcePath(source) {
  if (!source) return null;
  let s = source.split("?")[0].split("#")[0];
  s = s.replace(/^webpack-internal:\/\/\//, "");
  s = s.replace(/^webpack:\/\/\/?/, "");
  s = s.replace(/^[^/]*\/\.\//, ""); // drop a leading namespace segment, e.g. "_N_E/./"
  s = s.replace(/^(\.\.\/)+/, "");
  s = s.replace(/^\.\//, "");
  return s || null;
}

module.exports = { resolveOriginalPosition, cleanSourcePath };
