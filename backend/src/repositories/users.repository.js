const { v4: uuidv4 } = require("uuid");
const JsonStore = require("../utils/jsonStore");

// Persists to backend/data/users.json (same pattern as the rest of the app).
const store = new JsonStore("users.json");

const normEmail = (email) => String(email || "").toLowerCase().trim();

// Never expose password hash or reset fields to the client.
function sanitize(user) {
  if (!user) return null;
  // eslint-disable-next-line no-unused-vars
  const { password, resetTokenHash, resetTokenExpire, ...safe } = user;
  return safe;
}

module.exports = {
  findByEmail(email) {
    const e = normEmail(email);
    return store.getAll().find((u) => u.email === e) || null;
  },

  getById(id) {
    return store.getById(id);
  },

  list() {
    return store.getAll().map(sanitize);
  },

  findByResetTokenHash(hash) {
    if (!hash) return null;
    return store.getAll().find((u) => u.resetTokenHash === hash) || null;
  },

  async create({ name, email, password }) {
    const user = {
      id: uuidv4(),
      name,
      email: normEmail(email),
      password, // already hashed by the caller
      resetTokenHash: null,
      resetTokenExpire: null,
      role: "viewer", // owner is derived at read time from earliest createdAt
      teamStatus: null, // 'active' once added to the team
      createdAt: new Date().toISOString(),
    };
    await store.insert(user);
    return user;
  },

  update(id, patch) {
    return store.update(id, patch);
  },

  setRole(id, role) {
    return store.update(id, { role });
  },

  setTeamStatus(id, teamStatus) {
    return store.update(id, { teamStatus });
  },

  sanitize,
};
