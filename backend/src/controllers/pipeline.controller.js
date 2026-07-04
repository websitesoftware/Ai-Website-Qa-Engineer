const testsRepo = require("../repositories/tests.repository");
const queue = require("../services/queue.service");

function getPipeline(req, res) {
  const active = testsRepo
    .list()
    .filter((t) => t.status === "queued" || t.status === "running")
    .map((t) => ({
      id: t.id,
      name: t.name,
      url: t.url,
      status: t.status,
      progress: t.progress,
      currentStage: t.currentStage,
      startedAt: t.startedAt,
    }));

  res.json({
    activeScans: active,
    activeCount: queue.activeCount(),
    pendingCount: queue.pendingCount(),
  });
}

module.exports = { getPipeline };
