// ─────────────────────────────────────────────────────────────────
// Image Generation Worker
// BullMQ worker: generates images using OpenAI gpt-image-1 API.
// Prompts in English; Arabic text overlay added post-generation.
// ─────────────────────────────────────────────────────────────────

import { Worker, Job } from "bullmq";
import { getRedisClient } from "../shared/config/redis";
import { QueueName, ContentJobData } from "../shared/config/queues";
import { getModel } from "../shared/config/models";
import { ModelRole, AssetType } from "../shared/types";
import { SWITCHES } from "../shared/middleware/killSwitch.middleware";
import { trackUnitUsage } from "../shared/utils/aiCostTracker";
import { getIO } from "../shared/utils/socketProvider";
import { ContentItemModel } from "../modules/plan/plan.model";
import { logger } from "../shared/utils/logger";

// ── OpenAI Image Generation ──────────────────────────────────────

interface OpenAIImageResponse {
  data: Array<{ url?: string; b64_json?: string }>;
}

async function generateImage(
  brief: string,
  model: string,
): Promise<{ imageUrl: string }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not defined");
  }

  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      prompt: brief,
      n: 1,
      size: "1024x1024",
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`OpenAI image API error ${response.status}: ${errorBody}`);
  }

  const result = (await response.json()) as OpenAIImageResponse;
  const imageUrl = result.data[0]?.url ?? "";

  if (!imageUrl) {
    throw new Error("OpenAI returned no image URL");
  }

  return { imageUrl };
}

// ── Worker ────────────────────────────────────────────────────────

function createImageWorker(): Worker<ContentJobData> {
  const worker = new Worker<ContentJobData>(
    QueueName.ImageGeneration,
    async (job: Job<ContentJobData>) => {
      const startMs = Date.now();
      const { contentItemId, userId, brief } = job.data;

      if (SWITCHES.DISABLE_CONTENT_GENERATION || SWITCHES.READ_ONLY_MODE) {
        logger.warn("image_worker_skipped", {
          userId,
          reason: "kill_switch_active",
        });
        return;
      }

      const model = getModel(ModelRole.ImagePrimary);

      const result = await generateImage(brief, model);

      await ContentItemModel.findByIdAndUpdate(contentItemId, {
        $set: { status: "draft" },
        $push: {
          assets: { type: AssetType.Image, url: result.imageUrl },
        },
      });

      await trackUnitUsage(userId, model, 1, "image_generation");

      const latencyMs = Date.now() - startMs;
      logger.info("job_complete", {
        userId,
        jobType: "image",
        model,
        latencyMs,
      });

      try {
        const io = getIO();
        io.to(`user:${userId}`).emit("content:generated", {
          contentItemId,
          assetType: "image",
          status: "draft",
        });
      } catch {
        logger.warn("socket_emit_failed", {
          userId,
          contentItemId,
          event: "content:generated",
        });
      }
    },
    {
      connection: getRedisClient(),
      concurrency: 5,
      limiter: {
        max: 20,
        duration: 60000,
      },
    },
  );

  worker.on("failed", (job: Job<ContentJobData> | undefined, err: Error) => {
    logger.error("image_worker_failed", {
      jobId: job?.id,
      contentItemId: job?.data?.contentItemId,
      error: err.message,
    });
  });

  return worker;
}

export { createImageWorker };
