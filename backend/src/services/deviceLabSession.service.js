const { chromium, firefox, webkit } = require("@playwright/test");

const logger = require("../utils/logger");
const { getDeviceDescriptor } = require("../data/deviceCatalog");

const ENGINES = { chromium, firefox, webkit };
const IDLE_REFRESH_MS = 1500;
const NAV_TIMEOUT_MS = 30000;
const BURST_SCREENSHOT_THROTTLE_MS = 200;

// One live Playwright page per connected socket — this is a real browser
// engine actually loading the site, not a mockup. Interactions (tap, type,
// scroll, navigate) run against that same page, and every action/load
// pushes a fresh screenshot back over the socket so the frame stays in
// sync with what really happened.
const sessions = new Map();

async function screenshotAndEmit(socket, session) {
  // The idle refresh timer and an in-flight input action can otherwise both
  // call page.screenshot() at once; overlapping captures were the source of
  // the intermittent "sometimes it just doesn't update" feel.
  if (session.shooting) return;
  session.shooting = true;
  try {
    const { page } = session;
    if (page.isClosed()) return;
    // JPEG instead of PNG: for a full-viewport screenshot streamed on every
    // action/idle-tick, PNG's lossless encode is both slower to produce and
    // 3-5x larger over the socket than a quality-80 JPEG — the difference
    // is the gap between input feeling laggy and feeling instant.
    const buffer = await page.screenshot({ timeout: 8000, type: "jpeg", quality: 80 });
    socket.emit("device-lab:frame", {
      image: `data:image/jpeg;base64,${buffer.toString("base64")}`,
      url: page.url(),
    });
  } catch {
    // page mid-navigation or closed — next tick will catch up
  } finally {
    session.shooting = false;
  }
}

function startIdleLoop(socket, session) {
  session.idleTimer = setInterval(() => {
    if (session.pending === 0) screenshotAndEmit(socket, session);
  }, IDLE_REFRESH_MS);
}

async function startSession(socket, { url, deviceId, orientation = "portrait", browserEngine }) {
  const found = getDeviceDescriptor(deviceId);
  if (!found) throw new Error(`Unknown device: ${deviceId}`);
  const { meta, descriptor } = found;

  let viewport = descriptor.viewport;
  if (orientation === "landscape" && meta.isMobile) {
    viewport = { width: viewport.height, height: viewport.width };
  }

  const engineName = browserEngine || meta.defaultBrowserType;

  // Launching a browser engine is the slow part (hundreds of ms to a few
  // seconds), so a plain URL change on the same device/orientation/engine
  // reuses the already-warm browser and just navigates it — this is what
  // was making every "Go" click feel slow, since it used to relaunch a
  // fresh browser from scratch every single time regardless of what changed.
  const existing = sessions.get(socket.id);
  const canReuse =
    existing &&
    !existing.page.isClosed() &&
    existing.device.id === meta.id &&
    existing.orientation === orientation &&
    existing.engineName === engineName;

  if (canReuse) {
    const session = existing;
    session.pending += 1;
    try {
      await session.page.goto(url, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT_MS });
    } finally {
      session.pending -= 1;
    }
    await screenshotAndEmit(socket, session);
    return { device: meta, orientation, url: session.page.url(), browserEngine: engineName };
  }

  await stopSession(socket);

  const engine = ENGINES[engineName] || chromium;

  const browser = await engine.launch({ headless: true });
  const context = await browser.newContext({ ...descriptor, viewport });
  const page = await context.newPage();

  const session = {
    browser,
    context,
    page,
    device: meta,
    orientation,
    engineName,
    pending: 0, // number of input actions queued/in-flight
    queue: Promise.resolve(), // FIFO chain so fast typing can't race/drop
    lastShotAt: 0,
    shooting: false,
    nextRequestId: 1,
    requestIds: new WeakMap(),
  };
  sessions.set(socket.id, session);

  page.on("load", () => {
    if (session.pending === 0) screenshotAndEmit(socket, session);
  });
  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame()) socket.emit("device-lab:navigated", { url: frame.url() });
  });
  page.on("crash", () => {
    logger.error("device-lab", "Page crashed — ending session");
    socket.emit("device-lab:error", { message: "The device's browser tab crashed. Press Go to start a new session." });
    stopSession(socket);
  });

  // ---- DevTools: Console ----
  page.on("console", (msg) => {
    socket.emit("device-lab:console", {
      level: msg.type(),
      text: msg.text(),
      ts: Date.now(),
    });
  });
  page.on("pageerror", (err) => {
    socket.emit("device-lab:console", {
      level: "error",
      text: err.message || String(err),
      ts: Date.now(),
    });
  });

  // ---- DevTools: Network ----
  page.on("request", (req) => {
    const id = session.nextRequestId++;
    session.requestIds.set(req, id);
    socket.emit("device-lab:network", {
      id,
      phase: "request",
      method: req.method(),
      url: req.url(),
      resourceType: req.resourceType(),
      ts: Date.now(),
    });
  });
  page.on("requestfinished", async (req) => {
    const id = session.requestIds.get(req);
    const response = await req.response().catch(() => null);
    socket.emit("device-lab:network", {
      id,
      phase: "response",
      status: response ? response.status() : null,
      ts: Date.now(),
    });
  });
  page.on("requestfailed", (req) => {
    const id = session.requestIds.get(req);
    socket.emit("device-lab:network", {
      id,
      phase: "failed",
      errorText: req.failure()?.errorText || "Failed",
      ts: Date.now(),
    });
  });

  session.pending += 1;
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT_MS });
  } finally {
    session.pending -= 1;
  }
  await screenshotAndEmit(socket, session);
  startIdleLoop(socket, session);

  return { device: meta, orientation, url: page.url(), browserEngine: engineName };
}

async function runAction(socket, session, action) {
  const { page, device } = session;
  try {
    switch (action.type) {
      case "click":
        if (device.hasTouch) await page.touchscreen.tap(action.x, action.y);
        else await page.mouse.click(action.x, action.y);
        break;
      case "type":
        await page.keyboard.type(action.text);
        break;
      case "key":
        await page.keyboard.press(action.key);
        break;
      case "scroll":
        // Playwright's mouse.wheel() throws "Mouse wheel is not supported in
        // mobile WebKit" on any touch-emulated WebKit context (all iOS
        // devices default to WebKit) — fall back to a direct scroll so
        // iPhone/iPad devices can scroll at all.
        try {
          await page.mouse.wheel(action.deltaX || 0, action.deltaY || 0);
        } catch {
          await page.evaluate(
            ([dx, dy]) => window.scrollBy(dx, dy),
            [action.deltaX || 0, action.deltaY || 0]
          );
        }
        break;
      case "navigate":
        await page.goto(action.url, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT_MS });
        break;
      case "back":
        await page.goBack({ waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT_MS }).catch(() => {});
        break;
      case "forward":
        await page.goForward({ waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT_MS }).catch(() => {});
        break;
      case "reload":
        await page.reload({ waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT_MS }).catch(() => {});
        break;
      default:
        return;
    }
  } catch (err) {
    logger.warn("device-lab", `Input action "${action.type}" failed: ${err.message}`);
    return;
  }

  // Fast keystrokes would otherwise serialize a screenshot per character;
  // skip mid-burst frames but always emit the one that drains the queue so
  // the final state is never missed.
  const isBurstAction = action.type === "type" || action.type === "key" || action.type === "scroll";
  const isLastQueued = session.pending <= 1;
  const shouldShoot = !isBurstAction || isLastQueued || Date.now() - session.lastShotAt > BURST_SCREENSHOT_THROTTLE_MS;
  if (shouldShoot) {
    session.lastShotAt = Date.now();
    // Deliberately not awaited: the click/tap/keystroke itself already
    // landed on the real page above, so the next queued input shouldn't
    // have to sit and wait for this screenshot's JPEG encode + socket emit
    // to finish too — that's what made rapid clicking feel laggy or
    // "stuck", since every click was queued behind the previous click's
    // full screenshot round trip. The frame still arrives moments later.
    screenshotAndEmit(socket, session);
  }
}

function handleInput(socket, action) {
  const session = sessions.get(socket.id);
  if (!session) return;

  session.pending += 1;
  session.queue = session.queue
    .then(() => runAction(socket, session, action))
    .finally(() => {
      session.pending -= 1;
    });
}

async function inspectDom(socket) {
  const session = sessions.get(socket.id);
  if (!session) return;
  try {
    const html = await session.page.content();
    socket.emit("device-lab:dom", { html });
  } catch (err) {
    logger.warn("device-lab", `DOM inspect failed: ${err.message}`);
  }
}

// Chrome's "inspect element" picker: click a spot on the live page and get
// back the real element under that point — its box model and computed
// style, the same numbers a real DevTools Styles/box-model pane shows —
// straight from the actual rendered page, not a static HTML dump.
async function inspectAt(socket, { x, y }) {
  const session = sessions.get(socket.id);
  if (!session) return;
  try {
    const result = await session.page.evaluate(
      ([px, py]) => {
        const el = document.elementFromPoint(px, py);
        if (!el) return null;
        const rect = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        const side = (prop) => ({
          top: cs.getPropertyValue(`${prop}-top`),
          right: cs.getPropertyValue(`${prop}-right`),
          bottom: cs.getPropertyValue(`${prop}-bottom`),
          left: cs.getPropertyValue(`${prop}-left`),
        });
        // Walk up to <body> for the breadcrumb trail real DevTools shows
        // along the bottom of the Elements panel.
        const ancestors = [];
        for (let node = el.parentElement; node && node !== document.documentElement; node = node.parentElement) {
          ancestors.unshift({
            tag: node.tagName.toLowerCase(),
            id: node.id || null,
            classes: typeof node.className === "string" ? node.className.split(/\s+/).filter(Boolean) : [],
          });
        }

        // Real matched CSS rules (cascade order), not a synthetic summary —
        // the same rule blocks the Styles pane in actual DevTools shows,
        // pulled straight from the page's own stylesheets.
        const matchedRules = [];
        for (const sheet of Array.from(document.styleSheets)) {
          let rules;
          try {
            rules = sheet.cssRules;
          } catch {
            continue; // cross-origin stylesheet — can't be read, same as real DevTools
          }
          if (!rules) continue;
          for (const rule of Array.from(rules)) {
            if (rule.type !== 1) continue; // CSSStyleRule only
            let matches = false;
            try {
              matches = el.matches(rule.selectorText);
            } catch {
              continue;
            }
            if (!matches) continue;
            const declarations = [];
            for (let i = 0; i < rule.style.length; i++) {
              const prop = rule.style[i];
              declarations.push({ prop, value: rule.style.getPropertyValue(prop) });
            }
            if (declarations.length === 0) continue;
            matchedRules.push({
              selector: rule.selectorText,
              declarations,
              source: sheet.href ? sheet.href.split("/").pop() : "inline style",
            });
          }
        }
        matchedRules.reverse(); // later/more-specific rules first, like DevTools' cascade order

        return {
          tag: el.tagName.toLowerCase(),
          id: el.id || null,
          classes: typeof el.className === "string" ? el.className.split(/\s+/).filter(Boolean) : [],
          rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
          ancestors,
          matchedRules,
          margin: side("margin"),
          padding: side("padding"),
          border: {
            top: cs.borderTopWidth,
            right: cs.borderRightWidth,
            bottom: cs.borderBottomWidth,
            left: cs.borderLeftWidth,
          },
          style: {
            display: cs.display,
            position: cs.position,
            color: cs.color,
            backgroundColor: cs.backgroundColor,
            fontFamily: cs.fontFamily,
            fontSize: cs.fontSize,
            fontWeight: cs.fontWeight,
            lineHeight: cs.lineHeight,
            textAlign: cs.textAlign,
            zIndex: cs.zIndex,
          },
          outerHTMLPreview: el.outerHTML.slice(0, 400),
        };
      },
      [x, y]
    );
    socket.emit("device-lab:inspect", result);
  } catch (err) {
    logger.warn("device-lab", `inspect-at failed: ${err.message}`);
  }
}

// ---- DevTools: Application (real localStorage/sessionStorage/cookies) ----
async function inspectStorage(socket) {
  const session = sessions.get(socket.id);
  if (!session) return;
  try {
    const { page, context } = session;
    const [storage, cookies] = await Promise.all([
      page.evaluate(() => ({
        localStorage: Object.entries(localStorage),
        sessionStorage: Object.entries(sessionStorage),
      })),
      context.cookies(),
    ]);
    socket.emit("device-lab:storage", { ...storage, cookies });
  } catch (err) {
    logger.warn("device-lab", `inspect-storage failed: ${err.message}`);
  }
}

// ---- DevTools: Performance (real Navigation/Paint/Resource Timing) ----
async function inspectPerformance(socket) {
  const session = sessions.get(socket.id);
  if (!session) return;
  try {
    const metrics = await session.page.evaluate(() => {
      const nav = performance.getEntriesByType("navigation")[0];
      const paints = performance.getEntriesByType("paint");
      const resources = performance.getEntriesByType("resource");
      const byType = {};
      let totalBytes = 0;
      for (const r of resources) {
        byType[r.initiatorType] = (byType[r.initiatorType] || 0) + 1;
        totalBytes += r.transferSize || 0;
      }
      const paintTime = (name) => {
        const entry = paints.find((p) => p.name === name);
        return entry ? Math.round(entry.startTime) : null;
      };
      return {
        domContentLoaded: nav ? Math.round(nav.domContentLoadedEventEnd) : null,
        loadEvent: nav ? Math.round(nav.loadEventEnd) : null,
        ttfb: nav ? Math.round(nav.responseStart) : null,
        firstPaint: paintTime("first-paint"),
        firstContentfulPaint: paintTime("first-contentful-paint"),
        resourceCount: resources.length,
        totalTransferBytes: Math.round(totalBytes),
        byType,
      };
    });
    socket.emit("device-lab:performance", metrics);
  } catch (err) {
    logger.warn("device-lab", `inspect-performance failed: ${err.message}`);
  }
}

// ---- DevTools: Memory (real JS heap usage — Chromium only, like real DevTools' reliance on the same non-standard API) ----
async function inspectMemory(socket) {
  const session = sessions.get(socket.id);
  if (!session) return;
  try {
    const mem = await session.page.evaluate(() => {
      const m = performance.memory;
      return m ? { usedJSHeapSize: m.usedJSHeapSize, totalJSHeapSize: m.totalJSHeapSize, jsHeapSizeLimit: m.jsHeapSizeLimit } : null;
    });
    socket.emit("device-lab:memory", { available: !!mem, ...mem });
  } catch (err) {
    logger.warn("device-lab", `inspect-memory failed: ${err.message}`);
  }
}

// ---- DevTools: Sources (view the actual text of a loaded document/script/stylesheet) ----
async function fetchSource(socket, { url }) {
  const session = sessions.get(socket.id);
  if (!session || !url) return;
  try {
    // A raw request through the browser context (not page.evaluate + fetch)
    // sidesteps CORS entirely — it's the same trick Playwright itself uses
    // for request interception, and it still carries the session's cookies.
    const res = await session.context.request.get(url, { timeout: 10000 });
    const text = await res.text();
    socket.emit("device-lab:source", {
      url,
      status: res.status(),
      contentType: res.headers()["content-type"] || "",
      text: text.slice(0, 200000),
    });
  } catch (err) {
    socket.emit("device-lab:source", { url, status: 0, contentType: "", text: `Failed to load: ${err.message}` });
  }
}

async function stopSession(socket) {
  const session = sessions.get(socket.id);
  if (!session) return;
  sessions.delete(socket.id);
  if (session.idleTimer) clearInterval(session.idleTimer);
  try {
    await session.browser.close();
  } catch {
    // already gone
  }
}

module.exports = {
  startSession,
  handleInput,
  stopSession,
  inspectDom,
  inspectAt,
  inspectStorage,
  inspectPerformance,
  inspectMemory,
  fetchSource,
};
