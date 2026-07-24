const deviceLabSession = require("../services/deviceLabSession.service");
const logger = require("../utils/logger");

module.exports = function registerDeviceLabSocket(io) {
  const nsp = io.of("/device-lab");

  nsp.on("connection", (socket) => {
    socket.on("start", async (payload, ack) => {
      try {
        const result = await deviceLabSession.startSession(socket, payload || {});
        ack?.({ ok: true, ...result });
      } catch (err) {
        logger.error("device-lab", `start failed: ${err.message}`);
        ack?.({ ok: false, error: err.message });
      }
    });

    socket.on("input", (action) => {
      deviceLabSession.handleInput(socket, action || {});
    });

    socket.on("inspect-dom", () => {
      deviceLabSession.inspectDom(socket);
    });

    socket.on("stop", () => {
      deviceLabSession.stopSession(socket);
    });

    socket.on("disconnect", () => {
      deviceLabSession.stopSession(socket);
    });
  });
};
