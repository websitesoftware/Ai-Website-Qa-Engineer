const axios = require("axios");
const pLimit = require("p-limit");
const config = require("../config/config");

/**
 * Checks a list of URLs (internal pages already have status codes from the
 * crawler; this focuses on external links + any that need re-verification)
 * and returns the ones that are broken (4xx/5xx/timeouts).
 */
async function checkLinks(urls) {
  const limit = pLimit(config.crawler.concurrency);
  const results = await Promise.all(
    urls.map((url) =>
      limit(async () => {
        try {
          const res = await axios.head(url, {
            timeout: config.crawler.timeoutMs,
            headers: { "User-Agent": "AI-QA-Engineer-Bot/1.0" },
            validateStatus: () => true,
          });
          // Some servers don't support HEAD properly -> retry with GET
          if (res.status >= 400) {
            const getRes = await axios.get(url, {
              timeout: config.crawler.timeoutMs,
              headers: { "User-Agent": "AI-QA-Engineer-Bot/1.0" },
              validateStatus: () => true,
            });
            return { url, statusCode: getRes.status };
          }
          return { url, statusCode: res.status };
        } catch (err) {
          return { url, statusCode: 0, error: err.message };
        }
      })
    )
  );

  return results.filter((r) => r.statusCode === 0 || r.statusCode >= 400);
}

module.exports = { checkLinks };
