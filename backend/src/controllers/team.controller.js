const crypto = require("crypto");
const usersRepo = require("../repositories/users.repository");
const testsRepo = require("../repositories/tests.repository");
const mailer = require("../services/mailer.service");
const config = require("../config/config");
const logger = require("../utils/logger");

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

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
    .filter((u) => u.teamStatus === "active" || u.teamStatus === "invited" || u.id === oId)
    .map((u) => ({ ...withComputedRole(u, oId), ...activityFor(u.id) }));
  res.json(members);
}

async function invite(req, res) {
  const all = usersRepo.list();
  const oId = ownerId(all);
  const requester = all.find((u) => u.id === req.user.sub);
  if (!requester || !isOwnerOrAdmin(requester, oId)) {
    return res.status(403).json({ error: "Only the owner or an admin can add team members." });
  }

  const { email, role } = req.body || {};
  if (!email) return res.status(400).json({ error: "email is required" });
  const assignedRole = ["admin", "editor", "viewer"].includes(role) ? role : "viewer";

  const existing = usersRepo.findByEmail(email);
  if (existing) {
    // Already has an account — add them directly, same as before, and let
    // them know via email (best-effort; never blocks the response).
    usersRepo.setTeamStatus(existing.id, "active");
    usersRepo.setRole(existing.id, assignedRole);
    const updated = usersRepo.getById(existing.id);

    mailer
      .sendTeamAddedNotification(updated.email, updated.name, assignedRole)
      .catch((err) => logger.warn("team", `Could not send team-added notification: ${err.message}`));

    return res.status(201).json({
      ...withComputedRole(usersRepo.sanitize(updated), oId),
      ...activityFor(updated.id),
      emailSent: true,
    });
  }

  // No account yet — create a pending invite and email them a link to set
  // up their account, landing them directly in the workspace with this role.
  const rawToken = crypto.randomBytes(32).toString("hex");
  const inviteTokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  const created = await usersRepo.createInvite({
    email,
    role: assignedRole,
    invitedBy: requester.id,
    inviteTokenHash,
    inviteTokenExpire: Date.now() + INVITE_TTL_MS,
  });

  const inviteLink = `${config.email.frontendUrl}/accept-invite?token=${rawToken}`;
  const sendResult = await mailer.sendInviteEmail(email, inviteLink, requester.name, assignedRole);

  const updated = usersRepo.getById(created.id);
  res.status(201).json({
    ...withComputedRole(usersRepo.sanitize(updated), oId),
    ...activityFor(updated.id),
    emailSent: sendResult.ok,
    // Dev-only convenience so the invite is still usable without Resend
    // configured — mirrors forgotPassword's devResetToken.
    ...(config.env !== "production" && !sendResult.ok ? { devInviteLink: inviteLink } : {}),
  });
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

async function remove(req, res) {
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

  if (target.teamStatus === "invited") {
    // A pending invite is just a stub with no password — cancelling it
    // should remove the account entirely, not leave an inert orphan.
    await usersRepo.remove(target.id);
  } else {
    usersRepo.setTeamStatus(target.id, null);
  }
  res.status(204).send();
}

module.exports = { listMembers, invite, updateRole, remove };
