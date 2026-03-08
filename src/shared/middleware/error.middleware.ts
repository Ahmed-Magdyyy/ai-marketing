// ─────────────────────────────────────────────────────────────────
// Global Error Handler + 404 Not Found Handler
// Catches all unhandled errors passed via next(err).
// Uses sendError() from apiResponse.ts with ErrorCode.InternalError fallback.
// Never leaks stack traces to client in production.
// ─────────────────────────────────────────────────────────────────

import { Request, Response, NextFunction } from "express";
import { ApiError } from "../utils/ApiError";
import { ErrorCode, getErrorMessage } from "../types";
import { getLang } from "../utils/apiResponse";
import { logger } from "../utils/logger";
import * as Sentry from "@sentry/node";

// ── Sentry Initialization ─────────────────────────────────────────
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || "development",
    // Tracing
    tracesSampleRate: 1.0, 
  });
  logger.info("sentry_initialized", { dsn: process.env.SENTRY_DSN });
}

function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const lang = getLang(req);

  // ── ApiError — known, structured errors ───────────────────────
  if (err instanceof ApiError) {
    const message = getErrorMessage(err.errorCode, lang);

    logger.error("api_error", {
      errorCode: err.errorCode,
      statusCode: err.statusCode,
      path: req.path,
      method: req.method,
      stack: err.stack,
    });

    res.status(err.statusCode).json({
      success: false,
      data: err.data,
      message,
      errorCode: err.errorCode,
    });
    return;
  }

  // ── Mongoose Validation Error ─────────────────────────────────
  if (err.name === "ValidationError") {
    const message = getErrorMessage(ErrorCode.ValidationError, lang);

    logger.error("mongoose_validation_error", {
      path: req.path,
      method: req.method,
      errorMessage: err.message,
      stack: err.stack,
    });

    res.status(400).json({
      success: false,
      data: null,
      message,
      errorCode: ErrorCode.ValidationError,
    });
    return;
  }

  // ── Mongoose Duplicate Key Error (code 11000) ─────────────────
  const mongoError = err as Error & { code?: number };
  if (mongoError.code === 11000) {
    const message = getErrorMessage(ErrorCode.AlreadyExists, lang);

    logger.error("duplicate_key_error", {
      path: req.path,
      method: req.method,
      errorMessage: err.message,
      stack: err.stack,
    });

    res.status(409).json({
      success: false,
      data: null,
      message,
      errorCode: ErrorCode.AlreadyExists,
    });
    return;
  }

  // ── JWT Errors ────────────────────────────────────────────────
  if (err.name === "JsonWebTokenError") {
    const message = getErrorMessage(ErrorCode.TokenInvalid, lang);

    logger.error("jwt_invalid_error", {
      path: req.path,
      method: req.method,
      stack: err.stack,
    });

    res.status(401).json({
      success: false,
      data: null,
      message,
      errorCode: ErrorCode.TokenInvalid,
    });
    return;
  }

  if (err.name === "TokenExpiredError") {
    const message = getErrorMessage(ErrorCode.TokenExpired, lang);

    logger.error("jwt_expired_error", {
      path: req.path,
      method: req.method,
      stack: err.stack,
    });

    res.status(401).json({
      success: false,
      data: null,
      message,
      errorCode: ErrorCode.TokenExpired,
    });
    return;
  }

  // ── Unhandled / Unknown Error ─────────────────────────────────
  logger.error("unhandled_error", {
    path: req.path,
    method: req.method,
    errorName: err.name,
    errorMessage: err.message,
    stack: err.stack,
  });

  if (process.env.SENTRY_DSN) {
    Sentry.captureException(err, {
      tags: {
        path: req.path,
        method: req.method,
      },
    });
  }

  const message = getErrorMessage(ErrorCode.InternalError, lang);

  res.status(500).json({
    success: false,
    data: process.env.NODE_ENV === "production" ? null : { error: err.message },
    message,
    errorCode: ErrorCode.InternalError,
  });
}

// ── 404 Handler — no route matched ──────────────────────────────

function notFoundHandler(req: Request, res: Response): void {
  const lang = getLang(req);
  const message = getErrorMessage(ErrorCode.NotFound, lang);

  res.status(404).json({
    success: false,
    data: null,
    message,
    errorCode: ErrorCode.NotFound,
  });
}

export { errorHandler, notFoundHandler };
