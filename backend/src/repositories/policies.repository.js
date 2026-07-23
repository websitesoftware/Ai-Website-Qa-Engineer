const JsonStore = require("../utils/jsonStore");
const { DEFAULT_SCORE_RANGES } = require("../models/policy.model");

const store = new JsonStore("policies.json");

// Back-fills `scoreRanges` for policy records written before that field
// existed (older ones only had `scoreTiers`, or `thresholds`/`failSeverity`
// before that), so every reader can rely on it always being present.
function normalize(policy) {
  if (!policy) return policy;
  if (policy.scoreRanges) return policy;
  // eslint-disable-next-line no-unused-vars
  const { scoreTiers, ...rest } = policy;
  return { ...rest, scoreRanges: { ...DEFAULT_SCORE_RANGES } };
}

module.exports = {
  list() {
    return store
      .getAll()
      .map(normalize)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  get(id) {
    return normalize(store.getById(id));
  },

  getActive() {
    return normalize(store.getAll().find((p) => p.active) || null);
  },

  create(policy) {
    return store.insert(policy);
  },

  async update(id, patch) {
    return normalize(await store.update(id, { ...patch, updatedAt: new Date().toISOString() }));
  },

  remove(id) {
    return store.remove(id);
  },

  async setActive(id) {
    const all = store.getAll();
    await Promise.all(
      all
        .filter((p) => p.active && p.id !== id)
        .map((p) => store.update(p.id, { active: false }))
    );
    return normalize(await store.update(id, { active: true }));
  },
};
