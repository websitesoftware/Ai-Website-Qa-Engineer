const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/policies.controller");
const { protect } = require("../middleware/auth");

router.use(protect);

router.get("/", ctrl.list);
router.post("/", ctrl.create);
router.patch("/:id", ctrl.update);
router.delete("/:id", ctrl.remove);
router.post("/:id/activate", ctrl.setActive);

module.exports = router;
