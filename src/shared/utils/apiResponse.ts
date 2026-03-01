// ─────────────────────────────────────────────────────────────────
// Standard API Response Wrapper
// Every endpoint MUST return { success, data, message, errorCode? }.
// Controllers never pass raw message strings — only SuccessCode/ErrorCode + req.
// ─────────────────────────────────────────────────────────────────

import { Request, Response } from "express";
import {
  ApiResponse,
  ErrorCode,
  getErrorMessage,
  SuccessCode,
  getSuccessMessage,
} from "../types";

// ── getLang ────────────────────────────────────────────────────────
// Determines UI language from Accept-Language header.
// Default: 'ar' (Egyptian Arabic) — never assume English.

export function getLang(req?: Request): "ar" | "en" {
  const raw = req?.headers?.["accept-language"];
  const header = typeof raw === "string" ? raw : "ar";
  return header.startsWith("en") ? "en" : "ar";
}

// ── Success Helpers ───────────────────────────────────────────────

export function sendSuccess<T>(
  res: Response,
  data: T,
  statusCode = 200,
  successCode: SuccessCode = SuccessCode.Ok,
  req?: Request,
): void {
  const lang = getLang(req);
  const response: ApiResponse<T> = {
    success: true,
    data,
    message: getSuccessMessage(successCode, lang),
  };
  res.status(statusCode).json(response);
}

export function sendCreated<T>(
  res: Response,
  data: T,
  successCode: SuccessCode = SuccessCode.Created,
  req?: Request,
): void {
  sendSuccess(res, data, 201, successCode, req);
}

// ── Error Helper ─────────────────────────────────────────────────
// Controllers call: sendError(res, 404, ErrorCode.NotFound, req)
// Message is auto-populated from ERROR_MESSAGES in the user's language.

export function sendError(
  res: Response,
  statusCode: number,
  errorCode: ErrorCode,
  req?: Request,
  data: unknown = null,
): void {
  const lang = getLang(req);
  const message = getErrorMessage(errorCode, lang);

  const response: ApiResponse<unknown> = {
    success: false,
    data,
    message,
    errorCode,
  };
  res.status(statusCode).json(response);
}
