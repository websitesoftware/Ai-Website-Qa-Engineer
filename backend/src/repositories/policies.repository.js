const JsonStore = require("../utils/jsonStore");

const store = new JsonStore("policies.json");

module.exports = {
  list() {
    return store.getAll().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  get(id) {
    return store.getById(id);
  },

  getActive() {
    return store.getAll().find((p) => p.active) || null;
  },

  create(policy) {
    return store.insert(policy);
  },

  update(id, patch) {
    return store.update(id, { ...patch, updatedAt: new Date().toISOString() });
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
    return store.update(id, { active: true });
  },
};
