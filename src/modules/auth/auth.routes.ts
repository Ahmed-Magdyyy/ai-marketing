// ─────────────────────────────────────────────────────────────────
// Auth Routes — register, login, refresh, logout
// ─────────────────────────────────────────────────────────────────

import { Router, Request, Response } from "express";
import { authService } from "./auth.service";
import { registerSchema, loginSchema } from "./auth.validation";
import { authMiddleware } from "./auth.middleware";
import { asyncHandler } from "../../shared/utils/asyncHandler";
import { ApiError } from "../../shared/utils/ApiError";
import { ErrorCode } from "../../shared/types";

const router = Router();

// ── POST /api/auth/register ──────────────────────────────────────
router.post(
  "/register",
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { error, value } = registerSchema.validate(req.body, {
      abortEarly: false,
    });
    if (error) {
      throw new ApiError(
        400,
        ErrorCode.ValidationError,
        error.details.map((d) => d.message).join(", "),
      );
    }

    const { user, tokens } = await authService.register(value);

    // Set refresh token as httpOnly cookie
    res.cookie("refreshToken", tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.status(201).json({
      success: true,
      data: {
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          lang: user.lang,
          plan: user.plan,
        },
        accessToken: tokens.accessToken,
      },
      message: "تم التسجيل بنجاح",
    });
  }),
);

// ── POST /api/auth/login ─────────────────────────────────────────
router.post(
  "/login",
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { error, value } = loginSchema.validate(req.body, {
      abortEarly: false,
    });
    if (error) {
      throw new ApiError(
        400,
        ErrorCode.ValidationError,
        error.details.map((d) => d.message).join(", "),
      );
    }

    const { user, tokens } = await authService.login(value);

    // Set refresh token as httpOnly cookie
    res.cookie("refreshToken", tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.status(200).json({
      success: true,
      data: {
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          lang: user.lang,
          plan: user.plan,
        },
        accessToken: tokens.accessToken,
      },
      message: "تم تسجيل الدخول بنجاح",
    });
  }),
);

// ── POST /api/auth/refresh ───────────────────────────────────────
router.post(
  "/refresh",
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const refreshToken: string | undefined =
      req.cookies?.refreshToken || req.body?.refreshToken;

    if (!refreshToken) {
      throw new ApiError(401, ErrorCode.RefreshTokenInvalid);
    }

    const tokens = await authService.refreshAccessToken(refreshToken);

    // Rotate refresh token cookie
    res.cookie("refreshToken", tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.status(200).json({
      success: true,
      data: { accessToken: tokens.accessToken },
      message: "تم تجديد التوكن بنجاح",
    });
  }),
);

// ── POST /api/auth/logout ────────────────────────────────────────
router.post(
  "/logout",
  authMiddleware,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = req.user?._id?.toString();
    if (userId) {
      await authService.logout(userId);
    }

    // Clear refresh token cookie
    res.clearCookie("refreshToken");

    res.status(200).json({
      success: true,
      data: null,
      message: "تم تسجيل الخروج بنجاح",
    });
  }),
);

export default router;
