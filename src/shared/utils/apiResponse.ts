// ─────────────────────────────────────────────────────────────────
// Standard API Response Wrapper
// Every endpoint MUST return { success, data, message, errorCode? }.
// Controllers never pass raw message strings — only an ErrorCode + req.
// ─────────────────────────────────────────────────────────────────

import { Request, Response } from "express";
import { ApiResponse, ErrorCode, getErrorMessage } from "../types";

// ── getLang ────────────────────────────────────────────────────────
// Determines UI language from authenticated user pref or Accept-Language header.
// Default: 'ar' (Egyptian Arabic) — never assume English.

export function getLang(req: Request): "ar" | "en" {
  // req.user is typed as IUserDocument via Express.Request augmentation in auth.middleware.ts
  const userLang = req.user?.lang;
  if (userLang === "ar" || userLang === "en") return userLang;

  const acceptLang = req.headers["accept-language"]?.slice(0, 2);
  if (acceptLang === "en") return "en";

  return "ar"; // default
}

// ── Success Helpers ───────────────────────────────────────────────

function sendSuccess<T>(
  res: Response,
  data: T,
  message: string = "Success",
  statusCode: number = 200,
): void {
  const response: ApiResponse<T> = {
    success: true,
    data,
    message,
  };
  res.status(statusCode).json(response);
}

function sendCreated<T>(
  res: Response,
  data: T,
  message: string = "Created successfully",
): void {
  sendSuccess(res, data, message, 201);
}

// ── Error Helper ─────────────────────────────────────────────────
// Controllers call: sendError(res, 404, ErrorCode.NotFound, req)
// Message is auto-populated from ERROR_MESSAGES in the user's language.

function sendError(
  res: Response,
  statusCode: number,
  errorCode: ErrorCode,
  req: Request,
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

export { sendSuccess, sendError, sendCreated };
