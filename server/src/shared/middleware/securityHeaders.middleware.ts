// ─────────────────────────────────────────────────────────────────
// Security Hardening Middleware
// Extra protections beyond Helmet: input length caps, param
// sanitization, and request size enforcement.
// ─────────────────────────────────────────────────────────────────

import { Request, Response, NextFunction } from "express";
import { logger } from "../utils/logger";

// ── Config ──────────────────────────────────────────────────────
const MAX_QUERY_STRING_LENGTH = 2048;
const MAX_SINGLE_FIELD_LENGTH = 50_000; // 50 KB per field
const MAX_URL_LENGTH = 2048;

// ── Middleware ───────────────────────────────────────────────────

export const securityHeaders = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  // 1. Reject oversized URLs
  if (req.originalUrl.length > MAX_URL_LENGTH) {
    logger.warn("security_url_too_long", {
      url: req.originalUrl.slice(0, 200),
      length: req.originalUrl.length,
    });
    res.status(414).json({
      success: false,
      message: "URI Too Long",
      data: null,
    });
    return;
  }

  // 2. Reject oversized query strings
  const qs = req.originalUrl.split("?")[1] || "";
  if (qs.length > MAX_QUERY_STRING_LENGTH) {
    logger.warn("security_query_too_long", {
      length: qs.length,
    });
    res.status(414).json({
      success: false,
      message: "Query string too long",
      data: null,
    });
    return;
  }

  // 3. Deep-scan body fields for oversized string values
  if (req.body && typeof req.body === "object") {
    const hasTooLong = checkFieldLengths(req.body, MAX_SINGLE_FIELD_LENGTH);
    if (hasTooLong) {
      logger.warn("security_field_too_long", {
        path: req.path,
        method: req.method,
      });
      res.status(413).json({
        success: false,
        message: "Request field exceeds maximum allowed length",
        data: null,
      });
      return;
    }
  }

  // 4. Additional security headers (supplement Helmet)
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "0"); // Modern browsers — rely on CSP instead
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()",
  );

  next();
};

// ── Helpers ─────────────────────────────────────────────────────

function checkFieldLengths(
  obj: Record<string, unknown>,
  max: number,
  depth = 0,
): boolean {
  if (depth > 10) return false; // prevent infinite recursion on deep objects

  for (const value of Object.values(obj)) {
    if (typeof value === "string" && value.length > max) {
      return true;
    }
    if (value && typeof value === "object" && !Array.isArray(value)) {
      if (checkFieldLengths(value as Record<string, unknown>, max, depth + 1)) {
        return true;
      }
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === "string" && item.length > max) return true;
        if (item && typeof item === "object") {
          if (
            checkFieldLengths(item as Record<string, unknown>, max, depth + 1)
          ) {
            return true;
          }
        }
      }
    }
  }
  return false;
}
