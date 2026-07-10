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

module.exports = { protect };
