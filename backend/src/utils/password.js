const crypto = require("crypto");

/**
 * Password hashing with Node's built-in crypto (scrypt) — no external
 * dependency needed. Stores "salt:hash". scrypt is a slow, memory-hard KDF,
 * which is what you want for passwords.
 */
function hash(plain) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(String(plain), salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

function verify(plain, stored) {
  if (!stored || typeof stored !== "string" || !stored.includes(":"))
    return false;
  const [salt, key] = stored.split(":");
  const derived = crypto.scryptSync(String(plain), salt, 64).toString("hex");
  const a = Buffer.from(key, "hex");
  const b = Buffer.from(derived, "hex");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b); // constant-time compare
}

module.exports = { hash, verify };
