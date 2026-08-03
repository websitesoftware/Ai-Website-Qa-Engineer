/**
 * Normalizes the ~50 granular axe-core rule IDs the accessibility audit can
 * emit down to the fixed set of 20 categories QA/product actually wants to
 * see on a report (issueDetector.service.js#fromAccessibility uses this as
 * the issue title instead of axe's raw per-rule help text, so e.g.
 * "aria-command-name" and "select-name" both surface as one
 * "Missing Accessible Name" issue type instead of two unfamiliar ones).
 *
 * Rule IDs not listed here fall back to axe's own `help` text rather than
 * being dropped, so an axe-core upgrade that adds/renames a rule never
 * silently loses a finding.
 */
const AXE_RULE_TO_CATEGORY = {
  // Missing Alt Text
  "image-alt": "Missing Alt Text",
  "input-image-alt": "Missing Alt Text",
  "area-alt": "Missing Alt Text",
  "role-img-alt": "Missing Alt Text",
  "object-alt": "Missing Alt Text",
  "svg-img-alt": "Missing Alt Text",
  "image-redundant-alt": "Missing Alt Text",

  // Missing Form Labels
  label: "Missing Form Labels",
  "label-title-only": "Missing Form Labels",

  // Missing Accessible Name (ARIA widgets — native button/link handled
  // separately under "Empty Buttons/Links")
  "aria-command-name": "Missing Accessible Name",
  "aria-input-field-name": "Missing Accessible Name",
  "aria-toggle-field-name": "Missing Accessible Name",
  "select-name": "Missing Accessible Name",
  "aria-text": "Missing Accessible Name",
  "aria-dialog-name": "Missing Accessible Name",
  "aria-tooltip-name": "Missing Accessible Name",

  // Low Color Contrast
  "color-contrast": "Low Color Contrast",
  "color-contrast-enhanced": "Low Color Contrast",

  // Keyboard Navigation Issues
  tabindex: "Keyboard Navigation Issues",
  accesskeys: "Keyboard Navigation Issues",
  "scrollable-region-focusable": "Keyboard Navigation Issues",

  // Missing H1
  "page-has-heading-one": "Missing H1",

  // Heading Hierarchy Issues
  "heading-order": "Heading Hierarchy Issues",
  "empty-heading": "Heading Hierarchy Issues",

  // Missing Page Title
  "document-title": "Missing Page Title",

  // Missing HTML Lang Attribute
  "html-has-lang": "Missing HTML Lang Attribute",
  "html-lang-valid": "Missing HTML Lang Attribute",
  "html-xml-lang-mismatch": "Missing HTML Lang Attribute",
  "valid-lang": "Missing HTML Lang Attribute",

  // Invalid ARIA Attributes
  "aria-valid-attr": "Invalid ARIA Attributes",
  "aria-valid-attr-value": "Invalid ARIA Attributes",
  "aria-allowed-attr": "Invalid ARIA Attributes",
  "aria-required-attr": "Invalid ARIA Attributes",
  "aria-required-children": "Invalid ARIA Attributes",
  "aria-required-parent": "Invalid ARIA Attributes",
  "aria-roles": "Invalid ARIA Attributes",
  "aria-allowed-role": "Invalid ARIA Attributes",
  "aria-conditional-attr": "Invalid ARIA Attributes",
  "aria-deprecated-role": "Invalid ARIA Attributes",
  "aria-prohibited-attr": "Invalid ARIA Attributes",

  // Empty Buttons/Links (native elements with no accessible content at all)
  "button-name": "Empty Buttons/Links",
  "link-name": "Empty Buttons/Links",

  // Duplicate IDs
  "duplicate-id": "Duplicate IDs",
  "duplicate-id-active": "Duplicate IDs",
  "duplicate-id-aria": "Duplicate IDs",

  // Missing Table Headers
  "th-has-data-cells": "Missing Table Headers",
  "td-headers-attr": "Missing Table Headers",
  "scope-attr-valid": "Missing Table Headers",
  "table-duplicate-name": "Missing Table Headers",

  // Missing Skip Navigation Link
  bypass: "Missing Skip Navigation Link",

  // Zoom/Responsive Accessibility Issues
  "meta-viewport": "Zoom/Responsive Accessibility Issues",
  "css-orientation-lock": "Zoom/Responsive Accessibility Issues",
  "meta-viewport-large": "Zoom/Responsive Accessibility Issues",

  // Screen Reader Compatibility Issues
  "aria-hidden-body": "Screen Reader Compatibility Issues",
  "aria-hidden-focus": "Screen Reader Compatibility Issues",
  "presentation-role-conflict": "Screen Reader Compatibility Issues",
  "frame-title": "Screen Reader Compatibility Issues",
  "frame-title-unique": "Screen Reader Compatibility Issues",
  blink: "Screen Reader Compatibility Issues",
  marquee: "Screen Reader Compatibility Issues",
  "server-side-image-map": "Screen Reader Compatibility Issues",
};

/** All 20 category labels this scan can classify a finding under. */
const ACCESSIBILITY_CATEGORIES = [
  "Missing Alt Text",
  "Missing Form Labels",
  "Missing Accessible Name",
  "Low Color Contrast",
  "Keyboard Navigation Issues",
  "Missing Focus Indicator",
  "Missing H1",
  "Heading Hierarchy Issues",
  "Missing Page Title",
  "Missing HTML Lang Attribute",
  "Invalid ARIA Attributes",
  "Broken ARIA References",
  "Empty Buttons/Links",
  "Duplicate IDs",
  "Missing Table Headers",
  "Missing Skip Navigation Link",
  "Small Touch Targets",
  "Zoom/Responsive Accessibility Issues",
  "Screen Reader Compatibility Issues",
  "Live Region (aria-live) Issues",
];

function mapAxeRuleToCategory(ruleId) {
  return AXE_RULE_TO_CATEGORY[ruleId] || null;
}

module.exports = { ACCESSIBILITY_CATEGORIES, mapAxeRuleToCategory };
