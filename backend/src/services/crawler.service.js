const axios = require("axios");
const cheerio = require("cheerio");
const config = require("../config/config");
const logger = require("../utils/logger");

function normalizeUrl(base, href) {
  try {
    const u = new URL(href, base);
    u.hash = "";
    return u.href.replace(/\/$/, "");
  } catch (e) {
    return null;
  }
}

function isSameOrigin(url, origin) {
  try {
    return new URL(url).origin === origin;
  } catch (e) {
    return false;
  }
}

/**
 * Breadth-first crawl of internal links starting at `startUrl`.
 * Uses plain HTTP + cheerio (fast, no browser needed) purely for link
 * discovery. Rendering / screenshots / console errors happen later
 * with Puppeteer on the discovered page set.
 */
async function crawlSite(startUrl, opts = {}) {
  const maxPages = opts.maxPages || config.crawler.maxPages;
  const maxDepth = opts.maxDepth || config.crawler.maxDepth;
  const origin = new URL(startUrl).origin;

  const visited = new Set();
  const queue = [{ url: normalizeUrl(startUrl, startUrl), depth: 0 }];
  const discovered = [];
  const externalLinks = new Set();

  while (queue.length && discovered.length < maxPages) {
    const { url, depth } = queue.shift();
    if (!url || visited.has(url)) continue;
    visited.add(url);

    try {
      const res = await axios.get(url, {
        timeout: config.crawler.timeoutMs,
        headers: { "User-Agent": "AI-QA-Engineer-Bot/1.0" },
        validateStatus: () => true,
      });

      discovered.push({ url, statusCode: res.status, depth });

      if (res.status >= 200 && res.status < 300 && depth < maxDepth) {
        const contentType = res.headers["content-type"] || "";
        if (contentType.includes("text/html")) {
          const $ = cheerio.load(res.data);
          $("a[href]").each((_, el) => {
            const href = $(el).attr("href");
            if (!href || href.startsWith("mailto:") || href.startsWith("tel:")) return;
            const abs = normalizeUrl(url, href);
            if (!abs) return;
            if (isSameOrigin(abs, origin)) {
              if (!visited.has(abs)) queue.push({ url: abs, depth: depth + 1 });
            } else {
              externalLinks.add(abs);
            }
          });
        }
      }
    } catch (err) {
      discovered.push({ url, statusCode: 0, depth, error: err.message });
      logger.warn("crawler", `Failed to fetch ${url}: ${err.message}`);
    }
  }

  return {
    pages: discovered,
    externalLinks: Array.from(externalLinks),
  };
}

module.exports = { crawlSite, normalizeUrl, isSameOrigin };
