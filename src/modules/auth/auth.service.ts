// ─────────────────────────────────────────────────────────────────
// Auth Service — register, login, token refresh, logout
// ─────────────────────────────────────────────────────────────────

import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { UserModel, IUserDocument } from "./user.model";
import { ApiError } from "../../shared/utils/ApiError";
import { ErrorCode, PlanTier } from "../../shared/types";
import { getPlanLimits } from "../../shared/config/planLimits";
import { logger } from "../../shared/utils/logger";

const SALT_ROUNDS = 12;

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

  // Create user
  const user = await UserModel.create({
    email,
    passwordHash,
    name,
    phone: phone || "",
    lang: lang || "ar",
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

  logger.info("user_registered", { userId: user._id, email });

  return { user, tokens };
}

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

  // Compare password
  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    logger.warn("login_password_mismatch", { email });
    throw new ApiError(401, ErrorCode.InvalidCredentials);
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

async function logout(userId: string): Promise<void> {
  await UserModel.findByIdAndUpdate(userId, {
    $unset: { refreshToken: 1 },
  });

  logger.info("user_logged_out", { userId });
}

export const authService = {
  register,
  login,
  refreshAccessToken,
  logout,
  generateTokens,
};
