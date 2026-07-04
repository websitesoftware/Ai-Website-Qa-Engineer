const app = require("./src/app");
const config = require("./src/config/config");
const logger = require("./src/utils/logger");
const { closeBrowser } = require("./src/services/browser.service");

const server = app.listen(config.port, () => {
  logger.success("server", `AI QA Engineer backend running on http://localhost:${config.port}`);
});

async function shutdown(signal) {
  logger.warn("server", `${signal} received. Shutting down gracefully...`);
  server.close(async () => {
    await closeBrowser();
    process.exit(0);
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
