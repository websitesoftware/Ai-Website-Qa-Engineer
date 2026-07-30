const llm = require("./llm.service");

/**
 * AI Code Review — paste a snippet, get back a list of concrete issues
 * (hardcoded values, line-specific bugs, CSS problems, etc.) plus a fully
 * corrected version of the whole snippet.
 *
 * Same "never fabricate confidence" rule as the rest of the AI Automation
 * engine (see llm.service.js): without an AI provider configured, this
 * falls back to cheap rule-based checks and returns `correctedCode: null` —
 * it never pretends to auto-fix code it can't actually reason about.
 */

const MAX_CODE_CHARS = 20000;

function numberLines(code) {
  return code
    .split("\n")
    .map((line, i) => `${i + 1}: ${line}`)
    .join("\n");
}

const SYSTEM_PROMPT = `You are a meticulous senior code reviewer for a web QA/testing tool. You review pasted
frontend/backend snippets (TypeScript, JavaScript, CSS, HTML, JSX/TSX) for real, concrete problems:
- Hardcoded values that should be constants, config, props, or CSS variables (magic numbers, literal
  colors/URLs/API keys/breakpoints repeated inline).
- Logic errors, bugs, or likely-wrong behavior on specific lines.
- CSS problems: wrong units, missing vendor/dark-mode handling, specificity issues, layout bugs,
  hardcoded colors that should use theme tokens, non-responsive fixed sizes.
- Accessibility and obvious security issues if present.

The input is line-numbered as "N: <code>" for reference only — do not include those "N: " prefixes in
correctedCode.

Respond with STRICT JSON ONLY, no markdown fences, no prose outside the JSON, in this exact shape:
{
  "summary": "one short sentence overview",
  "issues": [
    { "line": <number or null>, "severity": "high" | "medium" | "low", "category": "hardcoded-value" | "bug" | "css" | "accessibility" | "security" | "style", "message": "specific, actionable description" }
  ],
  "correctedCode": "the FULL corrected version of the entire input, not just a diff or snippet"
}
If the code has no real issues, return an empty issues array and correctedCode equal to the cleaned-up input.`;

async function reviewWithAI(code, language) {
  const prompt = `Language hint: ${language || "auto-detect"}\n\nReview this code:\n\n${numberLines(code)}`;
  const result = await llm.completeJSON({
    system: SYSTEM_PROMPT,
    prompt,
    maxTokens: 2000,
    temperature: 0.1,
  });
  if (!result || typeof result !== "object") return null;

  const issues = Array.isArray(result.issues)
    ? result.issues
        .filter((i) => i && typeof i.message === "string")
        .map((i) => ({
          line: Number.isFinite(i.line) ? i.line : null,
          severity: ["high", "medium", "low"].includes(i.severity) ? i.severity : "medium",
          category: typeof i.category === "string" ? i.category : "style",
          message: i.message,
        }))
    : [];

  return {
    summary: typeof result.summary === "string" ? result.summary : null,
    issues,
    correctedCode: typeof result.correctedCode === "string" ? llm.sanitizeCode(result.correctedCode) : null,
  };
}

// ---- Deterministic fallback (no AI configured) ----------------------------
// Cheap, regex-based heuristics only — good enough to flag obvious smells,
// never good enough to claim a "corrected" rewrite, so correctedCode stays
// null here rather than returning the input unchanged and implying it's fixed.

const HEX_COLOR = /#(?:[0-9a-fA-F]{3}){1,2}\b/g;
const PX_VALUE = /\b\d+px\b/g;
const SUSPICIOUS_LITERAL = /\b(?:const|let|var)\s+\w+\s*=\s*(?:["'](?:https?:\/\/|sk_|pk_|AKIA)[^"']*["']|\d{4,})/g;

function reviewWithRules(code) {
  const lines = code.split("\n");
  const issues = [];

  lines.forEach((line, idx) => {
    const lineNo = idx + 1;
    const hexMatches = line.match(HEX_COLOR);
    if (hexMatches) {
      issues.push({
        line: lineNo,
        severity: "low",
        category: "css",
        message: `Hardcoded color ${hexMatches[0]} — consider a theme variable/token instead.`,
      });
    }
    const pxMatches = line.match(PX_VALUE);
    if (pxMatches && /width|height|margin|padding|font-size/i.test(line)) {
      issues.push({
        line: lineNo,
        severity: "low",
        category: "css",
        message: `Hardcoded pixel value (${pxMatches[0]}) — consider a relative unit or design-system spacing scale.`,
      });
    }
    if (SUSPICIOUS_LITERAL.test(line)) {
      issues.push({
        line: lineNo,
        severity: "medium",
        category: "hardcoded-value",
        message: "Hardcoded literal (URL, key-like string, or large number) — move to a constant/config/env var.",
      });
    }
    SUSPICIOUS_LITERAL.lastIndex = 0;
  });

  return {
    summary:
      issues.length > 0
        ? `Found ${issues.length} rule-based issue${issues.length === 1 ? "" : "s"} (no AI provider configured — pattern checks only).`
        : "No obvious issues found by pattern checks (no AI provider configured, so this is a shallow scan).",
    issues,
    correctedCode: null,
    aiUnavailable: true,
  };
}

async function reviewCode({ code, language }) {
  const trimmed = (code || "").slice(0, MAX_CODE_CHARS);
  if (!trimmed.trim()) {
    return { summary: null, issues: [], correctedCode: null, aiUnavailable: !llm.isEnabled() };
  }

  if (llm.isEnabled()) {
    const aiResult = await reviewWithAI(trimmed, language);
    if (aiResult) return { ...aiResult, aiUnavailable: false };
    // LLM call failed/returned nothing usable — fall through to rules rather
    // than surfacing a raw error, same pattern as the rest of the AI engine.
  }
  return reviewWithRules(trimmed);
}

module.exports = { reviewCode };
