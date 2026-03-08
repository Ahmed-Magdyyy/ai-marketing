// ─────────────────────────────────────────────────────────────────
// Auth Routes — all auth endpoints
// Public: register, login, verify-email, resend-otp, forgot-password,
//         verify-reset-otp, reset-password, google/auth
// Authenticated: logout, refresh, change-password,
//                google/link, google/unlink
// ─────────────────────────────────────────────────────────────────

import { Router } from "express";
import { authMiddleware } from "./auth.middleware";
import { authLimiter } from "../../shared/middleware/rateLimiter";
import {
  registerHandler,
  loginHandler,
  verifyEmailHandler,
  resendOtpHandler,
  forgotPasswordHandler,
  verifyResetOtpHandler,
  resetPasswordHandler,
  changePasswordHandler,
  googleAuthHandler,
  linkGoogleHandler,
  unlinkGoogleHandler,
  refreshHandler,
  logoutHandler,
} from "./auth.controller";

const router = Router();

// ── Public Routes (no auth required) ─────────────────────────────

router.post("/register", authLimiter, registerHandler);
router.post("/login", authLimiter, loginHandler);

// Email verification — no auth (userId comes from register response body)
router.post("/verify-email", authLimiter, verifyEmailHandler);
router.post("/resend-otp", authLimiter, resendOtpHandler);

// Password reset — OTP-based, no auth
router.post("/forgot-password", authLimiter, forgotPasswordHandler);
router.post("/verify-reset-otp", authLimiter, verifyResetOtpHandler);
router.post("/reset-password", authLimiter, resetPasswordHandler);

// Google OAuth — no auth
router.post("/google/auth", authLimiter, googleAuthHandler);

// Token refresh — no authMiddleware (uses refresh token)
router.post("/refresh", refreshHandler);

// ── Authenticated Routes ─────────────────────────────────────────

router.post("/logout", authMiddleware, logoutHandler);
router.post("/change-password", authMiddleware, changePasswordHandler);
router.post("/google/link", authMiddleware, linkGoogleHandler);
router.post("/google/unlink", authMiddleware, unlinkGoogleHandler);

export default router;
