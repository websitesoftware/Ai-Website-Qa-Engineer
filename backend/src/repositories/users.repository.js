const { v4: uuidv4 } = require("uuid");
const JsonStore = require("../utils/jsonStore");

// Persists to backend/data/users.json (same pattern as the rest of the app).
const store = new JsonStore("users.json");

const normEmail = (email) => String(email || "").toLowerCase().trim();

// Never expose password hash or reset/invite token fields to the client.
function sanitize(user) {
  if (!user) return null;
  // eslint-disable-next-line no-unused-vars
  const { password, resetTokenHash, resetTokenExpire, inviteTokenHash, inviteTokenExpire, ...safe } = user;
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

  findByInviteTokenHash(hash) {
    if (!hash) return null;
    return store.getAll().find((u) => u.inviteTokenHash === hash) || null;
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

  // A pending team invite: a stub account with no password yet — the
  // invitee sets one (and their name) via POST /api/auth/accept-invite,
  // which flips teamStatus to "active".
  async createInvite({ email, role, invitedBy, inviteTokenHash, inviteTokenExpire }) {
    const user = {
      id: uuidv4(),
      name: null,
      email: normEmail(email),
      password: null,
      resetTokenHash: null,
      resetTokenExpire: null,
      role,
      teamStatus: "invited",
      inviteTokenHash,
      inviteTokenExpire,
      invitedBy: invitedBy || null,
      createdAt: new Date().toISOString(),
    };
    await store.insert(user);
    return user;
  },

  update(id, patch) {
    return store.update(id, patch);
  },

  remove(id) {
    return store.remove(id);
  },

  setRole(id, role) {
    return store.update(id, { role });
  },

  setTeamStatus(id, teamStatus) {
    return store.update(id, { teamStatus });
  },

  sanitize,
};
