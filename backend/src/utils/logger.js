const levels = { info: "\x1b[36m", success: "\x1b[32m", warn: "\x1b[33m", error: "\x1b[31m" };
const reset = "\x1b[0m";

function log(level, tag, message) {
  const color = levels[level] || levels.info;
  const time = new Date().toISOString();
  console.log(`${color}[${time}] [${tag}] ${message}${reset}`);
}

module.exports = {
  info: (tag, msg) => log("info", tag, msg),
  success: (tag, msg) => log("success", tag, msg),
  warn: (tag, msg) => log("warn", tag, msg),
  error: (tag, msg) => log("error", tag, msg),
};
