const cheerio = require("cheerio");
const logger = require("../utils/logger");

/**
 * Uses the shared Puppeteer browser (not a raw HTTP request) so sites with
 * bot-protection / Cloudflare in front of them don't 403 us like a plain
 * axios GET would.
 */
async function auditSEO(browser, url) {
  const page = await browser.newPage();
  let html;
  try {
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    );
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    html = await page.content();
  } catch (err) {
    logger.error("seo", `Could not fetch ${url}: ${err.message}`);
    return {
      checks: [
        {
          id: "fetch",
          passed: false,
          message: `Could not fetch page: ${err.message}`,
        },
      ],
      score: 0,
    };
  } finally {
    await page.close();
  }

  const $ = cheerio.load(html);
  const checks = [];

  const title = $("title").first().text().trim();
  checks.push({
    id: "title",
    passed: title.length > 0 && title.length <= 60,
    message: !title
      ? "Missing <title> tag"
      : title.length > 60
        ? `Title too long (${title.length} chars, keep under 60)`
        : "Title tag present and well sized",
  });

  const metaDesc = $('meta[name="description"]').attr("content") || "";
  checks.push({
    id: "meta-description",
    passed: metaDesc.length > 0 && metaDesc.length <= 160,
    message: !metaDesc
      ? "Missing meta description"
      : metaDesc.length > 160
        ? `Meta description too long (${metaDesc.length} chars)`
        : "Meta description present and well sized",
  });

  const h1s = $("h1");
  checks.push({
    id: "h1",
    passed: h1s.length === 1,
    message:
      h1s.length === 0
        ? "No <h1> found"
        : h1s.length > 1
          ? `Multiple <h1> tags found (${h1s.length})`
          : "Exactly one <h1> found",
  });

  const imgs = $("img");
  const imgsMissingAlt = imgs.filter((_, el) => !$(el).attr("alt")).length;
  checks.push({
    id: "image-alt",
    passed: imgsMissingAlt === 0,
    message:
      imgsMissingAlt === 0
        ? "All images have alt text"
        : `${imgsMissingAlt} of ${imgs.length} images missing alt text`,
  });

  const canonical = $('link[rel="canonical"]').attr("href");
  checks.push({
    id: "canonical",
    passed: !!canonical,
    message: canonical
      ? `Canonical URL set: ${canonical}`
      : "Missing canonical link tag",
  });

  const viewport = $('meta[name="viewport"]').attr("content");
  checks.push({
    id: "viewport",
    passed: !!viewport,
    message: viewport
      ? "Viewport meta tag present"
      : "Missing viewport meta tag (hurts mobile SEO)",
  });

  const robotsMeta = $('meta[name="robots"]').attr("content") || "";
  checks.push({
    id: "robots",
    passed: !robotsMeta.includes("noindex"),
    message: robotsMeta.includes("noindex")
      ? "Page is set to noindex — won't appear in search results"
      : "Page is indexable",
  });

  const ogTags = $('meta[property^="og:"]').length;
  checks.push({
    id: "open-graph",
    passed: ogTags > 0,
    message:
      ogTags > 0
        ? `${ogTags} Open Graph tags found`
        : "No Open Graph tags found (hurts social sharing)",
  });

  const structuredData = $('script[type="application/ld+json"]').length;
  checks.push({
    id: "structured-data",
    passed: structuredData > 0,
    message:
      structuredData > 0
        ? "Structured data (JSON-LD) found"
        : "No structured data found",
  });

  const passedCount = checks.filter((c) => c.passed).length;
  const score = Math.round((passedCount / checks.length) * 100);

  return { checks, score };
}

module.exports = { auditSEO };
