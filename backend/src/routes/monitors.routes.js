const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/monitors.controller");
const { protect } = require("../middleware/auth");

router.use(protect);

router.get("/", ctrl.list);
router.post("/", ctrl.create);
router.patch("/:id", ctrl.update);
router.delete("/:id", ctrl.remove);
router.post("/:id/run-now", ctrl.runNow);
router.get("/:id/history", ctrl.history);

module.exports = router;
