// ─────────────────────────────────────────────────────────────────
// Structured JSON Logger (Winston)
// Use logger.info / logger.warn / logger.error everywhere.
// Never use console.log in business logic.
// ─────────────────────────────────────────────────────────────────

import winston from "winston";

const logger: winston.Logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    winston.format.errors({ stack: true }),
    winston.format.json(),
  ),
  defaultMeta: { service: "ai-marketing-platform" },
  transports: [
    // Console — human-readable in dev, JSON in production
    new winston.transports.Console({
      format:
        process.env.NODE_ENV === "production"
          ? winston.format.json()
          : winston.format.combine(
              winston.format.colorize(),
              winston.format.printf(
                ({ timestamp, level, message, ...meta }) => {
                  const metaStr =
                    Object.keys(meta).length > 1
                      ? ` ${JSON.stringify(meta)}`
                      : "";
                  return `${timestamp as string} [${level}]: ${message as string}${metaStr}`;
                },
              ),
            ),
    }),
  ],
});

export { logger };
