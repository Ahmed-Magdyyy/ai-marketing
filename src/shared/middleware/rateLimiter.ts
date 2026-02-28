// ─────────────────────────────────────────────────────────────────
// Rate Limiters — all rate limits defined here, never inline in routes.
// Uses Redis store via rate-limit-redis for distributed limiting.
// ─────────────────────────────────────────────────────────────────

import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { RedisStore, SendCommandFn } from "rate-limit-redis";
import { getRedisClient } from "../config/redis";
import type { IUserDocument } from "../../modules/auth/user.model";

const redis = getRedisClient();

// ioredis `call()` returns Promise<unknown>; rate-limit-redis expects Promise<RedisReply>.
// The underlying data is always string/number/boolean or arrays of those — safe cast.
const sendCommand: SendCommandFn = (...args: string[]) =>
  redis.call(args[0], ...args.slice(1)) as ReturnType<SendCommandFn>;

const isTest = process.env.NODE_ENV === "test";

// ── Auth routes — prevent brute force ─────────────────────────────
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per IP
  store: isTest ? undefined : new RedisStore({ sendCommand }),
  message: {
    success: false,
    message: "محاولات كثيرة جداً. انتظر ١٥ دقيقة وحاول تاني.",
    data: null,
  },
});

// ── Agent chat — per-user Opus rate limit ─────────────────────────
export const agentChatLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // 20 agent messages per user per minute
  keyGenerator: (req) => {
    const user = req.user as IUserDocument | undefined;
    return user?._id?.toString() ?? ipKeyGenerator(req.ip!);
  },
  store: isTest ? undefined : new RedisStore({ sendCommand }),
  message: {
    success: false,
    message: "بعت رسايل كتير أوي. حاول تانى بعد شوية.",
    data: null,
  },
});

// ── Content generation — per-user burst protection ────────────────
export const contentGenerationLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 generation requests per user per minute
  keyGenerator: (req) => {
    const user = req.user as IUserDocument | undefined;
    return user?._id?.toString() ?? ipKeyGenerator(req.ip!);
  },
  store: isTest ? undefined : new RedisStore({ sendCommand }),
  message: {
    success: false,
    message: "طلبات توليد محتوى كتير في وقت قصير. انتظر دقيقة.",
    data: null,
  },
});

// ── API general — per-IP flood protection ─────────────────────────
export const globalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 200, // 200 requests per IP per minute (general)
  store: isTest ? undefined : new RedisStore({ sendCommand }),
  message: {
    success: false,
    message: "طلبات كتير جداً. حاول بعد شوية.",
    data: null,
  },
});

// ── File upload — prevent upload flooding ─────────────────────────
// 10 uploads per user per hour. Covers PDFs, Word, Excel, images.
// Applied to POST /api/upload — built in Phase 3 alongside agent chat.
export const fileUploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 uploads per user per hour
  keyGenerator: (req) => {
    const user = req.user as IUserDocument | undefined;
    return user?._id?.toString() ?? ipKeyGenerator(req.ip!);
  },
  store: isTest ? undefined : new RedisStore({ sendCommand }),
  message: {
    success: false,
    message: "رفعت ملفات كتير. حاول تاني بعد ساعة.",
    data: null,
  },
});
