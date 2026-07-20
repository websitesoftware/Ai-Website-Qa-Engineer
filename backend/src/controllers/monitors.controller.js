const monitorsRepo = require("../repositories/monitors.repository");
const testsRepo = require("../repositories/tests.repository");
const usersRepo = require("../repositories/users.repository");
const { createMonitor } = require("../models/monitor.model");
const { triggerRun } = require("../services/monitorScheduler.service");

function isValidUrl(str) {
  try {
    const u = new URL(str);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function list(req, res) {
  res.json(monitorsRepo.list());
}

async function create(req, res) {
  const { url, name, frequency, modules, alertOnCritical } = req.body || {};
  if (!url || !isValidUrl(url)) {
    return res.status(400).json({ error: "A valid `url` (http/https) is required." });
  }

  const requester = usersRepo.getById(req.user.sub);
  const monitor = createMonitor({
    url,
    name,
    frequency,
    modules,
    alertOnCritical,
    createdBy: requester ? requester.id : null,
  });
  await monitorsRepo.create(monitor);
  res.status(201).json(monitor);
}

async function update(req, res) {
  const existing = monitorsRepo.get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Monitor not found" });

  const { frequency, enabled, alertOnCritical, modules, name } = req.body || {};
  const patch = {};
  if (frequency) patch.frequency = frequency;
  if (typeof enabled === "boolean") patch.enabled = enabled;
  if (typeof alertOnCritical === "boolean") patch.alertOnCritical = alertOnCritical;
  if (Array.isArray(modules)) patch.modules = modules;
  if (name) patch.name = name;

  const updated = await monitorsRepo.update(req.params.id, patch);
  res.json(updated);
}

async function remove(req, res) {
  const ok = await monitorsRepo.remove(req.params.id);
  if (!ok) return res.status(404).json({ error: "Monitor not found" });
  res.status(204).send();
}

function runNow(req, res) {
  const monitor = monitorsRepo.get(req.params.id);
  if (!monitor) return res.status(404).json({ error: "Monitor not found" });
  triggerRun(monitor);
  res.json({ message: "Scan triggered", monitor: monitorsRepo.get(req.params.id) });
}

function history(req, res) {
  const monitor = monitorsRepo.get(req.params.id);
  if (!monitor) return res.status(404).json({ error: "Monitor not found" });
  const runs = testsRepo.list().filter((t) => t.monitorId === req.params.id);
  res.json(runs);
}

module.exports = { list, create, update, remove, runNow, history };
