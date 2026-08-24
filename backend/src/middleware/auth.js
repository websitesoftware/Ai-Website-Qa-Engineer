const token = require("../utils/token");

/**
 * Route guard. Reads `Authorization: Bearer <token>`, verifies it, and attaches
 * the decoded payload to req.user. Use it on any route you want to lock:
 *
 *   const { protect } = require("../middleware/auth");
 *   router.get("/tests", protect, testsController.list);
 */
function protect(req, res, next) {
  const header = req.headers.authorization || "";
  const t = header.startsWith("Bearer ") ? header.slice(7) : null;
  const payload = t ? token.verify(t) : null;
  if (!payload)
    return res.status(401).json({ message: "Not authorized. Please sign in." });
  req.user = payload;
  next();
}

/**
 * Same token decode as `protect`, but never rejects — attaches req.user
 * when a valid token is present, otherwise just calls next(). Used on
 * routes that must work for anonymous callers (e.g. posting a ticket
 * comment without being logged in) but still want to attribute the action
 * to a real account when one is available.
 */
function optionalAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const t = header.startsWith("Bearer ") ? header.slice(7) : null;
  const payload = t ? token.verify(t) : null;
  if (payload) req.user = payload;
  next();
}

module.exports = { protect, optionalAuth };
