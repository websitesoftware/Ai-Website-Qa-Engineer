const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/tests.controller");

router.post("/", ctrl.create);
router.get("/", ctrl.list);
router.get("/:id", ctrl.getOne);
router.delete("/:id", ctrl.remove);
router.post("/:id/rerun", ctrl.rerun);

router.get("/:id/issues", ctrl.getIssues);
router.patch("/:id/issues/:issueId", ctrl.updateIssue);

module.exports = router;
