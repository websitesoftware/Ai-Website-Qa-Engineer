const logger = require("../utils/logger");

function notFound(req, res, next) {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.originalUrl}` });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  logger.error("http", err.stack || err.message);
  res.status(err.status || 500).json({
    error: err.message || "Internal server error",
  });
}

module.exports = { notFound, errorHandler };
