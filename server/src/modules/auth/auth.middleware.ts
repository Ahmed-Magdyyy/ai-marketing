// ─────────────────────────────────────────────────────────────────
// Auth Middleware — JWT verification, attaches typed user to req.user
// Uses ErrorCode.Unauthorized and ErrorCode.TokenExpired via sendError()
// ─────────────────────────────────────────────────────────────────

import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { UserModel, IUserDocument } from "./user.model";
import { ErrorCode, getErrorMessage } from "../../shared/types";
import { getLang } from "../../shared/utils/apiResponse";
import { logger } from "../../shared/utils/logger";

// Extend Express Request to include typed user
declare global {
  namespace Express {
    interface Request {
      user?: IUserDocument;
    }
  }
}

async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const lang = getLang(req);

  // Extract token from Authorization header
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    const message = getErrorMessage(ErrorCode.Unauthorized, lang);
    res.status(401).json({
      success: false,
      data: null,
      message,
      errorCode: ErrorCode.Unauthorized,
    });
    return;
  }

  const token = authHeader.split(" ")[1];
  const jwtSecret: string = process.env.JWT_SECRET || "";

  try {
    const payload = jwt.verify(token, jwtSecret) as { userId: string };

    // Fetch user from DB
    const user = await UserModel.findById(payload.userId);
    if (!user) {
      const message = getErrorMessage(ErrorCode.Unauthorized, lang);
      res.status(401).json({
        success: false,
        data: null,
        message,
        errorCode: ErrorCode.Unauthorized,
      });
      return;
    }

    // Attach typed user to request
    req.user = user;
    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      const message = getErrorMessage(ErrorCode.TokenExpired, lang);
      logger.warn("jwt_expired", { path: req.path });
      res.status(401).json({
        success: false,
        data: null,
        message,
        errorCode: ErrorCode.TokenExpired,
      });
      return;
    }

    const message = getErrorMessage(ErrorCode.TokenInvalid, lang);
    logger.warn("jwt_invalid", { path: req.path });
    res.status(401).json({
      success: false,
      data: null,
      message,
      errorCode: ErrorCode.TokenInvalid,
    });
  }
}

export { authMiddleware };
