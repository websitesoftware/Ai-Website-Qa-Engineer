const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/team.controller");
const { protect } = require("../middleware/auth");

router.use(protect);

router.get("/members", ctrl.listMembers);
router.post("/invite", ctrl.invite);
router.patch("/members/:id", ctrl.updateRole);
router.delete("/members/:id", ctrl.remove);

module.exports = router;
