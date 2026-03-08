// ─────────────────────────────────────────────────────────────────
// Request Logger Middleware
// Logs all incoming requests with correlation ID and response time
// ─────────────────────────────────────────────────────────────────

import { Request, Response, NextFunction } from "express";
import { logger } from "../utils/logger";
import crypto from "crypto";

export const requestLogger = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const start = process.hrtime();
  const correlationId = (req.headers["x-correlation-id"] ||
    req.headers["x-request-id"] ||
    crypto.randomUUID()) as string;

  // Pass pass correlationId further
  req.headers["x-correlation-id"] = correlationId;
  res.setHeader("X-Correlation-ID", correlationId);

  res.on("finish", () => {
    const diff = process.hrtime(start);
    const responseTimeMs = (diff[0] * 1e3 + diff[1] * 1e-6).toFixed(2);

    const logData = {
      correlationId,
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      responseTimeMs: Number(responseTimeMs),
      ip: req.ip || req.socket.remoteAddress,
      userAgent: req.headers["user-agent"],
    };

    const message = `${req.method} ${req.originalUrl} ${res.statusCode} ${responseTimeMs}ms`;

    // Track metrics
    import("../../shared/utils/metrics").then(({ metrics }) => {
      metrics.inc("http_requests_total", {
        method: req.method,
        status: res.statusCode.toString(),
      });
      metrics.observe(
        "http_request_duration_ms",
        { method: req.method },
        Number(responseTimeMs),
      );
    }).catch(err => {
      logger.error("Failed to import/track metrics", { error: err });
    });

    if (res.statusCode >= 500) {
      logger.error(message, logData);
    } else if (res.statusCode >= 400) {
      logger.warn(message, logData);
    } else {
      logger.info(message, logData);
    }
  });

  next();
};
