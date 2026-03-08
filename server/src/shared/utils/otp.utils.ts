// ─────────────────────────────────────────────────────────────────
// OTP Utilities — Redis-backed OTP generation, storage, verification
// Keys: otp:{userId}:{purpose}       → hashed OTP (TTL 10 min)
//        otp:resend:{userId}:{purpose} → resend count (TTL 1 hour)
// ─────────────────────────────────────────────────────────────────

import crypto from "crypto";
import { getRedisClient } from "../config/redis";
import { logger } from "./logger";

type OtpPurpose = "email_verification" | "password_reset";

const OTP_TTL_SECONDS = 600; // 10 minutes
const RESEND_TTL_SECONDS = 3600; // 1 hour
const MAX_RESEND_COUNT = 3;

// ── Generate OTP ─────────────────────────────────────────────────
// 6-digit cryptographically random string

export function generateOtp(): string {
  const buffer = crypto.randomBytes(3); // 3 bytes → 6 hex chars
  const num = parseInt(buffer.toString("hex"), 16) % 1000000;
  return num.toString().padStart(6, "0");
}

// ── Hash OTP (never store plaintext) ─────────────────────────────

function hashOtp(otp: string): string {
  return crypto.createHash("sha256").update(otp).digest("hex");
}

// ── Store OTP ────────────────────────────────────────────────────

export async function storeOtp(
  userId: string,
  otp: string,
  purpose: OtpPurpose,
): Promise<void> {
  const redis = getRedisClient();
  const key = `otp:${userId}:${purpose}`;
  const hashed = hashOtp(otp);

  await redis.setex(key, OTP_TTL_SECONDS, hashed);
  logger.info("otp_stored", { userId, purpose });
}

// ── Verify OTP ───────────────────────────────────────────────────
// Returns true if valid + deletes key. Returns false if invalid/expired.

export async function verifyOtp(
  userId: string,
  purpose: OtpPurpose,
  candidateOtp: string,
): Promise<"valid" | "invalid" | "expired"> {
  const redis = getRedisClient();
  const key = `otp:${userId}:${purpose}`;

  const stored = await redis.get(key);
  if (!stored) {
    return "expired";
  }

  const candidateHash = hashOtp(candidateOtp);
  if (stored !== candidateHash) {
    return "invalid";
  }

  // Valid — delete the key so it can't be reused
  await redis.del(key);
  logger.info("otp_verified", { userId, purpose });
  return "valid";
}

// ── Resend Count Tracking ────────────────────────────────────────
// Max 3 resends per purpose per hour

export async function getResendCount(
  userId: string,
  purpose: OtpPurpose,
): Promise<number> {
  const redis = getRedisClient();
  const key = `otp:resend:${userId}:${purpose}`;
  const count = await redis.get(key);
  return count ? parseInt(count, 10) : 0;
}

export async function incrementResendCount(
  userId: string,
  purpose: OtpPurpose,
): Promise<void> {
  const redis = getRedisClient();
  const key = `otp:resend:${userId}:${purpose}`;

  const exists = await redis.exists(key);
  if (exists) {
    await redis.incr(key);
  } else {
    await redis.setex(key, RESEND_TTL_SECONDS, "1");
  }
}

export function canResend(currentCount: number): boolean {
  return currentCount < MAX_RESEND_COUNT;
}
