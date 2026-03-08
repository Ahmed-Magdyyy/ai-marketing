// ─────────────────────────────────────────────────────────────────
// Admin Middleware — ensures user has admin role
// ─────────────────────────────────────────────────────────────────

import { Request, Response, NextFunction } from "express";
import { ApiError } from "../../shared/utils/ApiError";
import { ErrorCode, UserRole } from "../../shared/types";

export function adminMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const user = req.user;

  if (!user) {
    throw new ApiError(401, ErrorCode.Unauthorized);
  }

  if (user.role !== UserRole.Admin) {
    throw new ApiError(403, ErrorCode.Forbidden);
  }

  next();
}
