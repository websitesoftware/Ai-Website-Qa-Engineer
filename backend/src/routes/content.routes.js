const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/content.controller");
const { protect } = require("../middleware/auth");

router.get("/", ctrl.list);
router.put("/:key", protect, ctrl.update);
router.post("/:key/image", protect, ctrl.uploadImage);

module.exports = router;
