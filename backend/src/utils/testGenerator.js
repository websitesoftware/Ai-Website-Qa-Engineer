const Anthropic = require("@anthropic-ai/sdk");

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Falls back to a solid default if ANTHROPIC_MODEL isn't set in .env
const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-4-8";

/**
 * @param {string} url
 * @param {Array<{ name: string, html: string }>} sections - ordered top-to-bottom
 *   page sections, e.g. [{ name: "Header", html: "..." }, { name: "Hero Banner", html: "..." }, ...]
 */
async function autoDiscoverAndGenerateSteps(url, sections) {
  const sectionBlocks = sections
    .map((s, i) => `--- SECTION ${i + 1}: "${s.name}" ---\n${s.html}`)
    .join("\n\n");

  const sectionNames = sections.map((s) => `"${s.name}"`).join(", ");

  const prompt = `
    You are an Expert Manual QA Engineer writing a professional manual test pack, in the
    exact style used by real QA teams, for this live website: "${url}"

    The page has been broken into the following sections, listed in real top-to-bottom
    page order:

    ${sectionBlocks}

    STYLE TO FOLLOW (this is how experienced QA engineers write test cases — match this
    tone exactly):
    - Each Test Case is a short, sequential USER JOURNEY made of multiple steps, not a
      single isolated check. Example shapes (adapt wording to what's ACTUALLY on the
      page, never invent elements that aren't there):
        "Website availability and Log in" -> steps: launch the site, click the login
        control, enter credentials, verify a logged-in state, log out.
        "Global search" -> steps: launch the site, search a real keyword, verify
        results render, open a result.
        "Forms submission" -> steps: launch the site, navigate to the form, fill the
        REAL fields you see in the HTML, submit, verify the real confirmation message
        if one is visible in the HTML.
        "Mobile responsiveness" -> steps: launch the site on a mobile viewport, verify
        layout/nav behaves correctly.
      These are illustrative categories only — only use ones that are actually
      supported by what's present in the section's HTML.
    - Step Action lines are short imperative instructions ("Click X", "Enter Y",
      "Navigate to Z"). Step Expected lines are short declarative outcomes using
      "should"/"SHOULD" phrasing ("X should be displayed", "Y should be successful").
    - A Test Case may end with a final step whose Step Action is "END" and Step
      Expected is left blank, when it represents a complete closed workflow — use this
      only when it fits naturally, not on every case.
    - Use REAL text from the HTML (real button labels, real link text, real form
      field names/placeholders) wherever you reference an element. Do not invent
      generic UI elements that are not present.

    For EACH section above, generate 1 to 2 Test Cases (each with 2 to 6 steps) based
    only on what is actually present in that section's HTML. Skip a section entirely if
    nothing meaningfully testable is present.

    Output ONLY a raw JSON array (no markdown fences, no commentary, no preamble) of
    Test Case objects with this exact shape:
    [
      {
        "section": "one of: ${sectionNames}",
        "title": "short Test Case title, e.g. 'Website availability and Log in'",
        "steps": [
          { "action": "string", "expected": "string" }
        ]
      }
    ]

    Keep the array ordered section-by-section, top to bottom, matching the order the
    sections were given above.
  `;

  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    });

    const textBlock = response.content.find((block) => block.type === "text");
    const cleanText =
      textBlock?.text?.replace(/```json|```/g, "").trim() || "[]";
    const parsedCases = JSON.parse(cleanText);

    if (!Array.isArray(parsedCases) || parsedCases.length === 0) {
      throw new Error("Claude returned empty or non-array output");
    }

    const validNames = new Set(sections.map((s) => s.name));

    // Flatten each multi-step Test Case into individual rows, matching the
    // reference sheet's convention: Work Item Type + Title only appear on the
    // FIRST step row of a Test Case; every subsequent step row leaves those
    // two columns blank, with Test Step numbering restarting at 1 per case.
    const steps = [];
    parsedCases.forEach((testCase) => {
      const section = validNames.has(testCase.section)
        ? testCase.section
        : sections[0]?.name || "General";
      const caseSteps = Array.isArray(testCase.steps) ? testCase.steps : [];

      caseSteps.forEach((step, i) => {
        steps.push({
          section,
          workItemType: i === 0 ? "Test Case" : "",
          title: i === 0 ? testCase.title || "" : "",
          testStep: String(i + 1),
          stepAction: step.action || "",
          stepExpected: step.expected || "",
        });
      });
    });

    if (steps.length === 0) {
      throw new Error("Claude returned Test Cases with no usable steps");
    }

    return { steps, error: null };
  } catch (error) {
    console.error("Auto-Discovery Failed:", error.message);
    return { steps: [], error: error.message };
  }
}

module.exports = { autoDiscoverAndGenerateSteps };
