/**
 * Checks axe-core doesn't reliably cover, run as one in-page script so they
 * share axe's browser context (see accessibility.service.js). Each entry
 * mirrors the shape of an axe violation (id/impact/help/description/
 * nodes/targets/locators) so issueDetector.service.js#fromAccessibility can
 * treat axe and custom findings identically.
 *
 * - Missing Focus Indicator: axe has no rule for this at all — it would
 *   need to actually focus elements and diff computed style, which is a
 *   runtime check, not a static DOM rule.
 * - Broken ARIA References: axe's aria-valid-attr-value only checks that an
 *   ID-reference attribute's *value* is a valid token list, not that each
 *   referenced ID exists in the document.
 * - Small Touch Targets: axe's equivalent (`target-size`) ships disabled by
 *   default in this axe-core version and requires an experimental tag we
 *   don't enable, so it never runs under the standard WCAG audit.
 * - Live Region (aria-live) Issues: no axe rule validates aria-live values.
 * - Keyboard Navigation Issues (supplemental): axe's `tabindex`/`accesskeys`
 *   rules catch keyboard *traps*, not custom clickable elements (a `<div
 *   role="button">`) that were never made keyboard-reachable to begin with.
 */

const MAX_ELEMENTS_TO_PROBE = 60;
const MAX_LOCATORS = 3;
const MAX_TARGETS = 5;

/**
 * Runs inside the page via page.evaluate — no access to Node.js scope.
 * Returns an array shaped like axe's `violations`, one entry per category
 * that found at least one offending element.
 */
function browserCheck({ maxElements, maxLocators, maxTargets }) {
  function selectorOf(el) {
    if (el.id) return `#${CSS.escape(el.id)}`;
    const parts = [];
    let node = el;
    let depth = 0;
    while (node && node.nodeType === 1 && depth < 4) {
      let part = node.tagName.toLowerCase();
      const parent = node.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children).filter(
          (c) => c.tagName === node.tagName,
        );
        if (siblings.length > 1) {
          part += `:nth-of-type(${siblings.indexOf(node) + 1})`;
        }
      }
      parts.unshift(part);
      node = parent;
      depth += 1;
    }
    return parts.join(" > ");
  }

  function isVisible(el) {
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;
    const style = getComputedStyle(el);
    return style.visibility !== "hidden" && style.display !== "none";
  }

  function pushFinding(bucket, key, el, extra) {
    if (!bucket[key]) bucket[key] = { count: 0, targets: [], locators: [] };
    const b = bucket[key];
    b.count += 1;
    const sel = selectorOf(el);
    if (b.targets.length < maxTargets) b.targets.push(sel);
    if (b.locators.length < maxLocators) {
      b.locators.push({
        selector: sel,
        html: el.outerHTML.slice(0, 300),
        extra: extra || null,
      });
    }
  }

  const findings = {};

  // ---- Missing Focus Indicator ----
  const focusable = Array.from(
    document.querySelectorAll(
      'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])',
    ),
  )
    .filter((el) => isVisible(el) && !el.disabled)
    .slice(0, maxElements);

  const activeBefore = document.activeElement;
  for (const el of focusable) {
    const before = getComputedStyle(el);
    const beforeSnapshot = `${before.outlineStyle}|${before.outlineWidth}|${before.boxShadow}|${before.borderColor}`;
    el.focus({ preventScroll: true });
    if (document.activeElement !== el) continue; // not actually focusable
    const after = getComputedStyle(el);
    const afterSnapshot = `${after.outlineStyle}|${after.outlineWidth}|${after.boxShadow}|${after.borderColor}`;
    const noOutline =
      after.outlineStyle === "none" || parseFloat(after.outlineWidth) === 0;
    if (noOutline && beforeSnapshot === afterSnapshot) {
      pushFinding(findings, "Missing Focus Indicator", el);
    }
  }
  if (activeBefore && activeBefore.blur) activeBefore.blur();
  else if (document.activeElement && document.activeElement.blur) {
    document.activeElement.blur();
  }

  // ---- Broken ARIA References ----
  const idrefAttrs = [
    "aria-labelledby",
    "aria-describedby",
    "aria-owns",
    "aria-controls",
    "aria-activedescendant",
    "aria-flowto",
    "aria-details",
    "aria-errormessage",
  ];
  const idrefSelector = idrefAttrs.map((a) => `[${a}]`).join(",");
  for (const el of document.querySelectorAll(idrefSelector)) {
    for (const attr of idrefAttrs) {
      const val = el.getAttribute(attr);
      if (!val) continue;
      const missing = val
        .split(/\s+/)
        .filter(Boolean)
        .filter((id) => !document.getElementById(id));
      if (missing.length) {
        pushFinding(
          findings,
          "Broken ARIA References",
          el,
          `${attr}="${val}" references missing id(s): ${missing.join(", ")}`,
        );
      }
    }
  }

  // ---- Small Touch Targets (WCAG 2.5.8 — 24x24 CSS px minimum) ----
  const interactive = document.querySelectorAll(
    'a[href], button, input:not([type="hidden"]), select, [role="button"], [role="link"], [role="checkbox"], [role="radio"], [role="switch"], [role="menuitem"]',
  );
  for (const el of interactive) {
    if (!isVisible(el)) continue;
    const rect = el.getBoundingClientRect();
    if (rect.width < 24 || rect.height < 24) {
      pushFinding(
        findings,
        "Small Touch Targets",
        el,
        `${Math.round(rect.width)}x${Math.round(rect.height)}px (minimum 24x24px)`,
      );
    }
  }

  // ---- Live Region (aria-live) Issues ----
  const VALID_LIVE = new Set(["polite", "assertive", "off"]);
  for (const el of document.querySelectorAll("[aria-live]")) {
    const val = (el.getAttribute("aria-live") || "").trim().toLowerCase();
    if (!VALID_LIVE.has(val)) {
      pushFinding(
        findings,
        "Live Region (aria-live) Issues",
        el,
        `aria-live="${el.getAttribute("aria-live")}" is not a valid value (polite | assertive | off)`,
      );
      continue;
    }
    const atomic = el.getAttribute("aria-atomic");
    if (atomic !== null && atomic !== "true" && atomic !== "false") {
      pushFinding(
        findings,
        "Live Region (aria-live) Issues",
        el,
        `aria-atomic="${atomic}" is not a valid value (true | false)`,
      );
    }
  }

  // ---- Keyboard Navigation Issues (supplemental) ----
  const NATIVE_INTERACTIVE = new Set([
    "A",
    "BUTTON",
    "INPUT",
    "SELECT",
    "TEXTAREA",
    "SUMMARY",
  ]);
  const pseudoInteractive = document.querySelectorAll(
    '[role="button"], [role="link"], [role="checkbox"], [role="radio"], [role="menuitem"], [role="tab"], [onclick]',
  );
  for (const el of pseudoInteractive) {
    if (!isVisible(el) || NATIVE_INTERACTIVE.has(el.tagName)) continue;
    const tabindex = el.getAttribute("tabindex");
    const reachable = tabindex !== null && parseInt(tabindex, 10) >= 0;
    if (!reachable) {
      pushFinding(
        findings,
        "Keyboard Navigation Issues",
        el,
        "Clickable/interactive element has no tabindex, so it can't be reached with the keyboard",
      );
    }
  }

  return Object.entries(findings).map(([category, data]) => ({
    id: `custom-${category.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    categoryLabel: category,
    impact:
      category === "Broken ARIA References" ||
      category === "Missing Focus Indicator"
        ? "serious"
        : "moderate",
    help: category,
    description: `${data.count} element${data.count === 1 ? "" : "s"} affected${
      data.locators[0]?.extra ? ` — e.g. ${data.locators[0].extra}` : ""
    }`,
    helpUrl: null,
    nodes: data.count,
    targets: data.targets,
    locators: data.locators.map(({ selector, html }) => ({ selector, html })),
  }));
}

async function runCustomAccessibilityChecks(page) {
  try {
    return await page.evaluate(browserCheck, {
      maxElements: MAX_ELEMENTS_TO_PROBE,
      maxLocators: MAX_LOCATORS,
      maxTargets: MAX_TARGETS,
    });
  } catch {
    // Custom checks are best-effort on top of the axe audit — never fail
    // the whole accessibility scan because of them.
    return [];
  }
}

module.exports = { runCustomAccessibilityChecks };
