const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const path = require("path");

const config = require("./config/config");
const routes = require("./routes");
const { notFound, errorHandler } = require("./middleware/errorHandler");

const app = express();

app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(morgan(config.env === "development" ? "dev" : "combined"));

// serve captured screenshots so the frontend can render them directly
app.use("/screenshots", express.static(path.join(__dirname, "..", config.storage.screenshotsDir)));

app.use("/api", routes);

app.get("/", (req, res) => {
  res.json({
    name: "AI Website QA Engineer — Backend",
    status: "running",
    docs: "/api/health",
  });
});

app.use(notFound);
app.use(errorHandler);

module.exports = app;
