/**
 * Dedicated Gemini client, used specifically for AI-assisted source-file
 * location (see aiAutomation.service.js#aiLocate) — independent of the main
 * `AI_PROVIDER` switch in llm.service.js, which drives fix-writing.
 *
 * Why a separate client instead of adding "gemini" as a third llm.service
 * provider: locating a DOM-observed issue inside a real repo benefits from
 * seeing MANY candidate files at once (a large context window), which is a
 * different shape of problem than "write a tailored patch for one known
 * file" — so this is used for locating regardless of which provider is
 * configured for fixes, as long as GEMINI_API_KEY is set. If it isn't, every
 * caller must (and does) fall back to the existing llm.service path.
 */

const config = require("../config/config");
const logger = require("../utils/logger");

let client = null;
function getClient() {
  if (client) return client;
  if (!config.ai.gemini.apiKey) return null;
  // Lazy-required so a missing/broken install of the (already a declared
  // dependency) SDK can't break the app for users who never set this key.
  const { GoogleGenAI } = require("@google/genai");
  client = new GoogleGenAI({ apiKey: config.ai.gemini.apiKey });
  return client;
}

function isEnabled() {
  return Boolean(config.ai.gemini.apiKey);
}

function parseJSON(raw) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

async function callOnce({ system, prompt, maxTokens, temperature }) {
  const ai = getClient();
  const response = await ai.models.generateContent({
    model: config.ai.gemini.model,
    contents: prompt,
    config: {
      systemInstruction: system,
      responseMimeType: "application/json",
      maxOutputTokens: maxTokens,
      temperature,
    },
  });
  return (response.text || "").trim();
}

/**
 * Ask Gemini for JSON. Returns a parsed object, or null if disabled, both
 * attempts fail, or the response isn't valid/salvageable JSON — callers must
 * treat null as "fall back", never as "confirmed empty".
 *
 * Retries once on any failure (thrown error, empty response, or unparseable
 * output) — cold-start/transient hiccups on the first call in a while are
 * common enough in practice that a single retry meaningfully improves
 * reliability without adding real latency on the common (success-first-try)
 * path.
 */
async function completeJSON(args) {
  if (!getClient()) return null;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      // eslint-disable-next-line no-await-in-loop -- intentionally sequential: retry only after the first attempt fails.
      const raw = await callOnce(args);
      const json = parseJSON(raw);
      if (json) return json;
      logger.warn(
        "gemini",
        `Attempt ${attempt} returned no usable JSON (${raw.length} chars, likely truncated by maxTokens)` +
          (attempt === 1 ? " — retrying once" : ""),
      );
    } catch (err) {
      logger.warn(
        "gemini",
        `Attempt ${attempt} failed: ${err.message}` + (attempt === 1 ? " — retrying once" : ""),
      );
    }
  }
  return null;
}

module.exports = { isEnabled, completeJSON };
