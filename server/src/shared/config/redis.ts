import Redis from "ioredis";
import { logger } from "../utils/logger";

let redisClient: Redis | null = null;

function getRedisClient(): Redis {
  if (redisClient) {
    return redisClient;
  }

  const redisUrl: string = process.env.REDIS_URL || "";

  if (!redisUrl) {
    throw new Error("REDIS_URL is not defined in environment variables");
  }

  redisClient = new Redis(redisUrl, {
    maxRetriesPerRequest: null, // Required by BullMQ — disables per-request retry limit
    enableReadyCheck: true,
    retryStrategy(times: number): number | null {
      if (times > 10) {
        logger.error("Redis connection failed after 10 retries");
        return null; // Stop retrying
      }
      return Math.min(times * 200, 5000); // Exponential backoff, max 5s
    },
  });

  redisClient.on("connect", () => {
    logger.info("Redis connected successfully");
  });

  redisClient.on("error", (error: Error) => {
    logger.error(`Redis error: ${error.message}`);
  });

  return redisClient;
}

async function pingRedis(): Promise<boolean> {
  try {
    const client = getRedisClient();
    const result = await client.ping();
    return result === "PONG";
  } catch {
    return false;
  }
}

async function closeRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
}

export { getRedisClient, pingRedis, closeRedis };
