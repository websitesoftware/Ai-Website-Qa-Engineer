const JsonStore = require("../utils/jsonStore");

const store = new JsonStore("tests.json");

module.exports = {
  list(filters = {}) {
    let items = store.getAll();

    if (filters.status) {
      items = items.filter((t) => t.status === filters.status);
    }
    if (filters.search) {
      const q = filters.search.toLowerCase();
      items = items.filter(
        (t) => t.url.toLowerCase().includes(q) || t.name.toLowerCase().includes(q)
      );
    }
    // newest first
    items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return items;
  },

  get(id) {
    return store.getById(id);
  },

  create(test) {
    return store.insert(test);
  },

  update(id, patch) {
    return store.update(id, patch);
  },

  remove(id) {
    return store.remove(id);
  },
};
