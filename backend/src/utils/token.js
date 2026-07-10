const crypto = require("crypto");

/**
 * Minimal signed-token implementation (JWT-style) using built-in crypto —
 * no `jsonwebtoken` dependency required. Token format: base64url(payload).signature
 * where signature = HMAC-SHA256(payload, secret). Includes iat/exp.
 *
 * Set JWT_SECRET in .env for production. A dev fallback is used otherwise so
 * the app still runs, but it is NOT safe for real deployments.
 */
const SECRET = process.env.JWT_SECRET || "dev-insecure-secret-change-me";
if (!process.env.JWT_SECRET) {
  // eslint-disable-next-line no-console
  console.warn(
    "[auth] JWT_SECRET is not set — using an insecure dev secret. Add JWT_SECRET to backend/.env before deploying.",
  );
}

const DEFAULT_EXPIRY_SEC = 60 * 60 * 24 * 7; // 7 days

function sign(payloadObj, expiresInSec = DEFAULT_EXPIRY_SEC) {
  const now = Math.floor(Date.now() / 1000);
  const payload = { ...payloadObj, iat: now, exp: now + expiresInSec };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto
    .createHmac("sha256", SECRET)
    .update(body)
    .digest("base64url");
  return `${body}.${sig}`;
}

function verify(token) {
  if (!token || typeof token !== "string" || !token.includes(".")) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;

  const expected = crypto
    .createHmac("sha256", SECRET)
    .update(body)
    .digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  let payload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf-8"));
  } catch {
    return null;
  }
  if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) return null;
  return payload;
}

module.exports = { sign, verify };
