const logger = {
  info: (msg) => process.stdout.write(`[INFO] ${new Date().toLocaleTimeString()} - ${msg}\n`),
  warn: (msg) => process.stdout.write(`[WARN] ${new Date().toLocaleTimeString()} - ${msg}\n`),
  error: (msg) => process.stderr.write(`[ERROR] ${new Date().toLocaleTimeString()} - ${msg}\n`)
};
module.exports = logger;
