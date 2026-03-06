// ─────────────────────────────────────────────────────────────────
// Memory Prune Worker
// BullMQ repeatable job: runs daily at 03:00 (cron: 0 3 * * *).
// For every user with stored memories, prunes entries older than
// the user's agentMemoryMonths limit from both Qdrant and MongoDB.
//
// Registered in workers.ts alongside other BullMQ workers.
// ─────────────────────────────────────────────────────────────────

import { Worker, Queue, Job } from "bullmq";
import { getRedisClient } from "../shared/config/redis";
import { QueueName } from "../shared/config/queues";
import { pruneOldMemories } from "../modules/agent/agent.memory";
import { AgentLearningModel } from "../modules/agent/agentLearning.model";
import { logger } from "../shared/utils/logger";
import mongoose from "mongoose";

// ── Job Data ─────────────────────────────────────────────────────
// The repeatable job uses a minimal payload (no per-user data).
// The worker discovers all users with memories and prunes each.

interface MemoryPruneJobData {
  triggeredAt: string; // ISO timestamp
}

// ── User Model Reference ─────────────────────────────────────────
// Read agentMemoryMonths from the User document directly.
// Using mongoose.connection.collection to avoid circular imports
// with the auth module.

async function getUserMemoryMonths(userId: string): Promise<number> {
  const userDoc = await mongoose.connection
    .collection("users")
    .findOne(
      { _id: new mongoose.Types.ObjectId(userId) },
      { projection: { agentMemoryMonths: 1 } },
    );

  return (userDoc?.agentMemoryMonths as number) ?? 1; // Default: Free tier (1 month)
}

// ── Worker Factory ───────────────────────────────────────────────

function createMemoryPruneWorker(): Worker<MemoryPruneJobData> {
  // Create the queue and add the repeatable job
  const memoryPruneQueue = new Queue<MemoryPruneJobData>(
    QueueName.MemoryPrune,
    { connection: getRedisClient() },
  );

  // Register repeatable job — daily at 03:00 AM
  // BullMQ handles dedup: calling add() with the same repeat config
  // is idempotent and won't create duplicates.
  void memoryPruneQueue.add(
    "prune-old-memories",
    { triggeredAt: new Date().toISOString() },
    {
      repeat: { pattern: "0 3 * * *" },
      removeOnComplete: { count: 5 },
      removeOnFail: { count: 10 },
    },
  );

  const worker = new Worker<MemoryPruneJobData>(
    QueueName.MemoryPrune,
    async (job: Job<MemoryPruneJobData>) => {
      const startMs = Date.now();

      logger.info("memory_prune_job_start", {
        jobId: job.id,
        triggeredAt: job.data.triggeredAt,
      });

      // 1. Find all unique userIds that have stored memories
      const userIds: string[] = await AgentLearningModel.distinct("userId");

      if (userIds.length === 0) {
        logger.info("memory_prune_no_users", { jobId: job.id });
        return;
      }

      let totalPruned = 0;

      // 2. Prune each user's expired memories
      for (const userId of userIds) {
        try {
          const memoryMonths = await getUserMemoryMonths(userId);
          const pruned = await pruneOldMemories(userId, memoryMonths);
          totalPruned += pruned;

          if (pruned > 0) {
            logger.info("memory_prune_user_complete", {
              userId,
              memoryMonths,
              pruned,
            });
          }
        } catch (error: unknown) {
          const message =
            error instanceof Error ? error.message : "Unknown error";
          logger.error("memory_prune_user_failed", {
            userId,
            error: message,
          });
          // Continue to next user — don't fail the whole job
        }
      }

      const latencyMs = Date.now() - startMs;
      logger.info("memory_prune_job_complete", {
        jobId: job.id,
        totalUsers: userIds.length,
        totalPruned,
        latencyMs,
      });
    },
    {
      connection: getRedisClient(),
      concurrency: 1, // Only one prune job at a time
    },
  );

  worker.on(
    "failed",
    (job: Job<MemoryPruneJobData> | undefined, err: Error) => {
      logger.error("memory_prune_worker_failed", {
        jobId: job?.id,
        error: err.message,
      });
    },
  );

  return worker;
}

export { createMemoryPruneWorker, MemoryPruneJobData };
