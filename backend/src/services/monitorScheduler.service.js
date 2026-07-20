const logger = require("../utils/logger");
const monitorsRepo = require("../repositories/monitors.repository");
const testsRepo = require("../repositories/tests.repository");
const { createTest } = require("../models/test.model");
const { FREQUENCY_MS } = require("../models/monitor.model");
const { enqueueScan } = require("./queue.service");

const CHECK_INTERVAL_MS = 60 * 1000;
let timer = null;

function triggerRun(monitor) {
  const test = createTest({
    url: monitor.url,
    name: `[Monitor] ${monitor.name}`,
    options: { modules: monitor.modules, monitorId: monitor.id },
    createdBy: monitor.createdBy,
    createdByName: null,
  });
  testsRepo.create(test);
  enqueueScan(test.id);

  const intervalMs = FREQUENCY_MS[monitor.frequency] || FREQUENCY_MS.daily;
  monitorsRepo.update(monitor.id, {
    lastRunAt: new Date().toISOString(),
    lastTestId: test.id,
    nextRunAt: Date.now() + intervalMs,
    lastRunReconciled: false,
  });
  logger.info("monitorScheduler", `Triggered scan for monitor "${monitor.name}" (${monitor.url})`);
}

function reconcileFinishedRuns() {
  const monitors = monitorsRepo.list().filter((m) => m.lastTestId && !m.lastRunReconciled);
  monitors.forEach((m) => {
    const test = testsRepo.get(m.lastTestId);
    if (!test || test.status === "queued" || test.status === "running") return;

    const hadCritical = (test.issues || []).some((i) => i.severity === "critical");
    monitorsRepo.update(m.id, {
      lastRunHadCriticalIssues: hadCritical && m.alertOnCritical,
      lastRunReconciled: true,
    });
  });
}

function tick() {
  const now = Date.now();
  monitorsRepo
    .list()
    .filter((m) => m.enabled && m.nextRunAt <= now)
    .forEach(triggerRun);
  reconcileFinishedRuns();
}

function startScheduler() {
  if (timer) return;
  timer = setInterval(tick, CHECK_INTERVAL_MS);
  tick(); // catch up on anything due immediately at boot
  logger.info("monitorScheduler", "Continuous monitoring scheduler started (60s tick)");
}

module.exports = { startScheduler, triggerRun };
