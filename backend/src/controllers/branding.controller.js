const fs = require("fs");
const path = require("path");
const config = require("../config/config");
const brandingRepo = require("../repositories/branding.repository");
const usersRepo = require("../repositories/users.repository");

const BRANDING_DIR = path.join(__dirname, "..", "..", config.storage.brandingDir);

function isOwnerOrAdmin(user) {
  if (!user) return false;
  const all = usersRepo.list();
  const ownerUserId = all.length
    ? [...all].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))[0].id
    : null;
  return user.id === ownerUserId || user.role === "admin";
}

function get(req, res) {
  res.json(brandingRepo.get());
}

function update(req, res) {
  const requester = usersRepo.getById(req.user.sub);
  if (!isOwnerOrAdmin(requester)) {
    return res.status(403).json({ error: "Only the owner or an admin can update branding." });
  }

  const {
    primaryColor,
    footerText,
    headerText,
    headerFontSize,
    footerFontSize,
    logoWidth,
    logoHeight,
    logoBase64,
  } = req.body || {};
  const patch = {};
  if (primaryColor) patch.primaryColor = primaryColor;
  if (typeof footerText === "string") patch.footerText = footerText;
  if (typeof headerText === "string") patch.headerText = headerText;
  if (Number.isFinite(headerFontSize) && headerFontSize > 0) patch.headerFontSize = headerFontSize;
  if (Number.isFinite(footerFontSize) && footerFontSize > 0) patch.footerFontSize = footerFontSize;
  if (Number.isFinite(logoWidth) && logoWidth > 0) patch.logoWidth = logoWidth;
  if (Number.isFinite(logoHeight) && logoHeight > 0) patch.logoHeight = logoHeight;

  if (logoBase64) {
    const match = /^data:image\/(png|jpeg|jpg|svg\+xml);base64,(.+)$/.exec(logoBase64);
    if (!match) {
      return res.status(400).json({ error: "logoBase64 must be a data:image/(png|jpeg|svg+xml);base64,... URI" });
    }
    const ext = match[1] === "jpeg" || match[1] === "jpg" ? "jpg" : match[1] === "svg+xml" ? "svg" : "png";
    fs.mkdirSync(BRANDING_DIR, { recursive: true });
    const fileName = `logo.${ext}`;
    fs.writeFileSync(path.join(BRANDING_DIR, fileName), Buffer.from(match[2], "base64"));
    patch.logoUrl = `/branding/${fileName}`;
  }

  const updated = brandingRepo.update(patch);
  res.json(updated);
}

module.exports = { get, update };
