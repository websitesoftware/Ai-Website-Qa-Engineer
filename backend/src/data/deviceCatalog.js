const { devices } = require("playwright");

// Curated subset of Playwright's built-in device descriptors (real UA,
// viewport, DPR and touch flags per device — no hand-maintained specs).
// Grouped the way a device picker UI wants to render them.
const CATALOG = [
  { category: "Phones", os: "iOS", ids: [
    "iPhone 17 Pro Max", "iPhone 17 Pro", "iPhone 17", "iPhone Air",
    "iPhone 16 Pro Max", "iPhone 16", "iPhone 15 Pro Max", "iPhone 15",
    "iPhone 14", "iPhone SE (3rd gen)", "iPhone SE",
  ] },
  { category: "Phones", os: "Android", ids: [
    "Pixel 10 Pro XL", "Pixel 9 Pro", "Pixel 8", "Pixel 7", "Pixel 6",
    "Galaxy S24", "Galaxy A55", "Galaxy Z Fold 7", "Galaxy Z Flip 7",
  ] },
  { category: "Tablets", os: "iOS", ids: [
    "iPad Pro 11", "iPad (gen 11)", "iPad Mini",
  ] },
  { category: "Tablets", os: "Android", ids: [
    "Galaxy Tab S9", "Galaxy Tab S4",
  ] },
  { category: "Desktop", os: "Various", ids: [
    "Desktop Chrome", "Desktop Safari", "Desktop Firefox", "Desktop Edge", "Desktop Chrome HiDPI",
  ] },
];

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
      });
    }
  }
  return list;
}

const DEVICE_LIST = buildDeviceList();
const DEVICE_BY_ID = new Map(DEVICE_LIST.map((d) => [d.id, d]));

function getDeviceDescriptor(id) {
  const meta = DEVICE_BY_ID.get(id);
  if (!meta) return null;
  return { meta, descriptor: devices[meta.deviceKey] };
}

module.exports = { DEVICE_LIST, getDeviceDescriptor };
