const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/tests.controller");
const { protect } = require("../middleware/auth");

router.post("/", protect, ctrl.create);
router.get("/", ctrl.list);
router.get("/:id", ctrl.getOne);
router.delete("/:id", protect, ctrl.remove);
router.post("/:id/rerun", protect, ctrl.rerun);

router.get("/:id/issues", ctrl.getIssues);
router.patch("/:id/issues/:issueId", protect, ctrl.updateIssue);
router.post("/:id/issues/:issueId/comments", protect, ctrl.addIssueComment);

module.exports = router;
