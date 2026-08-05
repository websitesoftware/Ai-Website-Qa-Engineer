/**
 * Local docs site — `npm run docs` from the repo root.
 * Zero external dependencies: plain Node http server. Serves the static
 * viewer in docs/public/, the generated docs/data.json manifest, and a
 * read-only /api/source endpoint that returns the REAL current contents of
 * a file so "View source" always reflects what's actually on disk (not a
 * frozen snapshot baked in at generate time).
 */

const http = require("http");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const PUBLIC_DIR = path.join(__dirname, "public");
const DATA_PATH = path.join(__dirname, "data.json");
const PORT = process.env.DOCS_PORT || 4400;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".ico": "image/x-icon",
  ".svg": "image/svg+xml",
};

function loadManifest() {
  if (!fs.existsSync(DATA_PATH)) {
    console.log("docs/data.json not found — generating it now...");
    execSync("node generate.js", { cwd: __dirname, stdio: "inherit" });
  }
  return JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
}

/** Every path the manifest knows about is the whitelist for /api/source — nothing outside it is readable. */
function knownPaths(manifest) {
  const set = new Set();
  for (const f of [...manifest.frontendFiles, ...manifest.backendFiles]) set.add(f.path);
  return set;
}

function send(res, status, body, contentType) {
  res.writeHead(status, { "Content-Type": contentType || "text/plain; charset=utf-8" });
  res.end(body);
}

function serveStatic(req, res, urlPath) {
  const rel = urlPath === "/" ? "/index.html" : urlPath;
  const filePath = path.join(PUBLIC_DIR, rel);
  if (!filePath.startsWith(PUBLIC_DIR)) return send(res, 403, "Forbidden");
  fs.readFile(filePath, (err, buf) => {
    if (err) return send(res, 404, "Not found");
    const ext = path.extname(filePath);
    send(res, 200, buf, MIME[ext] || "application/octet-stream");
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (url.pathname === "/api/data") {
    return send(res, 200, JSON.stringify(loadManifest()), MIME[".json"]);
  }

  if (url.pathname === "/api/source") {
    const manifest = loadManifest();
    const requested = url.searchParams.get("path") || "";
    if (!knownPaths(manifest).has(requested)) {
      return send(res, 404, JSON.stringify({ error: "Unknown file" }), MIME[".json"]);
    }
    const abs = path.join(ROOT, requested);
    if (!abs.startsWith(ROOT)) return send(res, 403, JSON.stringify({ error: "Forbidden" }), MIME[".json"]);
    fs.readFile(abs, "utf8", (err, content) => {
      if (err) return send(res, 404, JSON.stringify({ error: "File not found on disk" }), MIME[".json"]);
      send(res, 200, JSON.stringify({ path: requested, content }), MIME[".json"]);
    });
    return;
  }

  return serveStatic(req, res, url.pathname);
});

server.listen(PORT, () => {
  console.log(`\n  AI QA Engineer docs running at http://localhost:${PORT}\n`);
});
