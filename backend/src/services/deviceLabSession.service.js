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
    const buffer = await page.screenshot({ timeout: 8000 });
    socket.emit("device-lab:frame", {
      image: `data:image/png;base64,${buffer.toString("base64")}`,
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
  await stopSession(socket);

  const found = getDeviceDescriptor(deviceId);
  if (!found) throw new Error(`Unknown device: ${deviceId}`);
  const { meta, descriptor } = found;

  let viewport = descriptor.viewport;
  if (orientation === "landscape" && meta.isMobile) {
    viewport = { width: viewport.height, height: viewport.width };
  }

  const engineName = browserEngine || meta.defaultBrowserType;
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
    await screenshotAndEmit(socket, session);
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

module.exports = { startSession, handleInput, stopSession, inspectDom };
