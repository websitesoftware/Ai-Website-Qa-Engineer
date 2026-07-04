const express = require("express");
const router = express.Router();

const testsRoutes = require("./tests.routes");
const statsController = require("../controllers/stats.controller");
const pipelineController = require("../controllers/pipeline.controller");

router.use("/tests", testsRoutes);
router.get("/stats", statsController.getStats);
router.get("/pipeline", pipelineController.getPipeline);

router.get("/health", (req, res) => res.json({ status: "ok", uptime: process.uptime() }));

module.exports = router;
