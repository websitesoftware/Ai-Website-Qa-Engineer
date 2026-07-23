const crypto = require("crypto");
const usersRepo = require("../repositories/users.repository");
const password = require("../utils/password");
const token = require("../utils/token");
const logger = require("../utils/logger");
const config = require("../config/config");

const RESET_TOKEN_TTL_MS = 30 * 60 * 1000; // 30 minutes

function toPublicUser(user) {
  const safe = usersRepo.sanitize(user);
  return { id: safe.id, name: safe.name, email: safe.email };
}

async function registerUser(req, res) {
  const { name, email, password: plain } = req.body || {};
  if (!email || !plain) {
    return res.status(400).json({ message: "Email and password are required." });
  }
  if (plain.length < 8) {
    return res.status(400).json({ message: "Password must be at least 8 characters." });
  }
  if (usersRepo.findByEmail(email)) {
    return res.status(409).json({ message: "An account with this email already exists." });
  }

  const displayName = name || String(email).split("@")[0];
  const user = await usersRepo.create({
    name: displayName,
    email,
    password: password.hash(plain),
  });

  const tok = token.sign({ sub: user.id });
  logger.success("auth", `Registered ${user.email}`);
  res.status(201).json({ token: tok, user: toPublicUser(user) });
}

async function loginUser(req, res) {
  const { email, password: plain } = req.body || {};
  if (!email || !plain) {
    return res.status(400).json({ message: "Email and password are required." });
  }

  const user = usersRepo.findByEmail(email);
  if (!user || !password.verify(plain, user.password)) {
    return res.status(401).json({ message: "Invalid email or password." });
  }

  const tok = token.sign({ sub: user.id });
  res.json({ token: tok, user: toPublicUser(user) });
}

async function forgotPassword(req, res) {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ message: "Email is required." });

  // Same response whether or not the account exists, so this endpoint can't
  // be used to enumerate registered emails.
  const genericMessage = "If an account exists for that email, a password reset link has been generated.";

  const user = usersRepo.findByEmail(email);
  if (!user) return res.json({ message: genericMessage });

  const rawToken = crypto.randomBytes(32).toString("hex");
  const resetTokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  await usersRepo.update(user.id, {
    resetTokenHash,
    resetTokenExpire: Date.now() + RESET_TOKEN_TTL_MS,
  });

  // This project has no email service configured, so there's nowhere real to
  // *send* the link — log it server-side instead of fabricating an email
  // that was never actually delivered.
  logger.info("auth", `Password reset requested for ${user.email}: token=${rawToken}`);

  res.json({
    message: genericMessage,
    // Dev-only convenience so reset can actually be tested without an inbox.
    ...(config.env !== "production" ? { devResetToken: rawToken } : {}),
  });
}

async function resetPassword(req, res) {
  const { token: rawToken, password: plain } = req.body || {};
  if (!rawToken || !plain) {
    return res.status(400).json({ message: "Reset token and new password are required." });
  }
  if (plain.length < 8) {
    return res.status(400).json({ message: "Password must be at least 8 characters." });
  }

  const hash = crypto.createHash("sha256").update(rawToken).digest("hex");
  const user = usersRepo.findByResetTokenHash(hash);
  if (!user || !user.resetTokenExpire || Date.now() > user.resetTokenExpire) {
    return res.status(400).json({ message: "This reset link is invalid or has expired." });
  }

  await usersRepo.update(user.id, {
    password: password.hash(plain),
    resetTokenHash: null,
    resetTokenExpire: null,
  });
  logger.success("auth", `Password reset for ${user.email}`);
  res.json({ message: "Password updated. You can now sign in." });
}

function me(req, res) {
  const user = usersRepo.getById(req.user.sub);
  if (!user) return res.status(404).json({ message: "User not found." });
  res.json({ user: toPublicUser(user) });
}

// Completes a pending team invite (see team.controller.js#invite): the
// invitee sets their name + password, which activates the stub account
// created at invite time and signs them straight in.
async function acceptInvite(req, res) {
  const { token: rawToken, name, password: plain } = req.body || {};
  if (!rawToken || !name || !plain) {
    return res.status(400).json({ message: "Invite token, name, and password are required." });
  }
  if (plain.length < 8) {
    return res.status(400).json({ message: "Password must be at least 8 characters." });
  }

  const hash = crypto.createHash("sha256").update(rawToken).digest("hex");
  const user = usersRepo.findByInviteTokenHash(hash);
  if (!user || !user.inviteTokenExpire || Date.now() > user.inviteTokenExpire) {
    return res.status(400).json({ message: "This invite link is invalid or has expired." });
  }

  await usersRepo.update(user.id, {
    name,
    password: password.hash(plain),
    teamStatus: "active",
    inviteTokenHash: null,
    inviteTokenExpire: null,
  });

  const updated = usersRepo.getById(user.id);
  const tok = token.sign({ sub: updated.id });
  logger.success("auth", `Invite accepted for ${updated.email}`);
  res.status(201).json({ token: tok, user: toPublicUser(updated) });
}

module.exports = { registerUser, loginUser, forgotPassword, resetPassword, me, acceptInvite };
