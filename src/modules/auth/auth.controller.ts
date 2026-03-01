// ─────────────────────────────────────────────────────────────────
// Auth Controller — all auth endpoint handlers
// ─────────────────────────────────────────────────────────────────

import { Request, Response } from "express";
import { authService } from "./auth.service";
import {
  registerSchema,
  loginSchema,
  verifyEmailSchema,
  resendOtpSchema,
  forgotPasswordSchema,
  verifyResetOtpSchema,
  resetPasswordSchema,
  changePasswordSchema,
  googleAuthSchema,
  linkGoogleSchema,
} from "./auth.validation";
import { asyncHandler } from "../../shared/utils/asyncHandler";
import { ApiError } from "../../shared/utils/ApiError";
import { ErrorCode, SuccessCode } from "../../shared/types";
import {
  sendSuccess,
  sendCreated,
  getLang,
} from "../../shared/utils/apiResponse";

// ── Register ────────────────────────────────────────────────────

export const registerHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
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

    return sendCreated(
      res,
      {
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          lang: user.lang,
          plan: user.plan,
        },
        accessToken: tokens.accessToken,
      },
      SuccessCode.Created,
      req,
    );
  },
);

// ── Login ───────────────────────────────────────────────────────

export const loginHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
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

    return sendSuccess(
      res,
      {
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          lang: user.lang,
          plan: user.plan,
        },
        accessToken: tokens.accessToken,
      },
      200,
      SuccessCode.LoggedIn,
      req,
    );
  },
);

// ── Verify Email ────────────────────────────────────────────────

export const verifyEmailHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { error, value } = verifyEmailSchema.validate(req.body, {
      abortEarly: false,
    });
    if (error) {
      throw new ApiError(
        400,
        ErrorCode.ValidationError,
        error.details.map((d) => d.message).join(", "),
      );
    }

    await authService.verifyEmail(value.userId, value.otp);

    return sendSuccess(res, null, 200, SuccessCode.EmailVerified, req);
  },
);

// ── Resend Verification OTP ─────────────────────────────────────

export const resendOtpHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { error, value } = resendOtpSchema.validate(req.body, {
      abortEarly: false,
    });
    if (error) {
      throw new ApiError(
        400,
        ErrorCode.ValidationError,
        error.details.map((d) => d.message).join(", "),
      );
    }

    const lang = getLang(req);
    await authService.resendVerificationOtp(value.userId, lang);

    return sendSuccess(res, null, 200, SuccessCode.OtpSent, req);
  },
);

// ── Forgot Password ─────────────────────────────────────────────

export const forgotPasswordHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { error, value } = forgotPasswordSchema.validate(req.body, {
      abortEarly: false,
    });
    if (error) {
      throw new ApiError(
        400,
        ErrorCode.ValidationError,
        error.details.map((d) => d.message).join(", "),
      );
    }

    const lang = getLang(req);
    await authService.requestPasswordReset(value.email, lang);

    // Always return success — don't reveal if email exists
    return sendSuccess(res, null, 200, SuccessCode.OtpSent, req);
  },
);

// ── Verify Reset OTP ────────────────────────────────────────────

export const verifyResetOtpHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { error, value } = verifyResetOtpSchema.validate(req.body, {
      abortEarly: false,
    });
    if (error) {
      throw new ApiError(
        400,
        ErrorCode.ValidationError,
        error.details.map((d) => d.message).join(", "),
      );
    }

    const result = await authService.verifyResetOtp(value.email, value.otp);

    return sendSuccess(
      res,
      { resetToken: result.resetToken },
      200,
      SuccessCode.PasswordResetVerified,
      req,
    );
  },
);

// ── Reset Password ──────────────────────────────────────────────

export const resetPasswordHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { error, value } = resetPasswordSchema.validate(req.body, {
      abortEarly: false,
    });
    if (error) {
      throw new ApiError(
        400,
        ErrorCode.ValidationError,
        error.details.map((d) => d.message).join(", "),
      );
    }

    await authService.resetPassword(value.resetToken, value.newPassword);

    return sendSuccess(res, null, 200, SuccessCode.PasswordReset, req);
  },
);

// ── Change Password (authenticated) ─────────────────────────────

export const changePasswordHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const userId = req.user?._id?.toString();
    if (!userId) {
      throw new ApiError(401, ErrorCode.Unauthorized);
    }

    const { error, value } = changePasswordSchema.validate(req.body, {
      abortEarly: false,
    });
    if (error) {
      throw new ApiError(
        400,
        ErrorCode.ValidationError,
        error.details.map((d) => d.message).join(", "),
      );
    }

    await authService.changePassword(
      userId,
      value.currentPassword,
      value.newPassword,
    );

    return sendSuccess(res, null, 200, SuccessCode.PasswordReset, req);
  },
);

// ── Google Auth ──────────────────────────────────────────────────

export const googleAuthHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { error, value } = googleAuthSchema.validate(req.body, {
      abortEarly: false,
    });
    if (error) {
      throw new ApiError(
        400,
        ErrorCode.ValidationError,
        error.details.map((d) => d.message).join(", "),
      );
    }

    const { user, tokens, isNewUser } = await authService.googleAuth(
      value.idToken,
      value.lang,
    );

    // Set refresh token as httpOnly cookie
    res.cookie("refreshToken", tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    const successCode = isNewUser ? SuccessCode.Created : SuccessCode.LoggedIn;
    const statusCode = isNewUser ? 201 : 200;

    return sendSuccess(
      res,
      {
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          lang: user.lang,
          plan: user.plan,
        },
        accessToken: tokens.accessToken,
        isNewUser,
      },
      statusCode,
      successCode,
      req,
    );
  },
);

// ── Link Google (authenticated) ─────────────────────────────────

export const linkGoogleHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const userId = req.user?._id?.toString();
    if (!userId) {
      throw new ApiError(401, ErrorCode.Unauthorized);
    }

    const { error, value } = linkGoogleSchema.validate(req.body, {
      abortEarly: false,
    });
    if (error) {
      throw new ApiError(
        400,
        ErrorCode.ValidationError,
        error.details.map((d) => d.message).join(", "),
      );
    }

    await authService.linkGoogle(userId, value.idToken);

    return sendSuccess(res, null, 200, SuccessCode.GoogleLinked, req);
  },
);

// ── Unlink Google (authenticated) ────────────────────────────────

export const unlinkGoogleHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const userId = req.user?._id?.toString();
    if (!userId) {
      throw new ApiError(401, ErrorCode.Unauthorized);
    }

    await authService.unlinkGoogle(userId);

    return sendSuccess(res, null, 200, SuccessCode.GoogleUnlinked, req);
  },
);

// ── Refresh ─────────────────────────────────────────────────────

export const refreshHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
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

    return sendSuccess(
      res,
      { accessToken: tokens.accessToken },
      200,
      SuccessCode.Ok,
      req,
    );
  },
);

// ── Logout ──────────────────────────────────────────────────────

export const logoutHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const userId = req.user?._id?.toString();
    if (userId) {
      await authService.logout(userId);
    }

    // Clear refresh token cookie
    res.clearCookie("refreshToken");

    return sendSuccess(res, null, 200, SuccessCode.LoggedOut, req);
  },
);
