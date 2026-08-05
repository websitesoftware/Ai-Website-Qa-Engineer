/**
 * Builds docs/data.json: the single manifest the local docs site (npm run
 * docs) renders. Merges the per-file descriptions in frontend-docs.json /
 * backend-docs.json with real, computed facts read straight off disk (line
 * counts, dependency lists from package.json) — nothing here is invented,
 * only assembled from what's actually in the repo.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const FRONTEND_DOCS = path.join(__dirname, "frontend-docs.json");
const BACKEND_DOCS = path.join(__dirname, "backend-docs.json");
const OUT = path.join(__dirname, "data.json");

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function lineCount(relPath) {
  const abs = path.join(ROOT, relPath);
  try {
    const stat = fs.statSync(abs);
    if (!stat.isFile()) return 0;
    const buf = fs.readFileSync(abs, "utf8");
    // binary-ish files (e.g. .ico) will just report 1
    return buf.includes("\0") ? 1 : buf.split("\n").length;
  } catch {
    return 0;
  }
}

function pkgDeps(relPkgPath) {
  try {
    const pkg = readJson(path.join(ROOT, relPkgPath));
    return {
      name: pkg.name,
      dependencies: Object.keys(pkg.dependencies || {}),
      devDependencies: Object.keys(pkg.devDependencies || {}),
      scripts: pkg.scripts || {},
    };
  } catch {
    return { name: null, dependencies: [], devDependencies: [], scripts: {} };
  }
}

/** Cuts each description down to its first sentence for the card view; the rest is kept as `descriptionFull` behind a "more" toggle. */
function shorten(desc) {
  const text = String(desc || "").trim();
  const match = text.match(/^.*?[.!?](?=\s|$)/);
  const first = match ? match[0].trim() : text;
  if (first.length <= 150) return { description: first, descriptionFull: text === first ? null : text };
  return { description: `${first.slice(0, 147).trim()}…`, descriptionFull: text };
}

function build() {
  const frontendFiles = readJson(FRONTEND_DOCS).map((f) => ({ ...f, lines: lineCount(f.path), ...shorten(f.description) }));
  const backendFiles = readJson(BACKEND_DOCS).map((f) => ({ ...f, lines: lineCount(f.path), ...shorten(f.description) }));

  const data = {
    generatedAt: new Date().toISOString(),
    stats: {
      frontendFileCount: frontendFiles.length,
      backendFileCount: backendFiles.length,
      totalLines: [...frontendFiles, ...backendFiles].reduce((s, f) => s + (f.lines || 0), 0),
    },
    tech: {
      frontend: pkgDeps("frontend/package.json"),
      backend: pkgDeps("backend/package.json"),
    },
    frontendFiles,
    backendFiles,
  };

  fs.writeFileSync(OUT, JSON.stringify(data, null, 2));
  console.log(
    `docs/data.json written: ${frontendFiles.length} frontend files, ${backendFiles.length} backend files, ${data.stats.totalLines} total lines.`,
  );
}

build();
