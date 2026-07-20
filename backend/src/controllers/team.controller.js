const usersRepo = require("../repositories/users.repository");
const testsRepo = require("../repositories/tests.repository");

// The account with the earliest createdAt is treated as the workspace owner.
// There's no separate teams collection — this app is single-tenant, so
// "the team" is simply every registered user, gated by teamStatus.
function ownerId(allUsers) {
  if (!allUsers.length) return null;
  return [...allUsers].sort(
    (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
  )[0].id;
}

function withComputedRole(user, ownerUserId) {
  return { ...user, role: user.id === ownerUserId ? "owner" : user.role };
}

function isOwnerOrAdmin(user, ownerUserId) {
  return user.id === ownerUserId || user.role === "admin";
}

function activityFor(userId) {
  const tests = testsRepo.list().filter((t) => t.createdBy === userId);
  const lastActive = tests.length ? tests[0].createdAt : null; // list() is newest-first
  return { testCount: tests.length, lastActive };
}

function listMembers(req, res) {
  const all = usersRepo.list();
  const oId = ownerId(all);
  const members = all
    .filter((u) => u.teamStatus === "active" || u.id === oId)
    .map((u) => ({ ...withComputedRole(u, oId), ...activityFor(u.id) }));
  res.json(members);
}

function invite(req, res) {
  const all = usersRepo.list();
  const oId = ownerId(all);
  const requester = all.find((u) => u.id === req.user.sub);
  if (!requester || !isOwnerOrAdmin(requester, oId)) {
    return res.status(403).json({ error: "Only the owner or an admin can add team members." });
  }

  const { email, role } = req.body || {};
  if (!email) return res.status(400).json({ error: "email is required" });

  const target = usersRepo.findByEmail(email);
  if (!target) {
    return res.status(404).json({
      error: "No account exists for that email yet — ask them to register first.",
    });
  }

  const assignedRole = ["admin", "editor", "viewer"].includes(role) ? role : "viewer";
  usersRepo.setTeamStatus(target.id, "active");
  usersRepo.setRole(target.id, assignedRole);

  const updated = usersRepo.getById(target.id);
  res.status(201).json({ ...withComputedRole(usersRepo.sanitize(updated), oId), ...activityFor(updated.id) });
}

function updateRole(req, res) {
  const all = usersRepo.list();
  const oId = ownerId(all);
  const requester = all.find((u) => u.id === req.user.sub);
  if (!requester || !isOwnerOrAdmin(requester, oId)) {
    return res.status(403).json({ error: "Only the owner or an admin can change roles." });
  }
  if (req.params.id === oId) {
    return res.status(400).json({ error: "The workspace owner's role can't be changed." });
  }

  const { role } = req.body || {};
  if (!["admin", "editor", "viewer"].includes(role)) {
    return res.status(400).json({ error: "role must be admin, editor, or viewer" });
  }

  const target = usersRepo.getById(req.params.id);
  if (!target) return res.status(404).json({ error: "Member not found" });

  usersRepo.setRole(target.id, role);
  const updated = usersRepo.getById(target.id);
  res.json({ ...withComputedRole(usersRepo.sanitize(updated), oId), ...activityFor(updated.id) });
}

function remove(req, res) {
  const all = usersRepo.list();
  const oId = ownerId(all);
  const requester = all.find((u) => u.id === req.user.sub);
  if (!requester || !isOwnerOrAdmin(requester, oId)) {
    return res.status(403).json({ error: "Only the owner or an admin can remove team members." });
  }
  if (req.params.id === oId) {
    return res.status(400).json({ error: "The workspace owner can't be removed." });
  }

  const target = usersRepo.getById(req.params.id);
  if (!target) return res.status(404).json({ error: "Member not found" });

  usersRepo.setTeamStatus(target.id, null);
  res.status(204).send();
}

module.exports = { listMembers, invite, updateRole, remove };
