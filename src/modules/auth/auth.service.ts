// ─────────────────────────────────────────────────────────────────
// Auth Service — register, login, token refresh, logout,
// email verification, OTP-based password reset, Google OAuth
// ─────────────────────────────────────────────────────────────────

import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { UserModel, IUserDocument } from "./user.model";
import { ApiError } from "../../shared/utils/ApiError";
import { ErrorCode, PlanTier } from "../../shared/types";
import { getPlanLimits } from "../../shared/config/planLimits";
import { logger } from "../../shared/utils/logger";
import sendEmail, {
  buildOtpEmail,
  getOtpSubject,
} from "../../shared/utils/email.service";
import {
  generateOtp,
  storeOtp,
  verifyOtp,
  getResendCount,
  incrementResendCount,
  canResend,
} from "../../shared/utils/otp.utils";
import { verifyGoogleToken } from "../../shared/utils/google.utils";

const SALT_ROUNDS = 12;
const RESET_TOKEN_EXPIRES_IN = "15m";

// ── Token Generation ─────────────────────────────────────────────

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

function generateTokens(userId: string): TokenPair {
  const jwtSecret: string = process.env.JWT_SECRET || "";
  const jwtRefreshSecret: string = process.env.JWT_REFRESH_SECRET || "";

  const accessToken = jwt.sign({ userId }, jwtSecret, {
    expiresIn: "1h",
  });

  const refreshToken = jwt.sign({ userId }, jwtRefreshSecret, {
    expiresIn: "7d",
  });

  return { accessToken, refreshToken };
}

// ── Register ─────────────────────────────────────────────────────

interface RegisterInput {
  email: string;
  password: string;
  name: string;
  phone?: string;
  lang?: "ar" | "en";
}

async function register(
  input: RegisterInput,
): Promise<{ user: IUserDocument; tokens: TokenPair }> {
  const { email, password, name, phone, lang } = input;

  // Check if user already exists
  const existingUser = await UserModel.findOne({ email });
  if (existingUser) {
    throw new ApiError(409, ErrorCode.AlreadyExists);
  }

  // Hash password
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  // Resolve plan limits for Free tier
  const freeLimits = getPlanLimits(PlanTier.Free);

  // Create user (status: 'inactive' until email verified)
  const user = await UserModel.create({
    email,
    passwordHash,
    name,
    phone: phone || "",
    lang: lang || "ar",
    isEmailVerified: false,
    status: "inactive",
    limits: {
      brandsAllowed: freeLimits.brandsAllowed,
      postsPerMonth: freeLimits.postsPerMonth,
      imagesPerMonth: freeLimits.imagesPerMonth,
      videosPerMonth: freeLimits.videosPerMonth,
      voiceoversPerMonth: freeLimits.voiceoversPerMonth,
      designsPerMonth: freeLimits.designsPerMonth,
      competitorResearchPerMonth: freeLimits.competitorResearchPerMonth,
      platforms: freeLimits.platforms,
      agentMemoryMonths: freeLimits.agentMemoryMonths,
      prioritySupport: freeLimits.prioritySupport,
    },
  });

  // Generate tokens
  const tokens = generateTokens(user._id.toString());

  // Store refresh token
  user.refreshToken = tokens.refreshToken;
  await user.save();

  // Send verification OTP (non-blocking — user can resend if this fails)
  const userLang = lang || "ar";
  sendVerificationOtp(user._id.toString(), email, userLang).catch((err) => {
    logger.error("register_otp_email_failed", {
      userId: user._id,
      email,
      error: String(err),
    });
  });

  logger.info("user_registered", { userId: user._id, email });

  return { user, tokens };
}

// ── Login ────────────────────────────────────────────────────────

interface LoginInput {
  email: string;
  password: string;
}

async function login(
  input: LoginInput,
): Promise<{ user: IUserDocument; tokens: TokenPair }> {
  const { email, password } = input;

  // Find user
  const user = await UserModel.findOne({ email });
  if (!user) {
    throw new ApiError(401, ErrorCode.InvalidCredentials);
  }

  // Compare password — Google-only accounts have empty passwordHash
  if (!user.passwordHash) {
    // Check if this is a Google-only account
    const hasGoogle = user.authProviders.some((p) => p.provider === "google");
    if (hasGoogle) {
      throw new ApiError(403, ErrorCode.GoogleAuthRequired);
    }
    throw new ApiError(401, ErrorCode.InvalidCredentials);
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    logger.warn("login_password_mismatch", { email });
    throw new ApiError(401, ErrorCode.InvalidCredentials);
  }

  // Check email verification first
  if (!user.isEmailVerified) {
    throw new ApiError(403, ErrorCode.EmailNotVerified);
  }

  // Check account status
  if (user.status === "suspended") {
    throw new ApiError(403, ErrorCode.AccountSuspended);
  }
  if (user.status === "banned") {
    throw new ApiError(403, ErrorCode.AccountBanned);
  }
  if (user.status === "inactive") {
    throw new ApiError(403, ErrorCode.AccountInactive);
  }

  // Generate tokens
  const tokens = generateTokens(user._id.toString());

  // Update refresh token + last login
  user.refreshToken = tokens.refreshToken;
  user.lastLoginAt = new Date();
  await user.save();

  logger.info("user_logged_in", { userId: user._id, email });

  return { user, tokens };
}

// ── Email Verification ───────────────────────────────────────────

async function sendVerificationOtp(
  userId: string,
  email: string,
  lang: "ar" | "en",
): Promise<void> {
  const otp = generateOtp();
  await storeOtp(userId, otp, "email_verification");

  const subject = getOtpSubject("email_verification", lang);
  const html = buildOtpEmail(otp, lang, "email_verification");
  await sendEmail({ email, subject, message: html });

  logger.info("verification_otp_sent", { userId, email });
}

async function verifyEmail(userId: string, otp: string): Promise<void> {
  const result = await verifyOtp(userId, "email_verification", otp);

  if (result === "expired") {
    throw new ApiError(400, ErrorCode.OtpExpired);
  }
  if (result === "invalid") {
    throw new ApiError(400, ErrorCode.OtpInvalid);
  }

  // Mark email as verified and activate account
  await UserModel.findByIdAndUpdate(userId, {
    isEmailVerified: true,
    status: "active",
  });

  logger.info("email_verified", { userId });
}

async function resendVerificationOtp(
  userId: string,
  lang: "ar" | "en",
): Promise<void> {
  const user = await UserModel.findById(userId);
  if (!user) {
    throw new ApiError(404, ErrorCode.NotFound);
  }

  if (user.isEmailVerified) {
    throw new ApiError(400, ErrorCode.ValidationError);
  }

  // Check resend limit
  const count = await getResendCount(userId, "email_verification");
  if (!canResend(count)) {
    throw new ApiError(429, ErrorCode.OtpResendLimit);
  }

  await incrementResendCount(userId, "email_verification");
  await sendVerificationOtp(userId, user.email, lang);
}

// ── OTP-based Password Reset ────────────────────────────────────

async function requestPasswordReset(
  email: string,
  lang: "ar" | "en",
): Promise<void> {
  const user = await UserModel.findOne({ email });
  if (!user) {
    // Silent — don't reveal if email exists
    return;
  }

  // Check resend limit
  const userId = user._id.toString();
  const count = await getResendCount(userId, "password_reset");
  if (!canResend(count)) {
    throw new ApiError(429, ErrorCode.OtpResendLimit);
  }

  const otp = generateOtp();
  await storeOtp(userId, otp, "password_reset");
  await incrementResendCount(userId, "password_reset");

  const subject = getOtpSubject("password_reset", lang);
  const html = buildOtpEmail(otp, lang, "password_reset");
  await sendEmail({ email, subject, message: html });

  logger.info("password_reset_otp_sent", { userId, email });
}

async function verifyResetOtp(
  email: string,
  otp: string,
): Promise<{ resetToken: string }> {
  const user = await UserModel.findOne({ email });
  if (!user) {
    throw new ApiError(400, ErrorCode.OtpInvalid);
  }

  const userId = user._id.toString();
  const result = await verifyOtp(userId, "password_reset", otp);

  if (result === "expired") {
    throw new ApiError(400, ErrorCode.OtpExpired);
  }
  if (result === "invalid") {
    throw new ApiError(400, ErrorCode.OtpInvalid);
  }

  // Generate short-lived reset token (15 min)
  const jwtSecret: string = process.env.JWT_SECRET || "";
  const resetToken = jwt.sign(
    { userId, purpose: "password_reset" },
    jwtSecret,
    { expiresIn: RESET_TOKEN_EXPIRES_IN },
  );

  logger.info("reset_otp_verified", { userId });

  return { resetToken };
}

async function resetPassword(
  resetToken: string,
  newPassword: string,
): Promise<void> {
  const jwtSecret: string = process.env.JWT_SECRET || "";

  let payload: { userId: string; purpose: string };
  try {
    payload = jwt.verify(resetToken, jwtSecret) as {
      userId: string;
      purpose: string;
    };
  } catch {
    throw new ApiError(400, ErrorCode.PasswordResetTokenInvalid);
  }

  if (payload.purpose !== "password_reset") {
    throw new ApiError(400, ErrorCode.PasswordResetTokenInvalid);
  }

  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

  await UserModel.findByIdAndUpdate(payload.userId, {
    passwordHash,
    passwordChangedAt: new Date(),
    $unset: { refreshToken: 1 }, // Force re-login after password reset
  });

  logger.info("password_reset_completed", { userId: payload.userId });
}

// ── Change Password (authenticated) ─────────────────────────────

async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const user = await UserModel.findById(userId);
  if (!user) {
    throw new ApiError(404, ErrorCode.NotFound);
  }

  const isMatch = await user.comparePassword(currentPassword);
  if (!isMatch) {
    throw new ApiError(401, ErrorCode.InvalidCredentials);
  }

  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  user.passwordHash = passwordHash;
  user.passwordChangedAt = new Date();
  await user.save();

  logger.info("password_changed", { userId });
}

// ── Google OAuth ─────────────────────────────────────────────────

async function googleAuth(
  idToken: string,
  lang: "ar" | "en",
): Promise<{ user: IUserDocument; tokens: TokenPair; isNewUser: boolean }> {
  let googlePayload;
  try {
    googlePayload = await verifyGoogleToken(idToken);
  } catch {
    throw new ApiError(401, ErrorCode.GoogleAuthFailed);
  }

  const { providerUserId, email, name } = googlePayload;

  // 1. Check if a user already has this Google provider linked
  let user = await UserModel.findOne({
    "authProviders.provider": "google",
    "authProviders.providerUserId": providerUserId,
  });

  if (user) {
    // Existing Google user — login
    const tokens = generateTokens(user._id.toString());
    user.refreshToken = tokens.refreshToken;
    user.lastLoginAt = new Date();
    await user.save();

    logger.info("google_login", { userId: user._id, email });
    return { user, tokens, isNewUser: false };
  }

  // 2. Check if user exists with this email (link Google to existing account)
  user = await UserModel.findOne({ email });

  if (user) {
    // Link Google provider to existing account
    user.authProviders.push({
      provider: "google",
      providerUserId,
      providerEmail: email,
      linkedAt: new Date(),
    });
    user.isEmailVerified = true;
    if (user.status === "inactive") {
      user.status = "active";
    }
    const tokens = generateTokens(user._id.toString());
    user.refreshToken = tokens.refreshToken;
    user.lastLoginAt = new Date();
    await user.save();

    logger.info("google_linked_existing", { userId: user._id, email });
    return { user, tokens, isNewUser: false };
  }

  // 3. Create new user via Google
  const freeLimits = getPlanLimits(PlanTier.Free);

  user = await UserModel.create({
    email,
    name,
    lang,
    isEmailVerified: true,
    status: "active",
    signupProvider: "google",
    authProviders: [
      {
        provider: "google",
        providerUserId,
        providerEmail: email,
        linkedAt: new Date(),
      },
    ],
    limits: {
      brandsAllowed: freeLimits.brandsAllowed,
      postsPerMonth: freeLimits.postsPerMonth,
      imagesPerMonth: freeLimits.imagesPerMonth,
      videosPerMonth: freeLimits.videosPerMonth,
      voiceoversPerMonth: freeLimits.voiceoversPerMonth,
      designsPerMonth: freeLimits.designsPerMonth,
      competitorResearchPerMonth: freeLimits.competitorResearchPerMonth,
      platforms: freeLimits.platforms,
      agentMemoryMonths: freeLimits.agentMemoryMonths,
      prioritySupport: freeLimits.prioritySupport,
    },
  });

  const tokens = generateTokens(user._id.toString());
  user.refreshToken = tokens.refreshToken;
  await user.save();

  logger.info("google_registered", { userId: user._id, email });
  return { user, tokens, isNewUser: true };
}

async function linkGoogle(userId: string, idToken: string): Promise<void> {
  let googlePayload;
  try {
    googlePayload = await verifyGoogleToken(idToken);
  } catch {
    throw new ApiError(401, ErrorCode.GoogleAuthFailed);
  }

  const { providerUserId, email } = googlePayload;

  // Check if this Google ID is already linked to another user
  const existing = await UserModel.findOne({
    "authProviders.provider": "google",
    "authProviders.providerUserId": providerUserId,
  });
  if (existing && existing._id.toString() !== userId) {
    throw new ApiError(409, ErrorCode.AlreadyExists);
  }

  const user = await UserModel.findById(userId);
  if (!user) {
    throw new ApiError(404, ErrorCode.NotFound);
  }

  // Check if user already has Google linked
  const alreadyLinked = user.authProviders.some((p) => p.provider === "google");
  if (alreadyLinked) {
    throw new ApiError(409, ErrorCode.AlreadyExists);
  }

  user.authProviders.push({
    provider: "google",
    providerUserId,
    providerEmail: email,
    linkedAt: new Date(),
  });
  await user.save();

  logger.info("google_linked", { userId });
}

async function unlinkGoogle(userId: string): Promise<void> {
  const user = await UserModel.findById(userId);
  if (!user) {
    throw new ApiError(404, ErrorCode.NotFound);
  }

  // Don't allow unlinking if Google is the sole login method
  // (no password set and no other auth providers)
  const hasPassword = Boolean(user.passwordHash);
  const otherProviders = user.authProviders.filter(
    (p) => p.provider !== "google",
  );
  if (!hasPassword && otherProviders.length === 0) {
    throw new ApiError(400, ErrorCode.ValidationError);
  }

  user.authProviders = user.authProviders.filter(
    (p) => p.provider !== "google",
  );
  await user.save();

  logger.info("google_unlinked", { userId });
}

// ── Token Refresh ────────────────────────────────────────────────

async function refreshAccessToken(
  currentRefreshToken: string,
): Promise<TokenPair> {
  const jwtRefreshSecret: string = process.env.JWT_REFRESH_SECRET || "";

  // Verify existing refresh token
  let payload: { userId: string };
  try {
    payload = jwt.verify(currentRefreshToken, jwtRefreshSecret) as {
      userId: string;
    };
  } catch {
    throw new ApiError(401, ErrorCode.RefreshTokenInvalid);
  }

  // Find user with matching refresh token
  const user = await UserModel.findById(payload.userId);
  if (!user || user.refreshToken !== currentRefreshToken) {
    throw new ApiError(401, ErrorCode.RefreshTokenInvalid);
  }

  // Generate new tokens
  const tokens = generateTokens(user._id.toString());

  // Update stored refresh token (rotate)
  user.refreshToken = tokens.refreshToken;
  await user.save();

  logger.info("token_refreshed", { userId: user._id });

  return tokens;
}

// ── Logout ───────────────────────────────────────────────────────

async function logout(userId: string): Promise<void> {
  await UserModel.findByIdAndUpdate(userId, {
    $unset: { refreshToken: 1 },
  });

  logger.info("user_logged_out", { userId });
}

// ── Exports ──────────────────────────────────────────────────────

export const authService = {
  register,
  login,
  refreshAccessToken,
  logout,
  generateTokens,
  sendVerificationOtp,
  verifyEmail,
  resendVerificationOtp,
  requestPasswordReset,
  verifyResetOtp,
  resetPassword,
  changePassword,
  googleAuth,
  linkGoogle,
  unlinkGoogle,
};
