const deviceLabService = require("../services/deviceLab.service");

function getDevices(req, res) {
  res.json({ devices: deviceLabService.listDevices() });
}

async function render(req, res, next) {
  const { url, deviceId, orientation, browserEngine } = req.body || {};

  if (!url || !deviceId) {
    return res.status(400).json({ error: "url and deviceId are required" });
  }

  try {
    const result = await deviceLabService.renderDevice({
      url,
      deviceId,
      orientation,
      browserOverride: browserEngine,
    });
    res.json(result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
}

module.exports = { getDevices, render };
