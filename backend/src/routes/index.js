
const express = require("express");
const router = express.Router();

const testsRoutes = require("./tests.routes");
const authRoutes = require("./authRoutes");
const teamRoutes = require("./team.routes");
const policiesRoutes = require("./policies.routes");
const brandingRoutes = require("./branding.routes");
const monitorsRoutes = require("./monitors.routes");
const analyticsRoutes = require("./analytics.routes");
const deviceLabRoutes = require("./deviceLab.routes");
const statsController = require("../controllers/stats.controller");
const pipelineController = require("../controllers/pipeline.controller");
const aiAutomationController = require("../controllers/aiAutomation.controller");
const nvdaAgentController = require("../controllers/nvdaAgent.controller");

router.use("/auth", authRoutes);
router.use("/tests", testsRoutes);
router.use("/team", teamRoutes);
router.use("/policies", policiesRoutes);
router.use("/branding", brandingRoutes);
router.use("/monitors", monitorsRoutes);
router.use("/analytics", analyticsRoutes);
router.use("/device-lab", deviceLabRoutes);
router.get("/stats", statsController.getStats);
router.get("/pipeline", pipelineController.getPipeline);

// ---- Phase 3: AI Automation ----
router.get("/ai-automation/status", aiAutomationController.getStatus);
router.post("/ai-automation/run", aiAutomationController.run);
router.post("/ai-automation/pr", aiAutomationController.createPr);
router.post("/ai-automation/cicd", aiAutomationController.cicd);
router.post("/ai-automation/merge", aiAutomationController.merge);
router.post("/ai-automation/analyze-issue", aiAutomationController.analyzeIssue);
router.post("/ai-automation/review-code", aiAutomationController.reviewCode);
router.get("/ai-automation/locate", aiAutomationController.locate);

// ---- NVDA Screen Reader Agent ----
router.post("/nvda-agent/scan", nvdaAgentController.scan);
router.get("/nvda-agent/proxy", nvdaAgentController.proxy);

router.get("/health", (req, res) =>
  res.json({ status: "ok", uptime: process.uptime() }),
);

module.exports = router;
