// ─────────────────────────────────────────────────────────────────
// Workers Entry Point
// Starts all BullMQ workers in a separate process.
// Run with: npm run start:workers
// ─────────────────────────────────────────────────────────────────

import dotenv from "dotenv";
dotenv.config();

import { validateEnv } from "./shared/config/env";
import { connectDB } from "./shared/config/db";
import { logger } from "./shared/utils/logger";
import { getRedisClient } from "./shared/config/redis";

import { createCaptionWorker } from "./workers/caption.worker";
import { createImageWorker } from "./workers/image.worker";
import { createVideoWorker } from "./workers/video.worker";
import { createVoiceoverWorker } from "./workers/voiceover.worker";
import { createDesignWorker } from "./workers/design.worker";
import { createSocialPublishWorker } from "./workers/social-publish.worker";

// Validate environment variables
validateEnv();

async function startWorkers() {
  try {
    // 1. Connect to MongoDB (needed for updating ContentItem status)
    await connectDB();
    logger.info("MongoDB connected for workers");

    // 2. Instantiate all workers
    const captionWorker = createCaptionWorker();
    const imageWorker = createImageWorker();
    const videoWorker = createVideoWorker();
    const voiceoverWorker = createVoiceoverWorker();
    const designWorker = createDesignWorker();
    const socialPublishWorker = createSocialPublishWorker();

    logger.info("All BullMQ workers started successfully");

    // 3. Graceful shutdown handler
    const gracefulShutdown = async (signal: string) => {
      logger.info(`Received ${signal}, shutting down workers...`);

      try {
        await Promise.all([
          captionWorker.close(),
          imageWorker.close(),
          videoWorker.close(),
          voiceoverWorker.close(),
          designWorker.close(),
          socialPublishWorker.close(),
        ]);
        logger.info("All workers closed");

        const redisClient = getRedisClient();
        await redisClient.quit();
        logger.info("Redis connection closed");

        process.exit(0);
      } catch (err) {
        logger.error("Error during shutdown", { error: err });
        process.exit(1);
      }
    };

    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
    process.on("SIGINT", () => gracefulShutdown("SIGINT"));
  } catch (err) {
    logger.error("Failed to start workers", { error: err });
    process.exit(1);
  }
}

startWorkers();
