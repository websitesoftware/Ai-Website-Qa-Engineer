const policiesRepo = require("../repositories/policies.repository");
const { createPolicy } = require("../models/policy.model");

function list(req, res) {
  res.json(policiesRepo.list());
}

async function create(req, res) {
  const { name, scoreRanges } = req.body || {};
  if (!name) return res.status(400).json({ error: "name is required" });

  const policy = createPolicy({ name, scoreRanges, createdBy: req.user.sub });
  await policiesRepo.create(policy);
  res.status(201).json(policy);
}

async function update(req, res) {
  const existing = policiesRepo.get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Policy not found" });

  const { name, scoreRanges } = req.body || {};
  const patch = {};
  if (name) patch.name = name;
  if (scoreRanges) {
    patch.scoreRanges = { ...existing.scoreRanges };
    for (const [key, range] of Object.entries(scoreRanges)) {
      if (!range) continue;
      patch.scoreRanges[key] = { ...patch.scoreRanges[key], ...range };
    }
  }

  const updated = await policiesRepo.update(req.params.id, patch);
  res.json(updated);
}

async function remove(req, res) {
  const ok = await policiesRepo.remove(req.params.id);
  if (!ok) return res.status(404).json({ error: "Policy not found" });
  res.status(204).send();
}

async function setActive(req, res) {
  const existing = policiesRepo.get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Policy not found" });
  const updated = await policiesRepo.setActive(req.params.id);
  res.json(updated);
}

module.exports = { list, create, update, remove, setActive };
