const JsonStore = require("../utils/jsonStore");

const store = new JsonStore("monitors.json");

module.exports = {
  list() {
    return store.getAll().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  get(id) {
    return store.getById(id);
  },

  create(monitor) {
    return store.insert(monitor);
  },

  update(id, patch) {
    return store.update(id, patch);
  },

  remove(id) {
    return store.remove(id);
  },
};
