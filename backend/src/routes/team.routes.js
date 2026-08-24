const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/team.controller");
const { protect } = require("../middleware/auth");

// Read-only, and needed by the ticket page's "assign by email" box even
// when nobody is logged in in that tab — kept ahead of the auth gate below,
// mirroring GET /tests being public. Mutating routes stay protected.
router.get("/members", ctrl.listMembers);

router.use(protect);

router.post("/invite", ctrl.invite);
router.patch("/members/:id", ctrl.updateRole);
router.delete("/members/:id", ctrl.remove);

module.exports = router;
