const fs = require("fs");
const path = require("path");
const { DEFAULTS, createContentBlock } = require("../models/content.model");

// Single JSON object keyed by content key (not the array-based JsonStore) —
// same shape as branding.repository.js, just one record per editable block
// instead of one record total.
const filePath = path.join(__dirname, "..", "..", "data", "content.json");

function ensureFile() {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify({}, null, 2));
  }
}

function readOverrides() {
  ensureFile();
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return {};
  }
}

function writeOverrides(overrides) {
  ensureFile();
  fs.writeFileSync(filePath, JSON.stringify(overrides, null, 2));
}

module.exports = {
  // Every default block, merged with whatever's actually been saved —
  // nothing is ever missing/blank even before an admin edits anything.
  getAll() {
    const overrides = readOverrides();
    const keys = new Set([...Object.keys(DEFAULTS), ...Object.keys(overrides)]);
    return Array.from(keys).map((key) => createContentBlock(key, overrides[key]));
  },

  update(key, patch) {
    const overrides = readOverrides();
    const current = createContentBlock(key, overrides[key]);
    const next = { ...current, ...patch, updatedAt: new Date().toISOString() };
    delete next.key;
    overrides[key] = next;
    writeOverrides(overrides);
    return { key, ...next };
  },
};
