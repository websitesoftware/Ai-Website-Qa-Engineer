const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/analytics.controller");
const { protect } = require("../middleware/auth");

router.get("/", protect, ctrl.get);

module.exports = router;
