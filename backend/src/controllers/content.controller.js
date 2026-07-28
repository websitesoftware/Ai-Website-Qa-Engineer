const fs = require("fs");
const path = require("path");
const config = require("../config/config");
const contentRepo = require("../repositories/content.repository");
const usersRepo = require("../repositories/users.repository");

const CONTENT_IMAGES_DIR = path.join(__dirname, "..", "..", config.storage.contentImagesDir);

// Same "owner or admin" check used for branding — the earliest-created
// account is the implicit workspace owner, everyone else needs role: "admin".
function isOwnerOrAdmin(user) {
  if (!user) return false;
  const all = usersRepo.list();
  const ownerUserId = all.length
    ? [...all].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))[0].id
    : null;
  return user.id === ownerUserId || user.role === "admin";
}

function list(req, res) {
  res.json({ blocks: contentRepo.getAll() });
}

function update(req, res) {
  const requester = usersRepo.getById(req.user.sub);
  if (!isOwnerOrAdmin(requester)) {
    return res.status(403).json({ error: "Only the owner or an admin can edit site content." });
  }

  const { key } = req.params;
  const { text, icon } = req.body || {};
  const patch = {};
  if (typeof text === "string") patch.text = text;
  if (typeof icon === "string") patch.icon = icon;

  const updated = contentRepo.update(key, patch);
  res.json(updated);
}

function uploadImage(req, res) {
  const requester = usersRepo.getById(req.user.sub);
  if (!isOwnerOrAdmin(requester)) {
    return res.status(403).json({ error: "Only the owner or an admin can edit site content." });
  }

  const { key } = req.params;
  const { imageBase64 } = req.body || {};
  const match = /^data:image\/(png|jpeg|jpg|svg\+xml|webp);base64,(.+)$/.exec(imageBase64 || "");
  if (!match) {
    return res.status(400).json({ error: "imageBase64 must be a data:image/(png|jpeg|svg+xml|webp);base64,... URI" });
  }

  const ext = match[1] === "jpeg" || match[1] === "jpg" ? "jpg" : match[1] === "svg+xml" ? "svg" : match[1];
  fs.mkdirSync(CONTENT_IMAGES_DIR, { recursive: true });
  const fileName = `${key.replace(/[^a-zA-Z0-9._-]/g, "_")}-${Date.now()}.${ext}`;
  fs.writeFileSync(path.join(CONTENT_IMAGES_DIR, fileName), Buffer.from(match[2], "base64"));

  const updated = contentRepo.update(key, { imageUrl: `/content-images/${fileName}` });
  res.json(updated);
}

module.exports = { list, update, uploadImage };
