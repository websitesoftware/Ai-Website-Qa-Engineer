 const { devices } = require("playwright");

// Every Playwright built-in device descriptor worth surfacing (real UA,
// viewport, DPR and touch flags per device — no hand-maintained specs),
// grouped the way a device picker UI wants to render them. This is the full
// set Playwright ships for these brands, not a curated slice — anything
// listed here is a verified, real device spec.
const CATALOG = [
  { category: "Phones", os: "iOS", ids: [
    "iPhone 17 Pro Max", "iPhone 17 Pro", "iPhone 17", "iPhone Air", "iPhone 17e",
    "iPhone 16 Pro Max", "iPhone 16 Pro", "iPhone 16 Plus", "iPhone 16", "iPhone 16e",
    "iPhone 15 Pro Max", "iPhone 15 Pro", "iPhone 15 Plus", "iPhone 15",
    "iPhone 14 Pro Max", "iPhone 14 Pro", "iPhone 14 Plus", "iPhone 14",
    "iPhone 13 Pro Max", "iPhone 13 Pro", "iPhone 13", "iPhone 13 Mini",
    "iPhone 12 Pro Max", "iPhone 12 Pro", "iPhone 12", "iPhone 12 Mini",
    "iPhone 11 Pro Max", "iPhone 11 Pro", "iPhone 11",
    "iPhone XR", "iPhone X", "iPhone SE (3rd gen)", "iPhone SE",
    "iPhone 8 Plus", "iPhone 8", "iPhone 7 Plus", "iPhone 7", "iPhone 6 Plus", "iPhone 6",
  ] },
  { category: "Phones", os: "Android", ids: [
    "Pixel 10 Pro XL", "Pixel 10 Pro", "Pixel 10",
    "Pixel 9 Pro XL", "Pixel 9 Pro", "Pixel 9",
    "Pixel 8a", "Pixel 8 Pro", "Pixel 8",
    "Pixel 7a", "Pixel 7 Pro", "Pixel 7",
    "Pixel 6a", "Pixel 6 Pro", "Pixel 6",
    "Pixel 5", "Pixel 4a (5G)", "Pixel 4", "Pixel 3", "Pixel 2 XL", "Pixel 2",
    "Nexus 6P", "Nexus 6", "Nexus 5X", "Nexus 5", "Nexus 4",
    "Galaxy Z Fold 7", "Galaxy Z Fold 7 Cover", "Galaxy Z Fold 6", "Galaxy Z Fold 6 Cover",
    "Galaxy Z Flip 7", "Galaxy Z Flip 7 Cover", "Galaxy Z Flip 6", "Galaxy Z Flip 6 Cover",
    "Galaxy S24", "Galaxy A55", "Galaxy S9+", "Galaxy S8", "Galaxy S5",
    "Galaxy Note 3", "Galaxy Note II", "Galaxy S III",
    "Moto G4",
  ] },
  { category: "Tablets", os: "iOS", ids: [
    "iPad Pro 11", "iPad (gen 11)", "iPad (gen 7)", "iPad (gen 6)", "iPad (gen 5)", "iPad Mini",
  ] },
  { category: "Tablets", os: "Android", ids: [
    "Galaxy Tab S9", "Galaxy Tab S4", "Nexus 10", "Nexus 7",
  ] },
  { category: "Desktop", os: "Various", ids: [
    "Desktop Chrome", "Desktop Safari", "Desktop Firefox", "Desktop Edge", "Desktop Chrome HiDPI",
  ] },
];

// Brands from the requested model list that Playwright ships no descriptor
// for at all (OnePlus, Xiaomi/Redmi, realme, OPPO, vivo, Motorola's modern
// lineup, Huawei) or only partially covers (Samsung's A/M series, older
// Pixels). Rather than inventing one hand-maintained spec per SKU, each
// entry here is one representative preset per brand/category/screen tier —
// real enough to catch responsive-layout bugs, not a claim that it matches
// any single exact model.
function androidUA(model, { tablet = false } = {}) {
  const tail = tablet ? "Chrome/124.0.0.0 Safari/537.36" : "Chrome/124.0.0.0 Mobile Safari/537.36";
  return `Mozilla/5.0 (Linux; Android 14; ${model}) AppleWebKit/537.36 (KHTML, like Gecko) ${tail}`;
}

const CUSTOM_DEVICES = [
  // Samsung — S-series already covered by Galaxy S24; A/M/Tab-A are not.
  { id: "samsung-galaxy-a-series", name: "Samsung Galaxy A Series", category: "Phones", os: "Android",
    width: 412, height: 915, deviceScaleFactor: 2.6, isMobile: true, hasTouch: true,
    userAgent: androidUA("SM-A356B") },
  { id: "samsung-galaxy-m-series", name: "Samsung Galaxy M Series", category: "Phones", os: "Android",
    width: 412, height: 915, deviceScaleFactor: 2.6, isMobile: true, hasTouch: true,
    userAgent: androidUA("SM-M556B") },
  { id: "samsung-galaxy-tab-a-series", name: "Samsung Galaxy Tab A Series", category: "Tablets", os: "Android",
    width: 601, height: 962, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    userAgent: androidUA("SM-X210", { tablet: true }) },

  // Google Pixel — 6-10 series already covered; older phones/Fold/Tablet are not.
  { id: "google-pixel-legacy", name: "Google Pixel (3-5 series)", category: "Phones", os: "Android",
    width: 393, height: 851, deviceScaleFactor: 2.75, isMobile: true, hasTouch: true,
    userAgent: androidUA("Pixel 5") },
  { id: "google-pixel-fold", name: "Google Pixel Fold", category: "Phones", os: "Android",
    width: 403, height: 866, deviceScaleFactor: 2.5, isMobile: true, hasTouch: true,
    userAgent: androidUA("Pixel Fold") },
  { id: "google-pixel-tablet", name: "Google Pixel Tablet", category: "Tablets", os: "Android",
    width: 840, height: 1280, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    userAgent: androidUA("Pixel Tablet", { tablet: true }) },

  // OnePlus
  { id: "oneplus-phone", name: "OnePlus (numbered series)", category: "Phones", os: "Android",
    width: 412, height: 915, deviceScaleFactor: 2.6, isMobile: true, hasTouch: true,
    userAgent: androidUA("CPH2581") },
  { id: "oneplus-nord", name: "OnePlus Nord", category: "Phones", os: "Android",
    width: 393, height: 851, deviceScaleFactor: 2.75, isMobile: true, hasTouch: true,
    userAgent: androidUA("CPH2531") },
  { id: "oneplus-open", name: "OnePlus Open (foldable)", category: "Phones", os: "Android",
    width: 412, height: 900, deviceScaleFactor: 2.6, isMobile: true, hasTouch: true,
    userAgent: androidUA("CPH2551") },
  { id: "oneplus-pad", name: "OnePlus Pad", category: "Tablets", os: "Android",
    width: 800, height: 1280, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    userAgent: androidUA("OPD2203", { tablet: true }) },

  // Xiaomi / Redmi
  { id: "redmi-phone", name: "Redmi Series", category: "Phones", os: "Android",
    width: 393, height: 851, deviceScaleFactor: 2.75, isMobile: true, hasTouch: true,
    userAgent: androidUA("23129RN51Y") },
  { id: "redmi-note", name: "Redmi Note Series", category: "Phones", os: "Android",
    width: 412, height: 915, deviceScaleFactor: 2.6, isMobile: true, hasTouch: true,
    userAgent: androidUA("23129RN51Y") },
  { id: "redmi-pad", name: "Redmi Pad", category: "Tablets", os: "Android",
    width: 800, height: 1280, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    userAgent: androidUA("Redmi Pad", { tablet: true }) },

  // realme
  { id: "realme-phone", name: "realme Series (Number/GT/Narzo/C)", category: "Phones", os: "Android",
    width: 393, height: 851, deviceScaleFactor: 2.75, isMobile: true, hasTouch: true,
    userAgent: androidUA("RMX3630") },
  { id: "realme-pad", name: "realme Pad", category: "Tablets", os: "Android",
    width: 800, height: 1280, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    userAgent: androidUA("RMP2103", { tablet: true }) },

  // OPPO
  { id: "oppo-phone", name: "OPPO Series (Find X/Reno/A/K)", category: "Phones", os: "Android",
    width: 412, height: 915, deviceScaleFactor: 2.6, isMobile: true, hasTouch: true,
    userAgent: androidUA("CPH2551") },
  { id: "oppo-pad", name: "OPPO Pad", category: "Tablets", os: "Android",
    width: 800, height: 1280, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    userAgent: androidUA("OPD2102", { tablet: true }) },

  // vivo
  { id: "vivo-phone", name: "vivo Series (X/V/Y/T)", category: "Phones", os: "Android",
    width: 393, height: 851, deviceScaleFactor: 2.75, isMobile: true, hasTouch: true,
    userAgent: androidUA("V2309A") },
  { id: "iqoo-phone", name: "iQOO Series", category: "Phones", os: "Android",
    width: 412, height: 915, deviceScaleFactor: 2.6, isMobile: true, hasTouch: true,
    userAgent: androidUA("I2301") },

  // Motorola — Moto G4 already covered; Edge/Razr/Tab are not.
  { id: "moto-edge", name: "Moto Edge", category: "Phones", os: "Android",
    width: 412, height: 915, deviceScaleFactor: 2.6, isMobile: true, hasTouch: true,
    userAgent: androidUA("motorola edge 50") },
  { id: "moto-razr", name: "Moto Razr (foldable)", category: "Phones", os: "Android",
    width: 393, height: 851, deviceScaleFactor: 2.75, isMobile: true, hasTouch: true,
    userAgent: androidUA("motorola razr 50") },
  { id: "moto-tab", name: "Moto Tab", category: "Tablets", os: "Android",
    width: 800, height: 1280, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    userAgent: androidUA("moto tab", { tablet: true }) },

  // Huawei
  { id: "huawei-phone", name: "Huawei Series (Pura/Mate/nova/Enjoy)", category: "Phones", os: "Android",
    width: 393, height: 851, deviceScaleFactor: 2.75, isMobile: true, hasTouch: true,
    userAgent: androidUA("ELS-N04") },
  { id: "huawei-matepad", name: "Huawei MatePad", category: "Tablets", os: "Android",
    width: 800, height: 1280, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    userAgent: androidUA("MatePad", { tablet: true }) },
];

// Windows desktop OS/browser combinations, in the spirit of BrowserStack's
// OS+browser picker. Playwright can't actually execute IE11 or a 2012-era
// Safari — every entry here runs on a real current Chromium/Firefox/WebKit
// engine, spoofing only the User-Agent string to identify as that
// OS+browser pairing. Real content rendering is always the modern engine's;
// this is for layout/UA-sniffing checks, not pixel-accurate legacy replay.
// Windows version -> NT token used in every UA on that OS (real values).
// XP only ever shipped 32-bit-era browsers, so it gets no "Win64; x64" token.
const WIN_NT = { "11": "10.0", "10": "10.0", "8.1": "6.3", "8": "6.2", "7": "6.1", XP: "5.1" };

function winArch(winVersion) {
  return winVersion === "XP" ? "" : "; Win64; x64";
}

// Each browser's real UA layout differs too much (paren placement, rv:
// position, MSIE's inverted "compatible" prefix) for one shared template —
// so every family gets its own accurate builder instead.
const WINDOWS_BROWSER_UA = {
  edge: (win) =>
    `Mozilla/5.0 (Windows NT ${WIN_NT[win]}${winArch(win)}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 Edg/140.0.0.0`,
  chrome: (win) =>
    `Mozilla/5.0 (Windows NT ${WIN_NT[win]}${winArch(win)}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36`,
  opera: (win) =>
    `Mozilla/5.0 (Windows NT ${WIN_NT[win]}${winArch(win)}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36 OPR/102.0.0.0`,
  firefox: (win) => `Mozilla/5.0 (Windows NT ${WIN_NT[win]}${winArch(win)}; rv:143.0) Gecko/20100101 Firefox/143.0`,
  ie11: (win) => `Mozilla/5.0 (Windows NT ${WIN_NT[win]}${winArch(win)}; Trident/7.0; rv:11.0) like Gecko`,
  ie10: (win) => `Mozilla/5.0 (compatible; MSIE 10.0; Windows NT ${WIN_NT[win]}${winArch(win)}; Trident/6.0)`,
  ie8: (win) => `Mozilla/4.0 (compatible; MSIE 8.0; Windows NT ${WIN_NT[win]}; Trident/4.0)`,
  safari: (win) => `Mozilla/5.0 (Windows NT ${WIN_NT[win]}) AppleWebKit/534.57.2 (KHTML, like Gecko) Version/5.1.7 Safari/534.57.2`,
};

// Which browsers actually shipped for each Windows version, historically.
const WINDOWS_MATRIX = [
  { win: "11", browsers: ["edge", "chrome", "firefox"] },
  { win: "10", browsers: ["edge", "ie11", "chrome", "firefox"] },
  { win: "8.1", browsers: ["ie11", "chrome", "firefox"] },
  { win: "8", browsers: ["ie10", "chrome", "firefox"] },
  { win: "7", browsers: ["ie11", "ie8", "chrome", "firefox", "safari"] },
  { win: "XP", browsers: ["ie8", "chrome", "firefox", "safari", "opera"] },
];

const WINDOWS_BROWSER_LABEL = {
  edge: "Edge",
  chrome: "Chrome",
  firefox: "Firefox",
  ie11: "IE 11",
  ie10: "IE 10",
  ie8: "IE 8",
  safari: "Safari",
  opera: "Opera",
};

const WINDOWS_BROWSER_ENGINE = {
  edge: "chromium",
  chrome: "chromium",
  ie11: "chromium",
  ie10: "chromium",
  ie8: "chromium",
  opera: "chromium",
  firefox: "firefox",
  safari: "webkit",
};

const WINDOWS_CUSTOM_DEVICES = WINDOWS_MATRIX.flatMap(({ win, browsers }) =>
  browsers.map((browser) => ({
    id: `windows-${win.toLowerCase().replace(/\./g, "-")}-${browser}`,
    name: `Windows ${win} · ${WINDOWS_BROWSER_LABEL[browser]}`,
    category: "Desktop",
    os: "Windows",
    width: 1366,
    height: 768,
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false,
    defaultBrowserType: WINDOWS_BROWSER_ENGINE[browser],
    userAgent: WINDOWS_BROWSER_UA[browser](win),
  }))
);

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function buildDeviceList() {
  const list = [];
  for (const group of CATALOG) {
    for (const id of group.ids) {
      const descriptor = devices[id];
      if (!descriptor) continue; // guards against Playwright renaming/removing a device
      list.push({
        id: slugify(id),
        deviceKey: id,
        name: id,
        category: group.category,
        os: group.os,
        width: descriptor.viewport.width,
        height: descriptor.viewport.height,
        deviceScaleFactor: descriptor.deviceScaleFactor,
        isMobile: descriptor.isMobile,
        hasTouch: descriptor.hasTouch,
        defaultBrowserType: descriptor.defaultBrowserType || "chromium",
        userAgent: descriptor.userAgent,
        descriptor,
      });
    }
  }
  for (const custom of [...CUSTOM_DEVICES, ...WINDOWS_CUSTOM_DEVICES]) {
    const browserType = custom.defaultBrowserType || "chromium";
    const descriptor = {
      viewport: { width: custom.width, height: custom.height },
      deviceScaleFactor: custom.deviceScaleFactor,
      isMobile: custom.isMobile,
      hasTouch: custom.hasTouch,
      userAgent: custom.userAgent,
      defaultBrowserType: browserType,
    };
    list.push({
      id: custom.id,
      deviceKey: null,
      name: custom.name,
      category: custom.category,
      os: custom.os,
      width: custom.width,
      height: custom.height,
      deviceScaleFactor: custom.deviceScaleFactor,
      isMobile: custom.isMobile,
      hasTouch: custom.hasTouch,
      defaultBrowserType: browserType,
      userAgent: custom.userAgent,
      descriptor,
    });
  }
  return list;
}

const DEVICE_LIST = buildDeviceList();
const DEVICE_BY_ID = new Map(DEVICE_LIST.map((d) => [d.id, d]));

function getDeviceDescriptor(id) {
  const meta = DEVICE_BY_ID.get(id);
  if (!meta) return null;
  return { meta, descriptor: meta.descriptor };
}

module.exports = { DEVICE_LIST, getDeviceDescriptor };
