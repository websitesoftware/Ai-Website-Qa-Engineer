const express = require("express");
const router = express.Router();

const deviceLabController = require("../controllers/deviceLab.controller");

router.get("/devices", deviceLabController.getDevices);
router.post("/render", deviceLabController.render);

module.exports = router;
