const cheerio = require("cheerio");

const SOCIAL_DOMAINS = ["facebook.com", "instagram.com", "linkedin.com", "youtube.com", "twitter.com", "x.com", "tiktok.com"];
const APP_STORE_DOMAINS = ["apps.apple.com", "play.google.com"];

function hrefsOf(root) {
  return root
    .find("a[href]")
    .map((_, el) => (el.attribs && el.attribs.href) || "")
    .get();
}

// cheerio's .text() concatenates every text node with NO separator between
// them, so "...Become a member</button><button>More about MDU" collapses
// into "become a membermore about mdu" — silently breaking any keyword/
// phrase match that happens to land on an element boundary. Collecting
// each text node individually and joining with a real space avoids that.
function normalizedText(root) {
  const parts = [];
  root
    .find("*")
    .addBack()
    .contents()
    .each((_, node) => {
      if (node.type === "text") {
        const t = (node.data || "").trim();
        if (t) parts.push(t);
      }
    });
  return parts.join(" ").replace(/\s+/g, " ").toLowerCase();
}

// Direct children that look like repeated "cards" (a heading + a link) —
// one generic signal for a blog/article or course/product listing. Doesn't
// catch every real layout on its own (e.g. carousels wrap cards a level
// deeper, and some card links aren't literal <a> tags), so it's combined
// with articleCardCount below rather than relied on alone.
function cardLikeChildren($, root) {
  return root.children().filter((_, el) => {
    const $el = $(el);
    return $el.find("h1, h2, h3, h4").length > 0 && $el.find("a").length > 0;
  });
}

// role="article" is a standard, structure-independent a11y marker for "this
// is one card in a list of similar items" — catches carousel/grid layouts
// that cardLikeChildren's direct-children-with-a-link heuristic misses
// (nested wrapper divs, JS-driven navigation instead of a plain <a>).
function articleCardCount(root) {
  return root.find('[role="article"]').length;
}

/**
 * Deterministic, AI-free classification + step generation for a scanned
 * component. Used as the baseline every component gets (cheap, instant, no
 * API key required) and as the fallback when the LLM is disabled, out of
 * quota, or returns nothing usable for a given component — mirrors the
 * project's existing convention (see llm.service.js) of always keeping a
 * rules-based path so the app works fully offline/keyless.
 *
 * Recognizes real-world QA-relevant categories (login, membership signup,
 * payment, region/locale selectors, blog/course listings, contact forms,
 * click-to-call, FAQ, app-store links, social links) via structural DOM
 * signals — hrefs, form field names, repeated card patterns, keywords in
 * the component's own visible text — not any one site's specific markup,
 * so it generalizes across pages.
 */
function classifyByRules(html) {
  const $ = cheerio.load(`<div>${html}</div>`);
  const root = $("div").first();
  const text = normalizedText(root);
  const hrefs = hrefsOf(root);

  const hasSearchInput =
    root.find('input[type="search"]').length > 0 ||
    root.find('input[name*="search" i]').length > 0 ||
    root.find('input[placeholder*="search" i]').length > 0;
  const hasPasswordInput = root.find('input[type="password"]').length > 0;
  const hasEmailInput = root.find('input[type="email"]').length > 0;
  const hasPaymentField = root.find(
    'input[name*="card" i], input[id*="card" i], input[placeholder*="card number" i], input[name*="cvv" i], input[name*="cvc" i], input[autocomplete="cc-number"]'
  ).length > 0;
  const formCount = root.find("form").length;
  // Real nav menus aren't always <a>-based — many use JS-driven <button
  // role="menuitem"> for dropdown triggers, which a plain anchor count
  // would completely miss.
  const navLinkCount = Math.max(root.find("a").length, root.find('[role="menuitem"], [role="menu"] a, [role="menu"] button').length);
  const buttonCount = root.find('button, input[type="submit"], [role="button"]').length;
  const imgCount = root.find("img").length;
  const selectCount = root.find("select").length;

  const telLinkCount = hrefs.filter((h) => h.toLowerCase().startsWith("tel:")).length;
  const mailtoLinkCount = hrefs.filter((h) => h.toLowerCase().startsWith("mailto:")).length;
  const socialLinkCount = hrefs.filter((h) => SOCIAL_DOMAINS.some((d) => h.includes(d))).length;
  const appStoreLinkCount = hrefs.filter((h) => APP_STORE_DOMAINS.some((d) => h.includes(d))).length;

  // A nav/footer link LIST commonly includes a link labeled "Pay your
  // subscription" or "Become a member" pointing at those flows elsewhere —
  // that's not the same as this component BEING a payment/signup form.
  // Gate the text-keyword classifications below on "this isn't just a big
  // list of unrelated links" so a single matching link label doesn't
  // relabel the whole nav/footer.
  const isLinkHeavy = navLinkCount >= 8;

  // ---- Highest-signal / most specific checks first ----

  if (hasPaymentField || (formCount > 0 && /\b(pay your subscription|make a payment|billing details|checkout)\b/.test(text))) {
    return { functionality: "Payment / subscription", description: "Collects payment or billing details to process a transaction." };
  }

  if (hasPasswordInput && /\b(join|become a member|sign up|register|membership application)\b/.test(text)) {
    return { functionality: "Membership sign-up", description: "Registers a new member, collecting account and credential details." };
  }
  if (hasPasswordInput && hasEmailInput) {
    return { functionality: "Login form", description: "Collects credentials to authenticate an existing member." };
  }
  if (hasPasswordInput) {
    return { functionality: "Authentication form", description: "Collects a password to authenticate a user." };
  }
  if (!hasPasswordInput && !isLinkHeavy && /\b(join now|join today|become a member|membership application)\b/.test(text) && (buttonCount > 0 || navLinkCount > 0)) {
    return { functionality: "Membership sign-up", description: "Entry point into a membership registration flow." };
  }

  if (hasSearchInput) {
    return { functionality: "Search", description: "Lets the user search via a text input." };
  }

  if (selectCount > 0 && /\b(select your region|customise for|choose your country|choose your region|select region|select country)\b/.test(text)) {
    return { functionality: "Region / locale selector", description: "Lets the user pick a region or country to customize content." };
  }
  if (selectCount > 0 && root.find('select[name*="region" i], select[id*="region" i], select[name*="country" i], select[id*="country" i], select[name*="locale" i], select[id*="locale" i]').length > 0) {
    return { functionality: "Region / locale selector", description: "Lets the user pick a region or locale to customize content." };
  }

  if (/\b(faq|frequently asked questions?)\b/.test(text) || root.find('[class*="faq" i], [id*="faq" i]').length > 0) {
    return { functionality: "FAQ / accordion", description: "Expandable question-and-answer list." };
  }

  if (formCount > 0 && root.find("textarea").length > 0 && (hasEmailInput || /\b(contact us|get in touch|write for us|get advice)\b/.test(text))) {
    return { functionality: "Contact / content submission form", description: "Collects a message and contact details for submission." };
  }

  if (telLinkCount > 0 && navLinkCount <= telLinkCount + mailtoLinkCount + 2) {
    return { functionality: "Click-to-call contact", description: "Provides a phone number as a tap/click-to-call link." };
  }

  if (appStoreLinkCount > 0) {
    return { functionality: "App download links", description: "Links to the iOS/Android app store listings." };
  }

  if (socialLinkCount >= 2) {
    return { functionality: "Social media links", description: "Links out to the organization's social media profiles." };
  }

  const cards = cardLikeChildren($, root);
  const listingSignalCount = Math.max(cards.length, articleCardCount(root));
  if (listingSignalCount >= 3) {
    const cardsText = cards.length >= 3 ? normalizedText(cards) : text;
    const looksLikeCourse = /(£|\$|€)\s?\d|\bfree\b|\bcpd\b|\bbook now\b|\bbook a place\b|\benrol/i.test(cardsText);
    if (looksLikeCourse) {
      return { functionality: "Course listing (booking)", description: "Lists bookable courses or events with pricing/availability." };
    }
    return { functionality: "Blog / article listing", description: "Lists articles or posts, each linking to full content." };
  }

  if (formCount > 0) {
    return { functionality: "Form submission", description: "Collects user input and submits a form." };
  }

  if (navLinkCount >= 3) {
    const hasSubmenu = root.find('[aria-haspopup], [aria-expanded], [class*="submenu" i], [class*="dropdown" i]').length > 0;
    return hasSubmenu
      ? { functionality: "Multi-level navigation menu", description: "Site navigation with nested/expandable submenus." }
      : { functionality: "Site navigation", description: "Provides links to other pages or sections." };
  }

  if (buttonCount > 0) {
    return { functionality: "Interactive controls", description: "Contains clickable buttons or actions." };
  }
  if (imgCount >= 2) {
    return { functionality: "Media / image display", description: "Displays a set of images or promotional content." };
  }
  return { functionality: "Static content", description: "Displays informational content with no detected interactivity." };
}

// Minimal CSS.escape equivalent (Node has no CSS.escape global) — good
// enough for the real-world ids/names this sees, without pulling in a
// dependency just for this.
function cssEscape(value) {
  return String(value).replace(/([^a-zA-Z0-9_-])/g, "\\$1");
}

// Escapes a value going inside a double-quoted attribute/text selector.
function attrEscape(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function shortTextOf(node) {
  const clean = node.text().trim().replace(/\s+/g, " ");
  return clean && clean.length <= 40 ? clean : null;
}

// Builds a resolvable, as-unique-as-possible CSS selector for an element,
// scoped to the component's own HTML. Prefers stable, semantically real
// identifiers (id, aria-label, name, a real href, visible text) over
// generic tag+type selectors — bare `button[type="button"]`-style
// selectors can match many elements against real nav/menu markup. A bare
// tag-only selector is only used as a last resort, and callers should
// still treat the result as "best effort, not guaranteed unique" (see
// buildLocator's `.first()` in functionalTesting.service.js).
function selectorFor($, el) {
  const node = $(el);
  const tag = ($(el).prop("tagName") || "").toLowerCase() || "*";
  const id = node.attr("id");
  if (id) return `#${cssEscape(id)}`;
  const ariaLabel = node.attr("aria-label");
  if (ariaLabel) return `${tag}[aria-label="${attrEscape(ariaLabel)}"]`;
  const name = node.attr("name");
  if (name) return `${tag}[name="${attrEscape(name)}"]`;
  if (tag === "a") {
    const href = node.attr("href");
    if (href && href !== "#" && !href.toLowerCase().startsWith("javascript:")) {
      return `a[href="${attrEscape(href)}"]`;
    }
  }
  const text = shortTextOf(node);
  if (text) return `${tag}:has-text("${attrEscape(text)}")`;
  const type = node.attr("type");
  if (type) return `${tag}[type="${attrEscape(type)}"]`;
  return tag;
}

function sampleValueFor($, el) {
  const node = $(el);
  const type = (node.attr("type") || "text").toLowerCase();
  if (type === "email") return "test@example.com";
  if (type === "search") return "test query";
  if (type === "tel") return "5551234567";
  if (type === "number") return "1";
  if (type === "password") return "TestPassword123!";
  return "Test value";
}

function isRealLink(href) {
  const h = (href || "").toLowerCase();
  return Boolean(href) && href !== "#" && !h.startsWith("javascript:") && !h.startsWith("tel:") && !h.startsWith("mailto:");
}

/**
 * Generates up to 2 real, executable steps for a component using simple
 * DOM heuristics:
 *   1. Fill the first fillable input/textarea, or if none, pick an option
 *      on the first <select> (e.g. a region/locale dropdown).
 *   2. Click the first button/submit — or, for components with no button
 *      (nav/footer link lists), click the first real link instead so
 *      navigation-only components still get a meaningful step instead of
 *      being skipped. `tel:`/`mailto:` links are verified (assert_visible)
 *      rather than clicked, since "clicking" one doesn't produce a
 *      browser-testable outcome (it hands off to the OS dialer/mail app).
 *      Link-click steps are flagged `nav: true` so the execution engine
 *      knows to wait for the resulting page load. No LLM required.
 */
function generateStepsByRules(html) {
  const $ = cheerio.load(`<div>${html}</div>`);
  const root = $("div").first();
  const steps = [];

  const fillable = root
    .find('input, textarea')
    .filter((_, el) => {
      const type = ($(el).attr("type") || "text").toLowerCase();
      return !["hidden", "checkbox", "radio", "submit", "button", "file", "image", "reset"].includes(type);
    })
    .first();
  if (fillable.length) {
    steps.push({
      action: "fill",
      selector: selectorFor($, fillable.get(0)),
      value: sampleValueFor($, fillable.get(0)),
      expected: "",
    });
  } else {
    const select = root.find("select").first();
    if (select.length) {
      const option = select.find('option[value]:not([value=""])').first();
      const value = option.length ? option.attr("value") : null;
      if (value) {
        steps.push({ action: "select", selector: selectorFor($, select.get(0)), value, expected: "" });
      }
    }
  }

  const clickable = root.find('button, input[type="submit"], [role="button"]').first();
  if (clickable.length) {
    steps.push({
      action: "click",
      selector: selectorFor($, clickable.get(0)),
      value: "",
      expected: "",
      nav: false,
    });
  } else {
    const contactLink = root
      .find("a[href]")
      .filter((_, el) => {
        const href = ($(el).attr("href") || "").toLowerCase();
        return href.startsWith("tel:") || href.startsWith("mailto:");
      })
      .first();
    if (contactLink.length) {
      steps.push({
        action: "assert_visible",
        selector: selectorFor($, contactLink.get(0)),
        value: "",
        expected: `Contact link "${contactLink.attr("href")}" should be visible`,
      });
    } else {
      const link = root
        .find("a[href]")
        .filter((_, el) => isRealLink($(el).attr("href")))
        .first();
      if (link.length) {
        steps.push({
          action: "click",
          selector: selectorFor($, link.get(0)),
          value: "",
          expected: `Navigating to "${link.attr("href")}" should load a real page`,
          nav: true,
        });
      }
    }
  }

  if (steps.length === 0) {
    const heading = root.find("h1, h2, h3").first();
    if (heading.length) {
      steps.push({
        action: "assert_visible",
        selector: selectorFor($, heading.get(0)),
        value: "",
        expected: "Heading should be visible",
      });
    }
  }

  return steps;
}

module.exports = { classifyByRules, generateStepsByRules };
