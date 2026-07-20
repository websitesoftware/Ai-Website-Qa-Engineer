const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/branding.controller");
const { protect } = require("../middleware/auth");

router.get("/", ctrl.get);
router.put("/", protect, ctrl.update);

module.exports = router;
