// const express = require("express");
// const router = express.Router();

// const testsRoutes = require("./tests.routes");
// const statsController = require("../controllers/stats.controller");
// const pipelineController = require("../controllers/pipeline.controller");

// router.use("/tests", testsRoutes);
// router.get("/stats", statsController.getStats);
// router.get("/pipeline", pipelineController.getPipeline);

// router.get("/health", (req, res) => res.json({ status: "ok", uptime: process.uptime() }));

// module.exports = router;
const express = require("express");
const router = express.Router();

const testsRoutes = require("./tests.routes");
const authRoutes = require("./authRoutes");
const statsController = require("../controllers/stats.controller");
const pipelineController = require("../controllers/pipeline.controller");
const aiAutomationController = require("../controllers/aiAutomation.controller");

router.use("/auth", authRoutes);
router.use("/tests", testsRoutes);
router.get("/stats", statsController.getStats);
router.get("/pipeline", pipelineController.getPipeline);

// ---- Phase 3: AI Automation ----
router.get("/ai-automation/status", aiAutomationController.getStatus);
router.post("/ai-automation/run", aiAutomationController.run);
router.post("/ai-automation/pr", aiAutomationController.createPr);
router.post("/ai-automation/cicd", aiAutomationController.cicd);
router.post("/ai-automation/merge", aiAutomationController.merge);
router.post("/ai-automation/analyze-issue", aiAutomationController.analyzeIssue);

router.get("/health", (req, res) =>
  res.json({ status: "ok", uptime: process.uptime() }),
);

module.exports = router;
