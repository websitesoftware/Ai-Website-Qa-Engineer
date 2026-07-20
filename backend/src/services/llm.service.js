/**
 * Provider-agnostic LLM client used by the AI Automation engine.
 *
 * Supports Anthropic and any OpenAI-compatible endpoint (OpenAI, Groq,
 * Together, Ollama, LM Studio, etc.) using ONLY the native `fetch` that
 * ships with Node 18+ — so no new npm dependency is added to the project.
 *
 * If no API key is configured the client is "disabled": `isEnabled()` is
 * false and `complete()` returns null. Every caller MUST handle null and
 * fall back to deterministic logic, so the app works fully offline/keyless.
 */

const config = require("../config/config");
const logger = require("../utils/logger");

function isEnabled() {
  const p = config.ai.provider;
  if (p === "anthropic") return Boolean(config.ai.anthropic.apiKey);
  if (p === "openai") return Boolean(config.ai.openai.apiKey);
  return false;
}

function providerName() {
  return isEnabled() ? config.ai.provider : "none";
}

async function callAnthropic({ system, prompt, maxTokens, temperature }) {
  const { apiKey, model, baseUrl } = config.ai.anthropic;
  const res = await fetch(`${baseUrl}/v1/messages`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      temperature,
      system,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Anthropic ${res.status}: ${body.slice(0, 300)}`);
  }
  const json = await res.json();
  return (json.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
}

async function callOpenAI({ system, prompt, maxTokens, temperature }) {
  const { apiKey, model, baseUrl } = config.ai.openai;
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      temperature,
      messages: [
        ...(system ? [{ role: "system", content: system }] : []),
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`OpenAI ${res.status}: ${body.slice(0, 300)}`);
  }
  const json = await res.json();
  return (json.choices?.[0]?.message?.content || "").trim();
}

/**
 * Returns the model's text output, or null if the LLM is disabled or errors.
 * Never throws — callers rely on a null fallback to stay functional.
 */
async function complete({
  system,
  prompt,
  maxTokens = 700,
  temperature = 0.2,
}) {
  if (!isEnabled()) return null;
  try {
    if (config.ai.provider === "anthropic") {
      return await callAnthropic({ system, prompt, maxTokens, temperature });
    }
    return await callOpenAI({ system, prompt, maxTokens, temperature });
  } catch (err) {
    logger.warn(
      "llm",
      `LLM call failed, falling back to rules: ${err.message}`,
    );
    return null;
  }
}

/**
 * Ask the model for JSON. Returns a parsed object or null on any problem.
 * Strips ```json fences that models sometimes wrap output in.
 */
async function completeJSON(args) {
  const raw = await complete(args);
  if (!raw) return null;
  const cleaned = raw
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    // Try to salvage the first {...} block.
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        /* ignore */
      }
    }
    return null;
  }
}

// Prose lines models sometimes prepend/append to a code value despite being
// told to return code only (e.g. "Here's the fix:", "Explanation: ...").
const PROSE_LINE = /^\s*(here'?s|explanation|note|summary|this (fix|change)|the (fix|change|following))\b.*[:.]?\s*$/i;

/**
 * Reduce a code string coming out of an LLM JSON field to code only: strips
 * any stray ``` fences (with optional language tag) and leading/trailing
 * prose lines the model may have added despite the "code only" instruction.
 * Interior lines are left untouched so real code is never mangled.
 */
function sanitizeCode(code) {
  if (typeof code !== "string") return code;
  let lines = code.replace(/\r\n/g, "\n").split("\n");

  // Drop a fenced-block wrapper if the whole value is one.
  if (lines.length >= 2 && /^```/.test(lines[0].trim())) {
    lines.shift();
    if (lines.length && /^```\s*$/.test(lines[lines.length - 1].trim())) {
      lines.pop();
    }
  }

  while (lines.length && PROSE_LINE.test(lines[0])) lines.shift();
  while (lines.length && PROSE_LINE.test(lines[lines.length - 1])) lines.pop();

  return lines.join("\n").trim();
}

module.exports = {
  isEnabled,
  providerName,
  complete,
  completeJSON,
  sanitizeCode,
};
