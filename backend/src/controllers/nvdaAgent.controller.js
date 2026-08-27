const { getBrowser } = require("../services/browser.service");
const logger = require("../utils/logger");

/**
 * Runs entirely inside the page (browser context) — must be self-contained,
 * no references to outer Node scope. Walks the rendered DOM (not raw HTML)
 * so it sees what NVDA would actually encounter: computed visibility,
 * accessible names, form state.
 */
function collectElements() {
  function isVisible(el) {
    const style = window.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 || rect.height > 0;
  }

  function accessibleName(el) {
    const ariaLabel = el.getAttribute("aria-label");
    if (ariaLabel && ariaLabel.trim()) return ariaLabel.trim();

    const labelledBy = el.getAttribute("aria-labelledby");
    if (labelledBy) {
      const text = labelledBy
        .split(/\s+/)
        .map((id) => document.getElementById(id)?.textContent || "")
        .join(" ")
        .trim();
      if (text) return text;
    }

    if (el.id) {
      const label = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (label && label.textContent && label.textContent.trim()) return label.textContent.trim();
    }
    const wrappingLabel = el.closest("label");
    if (wrappingLabel && wrappingLabel.textContent && wrappingLabel.textContent.trim()) {
      return wrappingLabel.textContent.trim();
    }

    if (el.tagName === "IMG") {
      const alt = el.getAttribute("alt");
      return alt && alt.trim() ? alt.trim() : "";
    }

    const title = el.getAttribute("title");
    const text = (el.innerText || el.textContent || "").trim().replace(/\s+/g, " ");
    if (text) return text.slice(0, 120);
    if (el.getAttribute("placeholder")) return el.getAttribute("placeholder").trim();
    if (title && title.trim()) return title.trim();
    return "";
  }

  function describeInputRole(el) {
    const tag = el.tagName.toLowerCase();
    if (tag === "textarea") return "Edit text multiline";
    if (tag === "select") return el.multiple ? "List box" : "Combo box";
    const type = (el.getAttribute("type") || "text").toLowerCase();
    if (type === "checkbox") return "Check box";
    if (type === "radio") return "Radio button";
    return "Edit text";
  }

  function inputState(el) {
    const tag = el.tagName.toLowerCase();
    const type = (el.getAttribute("type") || "text").toLowerCase();
    const parts = [];
    if (el.required || el.getAttribute("aria-required") === "true") parts.push("required");
    if (el.disabled || el.getAttribute("aria-disabled") === "true") parts.push("disabled");

    if (type === "checkbox" || type === "radio") {
      return { roleSuffix: parts.length ? ` ${parts.join(", ")}` : "", stateText: el.checked ? "checked" : "not checked" };
    }
    if (tag === "select") {
      const selected = el.options && el.selectedIndex >= 0 ? el.options[el.selectedIndex].text.trim() : "";
      return { roleSuffix: parts.length ? ` ${parts.join(", ")}` : "", stateText: selected || "Blank" };
    }
    const val = (el.value || "").trim();
    return { roleSuffix: parts.length ? ` ${parts.join(", ")}` : "", stateText: val ? val.slice(0, 60) : "Blank" };
  }

  const headingEls = Array.from(document.querySelectorAll("h1, h2, h3, h4, h5, h6"));
  const linkEls = Array.from(document.querySelectorAll("a[href]"));
  const buttonEls = Array.from(
    document.querySelectorAll('button, [role="button"], input[type="submit"], input[type="button"], input[type="reset"]')
  );
  const formEls = Array.from(document.querySelectorAll("input, select, textarea")).filter(
    (el) => !["submit", "button", "reset"].includes((el.getAttribute("type") || "").toLowerCase())
  );
  const imageEls = Array.from(document.querySelectorAll("img"));

  const docOrder = (els) => els.filter(isVisible);

  const groups = [
    { key: "heading", els: docOrder(headingEls) },
    { key: "link", els: docOrder(linkEls) },
    { key: "button", els: docOrder(buttonEls) },
    { key: "input", els: docOrder(formEls) },
    { key: "image", els: docOrder(imageEls) },
  ];

  const results = [];
  groups.forEach(({ key, els }) => {
    els.forEach((el) => {
      const name = accessibleName(el);
      const rect = el.getBoundingClientRect();
      const base = {
        element_type: key,
        tag: el.tagName.toLowerCase(),
        label: name,
        rect: {
          x: Math.round(rect.left + window.scrollX),
          y: Math.round(rect.top + window.scrollY),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        },
      };
      if (key === "heading") {
        base.level = Number(el.tagName[1]);
      } else if (key === "link") {
        base.href = el.getAttribute("href") || "";
      } else if (key === "button") {
        base.disabled = Boolean(el.disabled || el.getAttribute("aria-disabled") === "true");
      } else if (key === "input") {
        const { roleSuffix, stateText } = inputState(el);
        base.role = describeInputRole(el);
        base.roleSuffix = roleSuffix;
        base.state = stateText;
      } else if (key === "image") {
        base.hasAlt = el.hasAttribute("alt") && el.getAttribute("alt").trim() !== "";
      }
      results.push(base);
    });
  });

  return {
    elements: results,
    pageWidth: Math.round(document.documentElement.scrollWidth),
    pageHeight: Math.round(document.documentElement.scrollHeight),
  };
}

function buildSpeechAndTheory(el, pageUrl) {
  switch (el.element_type) {
    case "heading": {
      const label = el.label || "Untitled section";
      return {
        nvda_speech: `${label}, Heading level ${el.level}`,
        component_theory: `This is a level ${el.level} heading that organizes the page content under "${label}".`,
      };
    }
    case "link": {
      const label = el.label || "Unlabeled link";
      let dest;
      try {
        dest = new URL(el.href, pageUrl).href;
      } catch {
        dest = el.href;
      }
      const isAnchor = el.href.startsWith("#");
      return {
        nvda_speech: `${label}, Link`,
        component_theory: isAnchor
          ? `This link jumps to the "${el.href.slice(1) || "top"}" section within the same page.`
          : `This link navigates the user to ${dest}.`,
      };
    }
    case "button": {
      const label = el.label || "Unlabeled button";
      return {
        nvda_speech: el.disabled ? `${label}, Button, Disabled` : `${label}, Button`,
        component_theory: `Activating this button triggers the "${label}" action.`,
      };
    }
    case "input": {
      const label = el.label || "Unlabeled field";
      return {
        nvda_speech: `${label}, ${el.role}${el.roleSuffix}, ${el.state}`,
        component_theory: `This ${el.role.toLowerCase()} field lets the user provide "${label}"${
          el.roleSuffix.includes("required") ? " (required to submit the form)" : ""
        }.`,
      };
    }
    case "image": {
      if (!el.hasAlt) {
        return {
          nvda_speech: "Unlabeled Image",
          component_theory: "This image has no alternative text, so a screen reader user won't know what it depicts.",
        };
      }
      const label = el.label || "Image";
      return {
        nvda_speech: `${label}, Image`,
        component_theory: `This image visually shows: ${label}.`,
      };
    }
    default:
      return { nvda_speech: `${el.label}, ${el.element_type}`, component_theory: "" };
  }
}

/**
 * Runs inside the proxied page (see `proxy` below), injected as a raw
 * <script> tag — same restrictions as collectElements: no Node scope, no
 * template-literal backticks (would break out of the surrounding JS
 * template string it's embedded in), self-contained. Re-implements the same
 * classification/speech rules as collectElements/buildSpeechAndTheory above
 * in plain browser JS so the live iframe can announce on real focus/click
 * without any server round-trip.
 */
const NVDA_IFRAME_SCRIPT = `
(function () {
  function isVisible(el) {
    var style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
    var rect = el.getBoundingClientRect();
    return rect.width > 0 || rect.height > 0;
  }
  function accessibleName(el) {
    var ariaLabel = el.getAttribute('aria-label');
    if (ariaLabel && ariaLabel.trim()) return ariaLabel.trim();
    var labelledBy = el.getAttribute('aria-labelledby');
    if (labelledBy) {
      var text = labelledBy.split(/\\s+/).map(function (id) {
        var e = document.getElementById(id);
        return e ? e.textContent : '';
      }).join(' ').trim();
      if (text) return text;
    }
    if (el.id) {
      try {
        var label = document.querySelector('label[for="' + CSS.escape(el.id) + '"]');
        if (label && label.textContent && label.textContent.trim()) return label.textContent.trim();
      } catch (e) {}
    }
    var wrappingLabel = el.closest('label');
    if (wrappingLabel && wrappingLabel.textContent && wrappingLabel.textContent.trim()) return wrappingLabel.textContent.trim();
    if (el.tagName === 'IMG') {
      var alt = el.getAttribute('alt');
      return alt && alt.trim() ? alt.trim() : '';
    }
    var title = el.getAttribute('title');
    var text2 = (el.innerText || el.textContent || '').trim().replace(/\\s+/g, ' ');
    if (text2) return text2.slice(0, 120);
    if (el.getAttribute('placeholder')) return el.getAttribute('placeholder').trim();
    if (title && title.trim()) return title.trim();
    return '';
  }
  function describeInputRole(el) {
    var tag = el.tagName.toLowerCase();
    if (tag === 'textarea') return 'Edit text multiline';
    if (tag === 'select') return el.multiple ? 'List box' : 'Combo box';
    var type = (el.getAttribute('type') || 'text').toLowerCase();
    if (type === 'checkbox') return 'Check box';
    if (type === 'radio') return 'Radio button';
    return 'Edit text';
  }
  function inputState(el) {
    var tag = el.tagName.toLowerCase();
    var type = (el.getAttribute('type') || 'text').toLowerCase();
    var parts = [];
    if (el.required || el.getAttribute('aria-required') === 'true') parts.push('required');
    if (el.disabled || el.getAttribute('aria-disabled') === 'true') parts.push('disabled');
    if (type === 'checkbox' || type === 'radio') {
      return { roleSuffix: parts.length ? ' ' + parts.join(', ') : '', stateText: el.checked ? 'checked' : 'not checked' };
    }
    if (tag === 'select') {
      var selected = el.options && el.selectedIndex >= 0 ? el.options[el.selectedIndex].text.trim() : '';
      return { roleSuffix: parts.length ? ' ' + parts.join(', ') : '', stateText: selected || 'Blank' };
    }
    var val = (el.value || '').trim();
    return { roleSuffix: parts.length ? ' ' + parts.join(', ') : '', stateText: val ? val.slice(0, 60) : 'Blank' };
  }
  function classify(el) {
    var tag = el.tagName.toLowerCase();
    if (/^h[1-6]$/.test(tag)) return 'heading';
    if (tag === 'a' && el.hasAttribute('href')) return 'link';
    if (tag === 'button' || el.getAttribute('role') === 'button') return 'button';
    if (tag === 'input') {
      var t = (el.getAttribute('type') || 'text').toLowerCase();
      if (['submit', 'button', 'reset'].indexOf(t) !== -1) return 'button';
      return 'input';
    }
    if (tag === 'select' || tag === 'textarea') return 'input';
    if (tag === 'img') return 'image';
    return null;
  }
  function speechFor(el, type) {
    var label = accessibleName(el);
    if (type === 'heading') {
      var level = Number(el.tagName[1]);
      var hLabel = label || 'Untitled section';
      return { nvda_speech: hLabel + ', Heading level ' + level, component_theory: 'This is a level ' + level + ' heading that organizes the page content under "' + hLabel + '".' };
    }
    if (type === 'link') {
      var href = el.getAttribute('href') || '';
      var dest;
      try { dest = new URL(href, location.href).href; } catch (e) { dest = href; }
      var isAnchor = href.indexOf('#') === 0;
      var lLabel = label || 'Unlabeled link';
      return { nvda_speech: lLabel + ', Link', component_theory: isAnchor ? 'This link jumps to the "' + (href.slice(1) || 'top') + '" section within the same page.' : 'This link navigates the user to ' + dest + '.' };
    }
    if (type === 'button') {
      var disabled = Boolean(el.disabled || el.getAttribute('aria-disabled') === 'true');
      var bLabel = label || 'Unlabeled button';
      return { nvda_speech: bLabel + ', Button' + (disabled ? ', Disabled' : ''), component_theory: 'Activating this button triggers the "' + bLabel + '" action.' };
    }
    if (type === 'input') {
      var role = describeInputRole(el);
      var st = inputState(el);
      var iLabel = label || 'Unlabeled field';
      return { nvda_speech: iLabel + ', ' + role + st.roleSuffix + ', ' + st.stateText, component_theory: 'This ' + role.toLowerCase() + ' field lets the user provide "' + iLabel + '"' + (st.roleSuffix.indexOf('required') !== -1 ? ' (required to submit the form)' : '') + '.' };
    }
    if (type === 'image') {
      var hasAlt = el.hasAttribute('alt') && el.getAttribute('alt').trim() !== '';
      if (!hasAlt) return { nvda_speech: 'Unlabeled Image', component_theory: "This image has no alternative text, so a screen reader user won't know what it depicts." };
      var imgLabel = label || 'Image';
      return { nvda_speech: imgLabel + ', Image', component_theory: 'This image visually shows: ' + imgLabel + '.' };
    }
    return { nvda_speech: (label || '') + ', ' + type, component_theory: '' };
  }
  var SELECTOR = 'h1,h2,h3,h4,h5,h6,a[href],button,[role="button"],input,select,textarea,img';
  function collect() {
    var all = Array.prototype.slice.call(document.querySelectorAll(SELECTOR));
    var groups = { heading: [], link: [], button: [], input: [], image: [] };
    all.forEach(function (el) {
      if (!isVisible(el)) return;
      var type = classify(el);
      if (!type) return;
      groups[type].push(el);
    });
    var order = ['heading', 'link', 'button', 'input', 'image'];
    var flat = [];
    order.forEach(function (t) { groups[t].forEach(function (el) { flat.push({ el: el, type: t }); }); });
    return flat;
  }
  function announce(el, type) {
    var s = speechFor(el, type);
    window.parent.postMessage({ source: 'nvda-agent-iframe', element_type: type, nvda_speech: s.nvda_speech, component_theory: s.component_theory }, '*');
  }
  document.addEventListener('focusin', function (e) {
    var type = classify(e.target);
    if (type) announce(e.target, type);
  }, true);
  document.addEventListener('click', function (e) {
    var anchor = e.target.closest('a[href]');
    if (anchor) {
      var href = anchor.getAttribute('href') || '';
      var lower = href.toLowerCase();
      if (href && lower.indexOf('#') !== 0 && lower.indexOf('javascript:') !== 0 && lower.indexOf('mailto:') !== 0 && lower.indexOf('tel:') !== 0) {
        e.preventDefault();
        var abs;
        try { abs = new URL(href, location.href).href; } catch (err) { abs = href; }
        announce(anchor, 'link');
        window.parent.postMessage({ source: 'nvda-agent-iframe', type: 'navigate', url: abs }, '*');
        // Re-route through our own proxy (same trick as the initial load) so
        // the next page stays framable instead of refusing to embed.
        location.href = location.origin + '/api/nvda-agent/proxy?url=' + encodeURIComponent(abs);
        return;
      }
    }
    var el = e.target.closest(SELECTOR);
    if (!el) return;
    var type = classify(el);
    if (type) announce(el, type);
  }, true);
  window.addEventListener('message', function (e) {
    var data = e.data || {};
    if (data.type === 'nvda-goto' && typeof data.index === 'number') {
      var list = collect();
      var item = list[data.index];
      if (!item) return;
      item.el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      try { item.el.focus({ preventScroll: true }); } catch (e2) { try { item.el.focus(); } catch (e3) {} }
      announce(item.el, item.type);
      window.parent.postMessage({ source: 'nvda-agent-iframe', type: 'ack', index: data.index, count: list.length }, '*');
    }
  });
  // A real screen reader announces the page as soon as it finishes loading
  // — without this, a page reached by clicking a link inside the
  // walkthrough would otherwise stay silent until the user tabs or clicks
  // something on it. Fires on the very first load too, not just navigations.
  function announcePageLoad() {
    var pageTitle = document.title || location.hostname;
    var list = collect();
    window.parent.postMessage({
      source: 'nvda-agent-iframe',
      type: 'ready',
      count: list.length,
      nvda_speech: pageTitle + ', page loaded',
      component_theory: list.length
        ? ('Finished loading "' + pageTitle + '" — ' + list.length + ' headings, links, buttons, form controls and images are available to Tab or click through.')
        : ('Finished loading "' + pageTitle + '" — no headings, links, buttons, form controls or images were found on it.'),
    }, '*');
  }
  if (document.readyState === 'complete') announcePageLoad();
  else window.addEventListener('load', announcePageLoad);
})();
`;

/**
 * Serves the target page through our own origin so it can be embedded in
 * the walkthrough iframe — most real sites refuse to be framed directly
 * (X-Frame-Options / CSP frame-ancestors), so this fetches the HTML
 * ourselves and re-serves it without those headers, plus a <base> tag so
 * relative assets still resolve against the original site, plus the
 * NVDA_IFRAME_SCRIPT above so clicks/focus inside the iframe announce back
 * to the parent via postMessage. Best-effort: sites with anti-framing JS or
 * strict per-resource CSP can still misbehave.
 */
async function proxy(req, res) {
  const { url } = req.query || {};
  if (!url || typeof url !== "string") {
    return res.status(400).send("url query param is required");
  }
  let target;
  try {
    target = new URL(url);
    if (!["http:", "https:"].includes(target.protocol)) throw new Error("bad protocol");
  } catch {
    return res.status(400).send("Enter a valid http(s) URL");
  }

  try {
    const upstream = await fetch(target.href, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; AI-QA-Engineer-NVDA-Agent/1.0)" },
      redirect: "follow",
    });
    const contentType = upstream.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) {
      return res.status(415).send("That URL did not return an HTML page.");
    }
    let html = await upstream.text();

    const baseTag = `<base href="${target.href}">`;
    html = /<head[^>]*>/i.test(html)
      ? html.replace(/<head[^>]*>/i, (m) => `${m}${baseTag}`)
      : `<head>${baseTag}</head>${html}`;

    const injectedScript = `<script>${NVDA_IFRAME_SCRIPT}</script>`;
    html = /<\/body>/i.test(html) ? html.replace(/<\/body>/i, `${injectedScript}</body>`) : `${html}${injectedScript}`;

    res.set("Content-Type", "text/html; charset=utf-8");
    // Deliberately NOT forwarding the upstream response's own headers
    // (X-Frame-Options / CSP) — that's the whole point of this route.
    res.send(html);
  } catch (err) {
    logger.warn("nvda-agent", `Proxy failed for ${url}: ${err.message}`);
    res.status(502).send(`Could not load that page: ${err.message}`);
  }
}

async function scan(req, res) {
  const { url } = req.body || {};
  if (!url || typeof url !== "string") {
    return res.status(400).json({ error: "url is required" });
  }
  let target;
  try {
    target = new URL(url);
    if (!["http:", "https:"].includes(target.protocol)) throw new Error("bad protocol");
  } catch {
    return res.status(400).json({ error: "Enter a valid http(s) URL" });
  }

  let page;
  try {
    const browser = await getBrowser();
    page = await browser.newPage();
    await page.setViewport({ width: 1366, height: 900 });
    await page.goto(target.href, { waitUntil: "networkidle2", timeout: 30000 });

    const { elements: raw, pageWidth, pageHeight } = await page.evaluate(collectElements);
    const results = raw.map((el, i) => ({
      tab_order: i + 1,
      element_type: el.element_type,
      rect: el.rect,
      ...buildSpeechAndTheory(el, target.href),
    }));

    // Capped page height keeps the full-page screenshot (and the response
    // payload) bounded on very long pages — the walkthrough overlay math
    // below still works since it positions elements as a % of this same
    // capped height, not the raw document height. Resizing only the
    // viewport's height (not width) doesn't reflow the already-captured
    // element rects, so they stay valid against this screenshot.
    const cappedHeight = Math.min(pageHeight, 8000);
    await page.setViewport({ width: 1366, height: cappedHeight });
    const screenshotBuffer = await page.screenshot({ type: "jpeg", quality: 70 });

    res.json({
      url: target.href,
      scannedAt: new Date().toISOString(),
      count: results.length,
      pageWidth,
      pageHeight: cappedHeight,
      screenshot: `data:image/jpeg;base64,${screenshotBuffer.toString("base64")}`,
      elements: results,
    });
  } catch (err) {
    logger.warn("nvda-agent", `Scan failed for ${url}: ${err.message}`);
    res.status(502).json({ error: `Could not load or scan that page: ${err.message}` });
  } finally {
    if (page) await page.close().catch(() => {});
  }
}

module.exports = { scan, proxy };
