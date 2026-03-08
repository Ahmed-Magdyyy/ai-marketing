// ─────────────────────────────────────────────────────────────────
// Video Generation Worker
// BullMQ worker: generates short-form video via Runway ML Gen3 API.
// MVP: Runway ML only. HeyGen (VIDEO_PRESENTER) added post-MVP.
// Checks KILL_VIDEO + KILL_CONTENT before processing.
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

// ── Runway ML Gen3 API ───────────────────────────────────────────

interface RunwayTaskResponse {
  id: string;
  status: string;
  output?: string[];
}

async function generateVideo(
  brief: string,
  model: string,
): Promise<{ videoUrl: string; durationSeconds: number }> {
  const apiKey = process.env.RUNWAYML_API_KEY;
  if (!apiKey) {
    throw new Error("RUNWAYML_API_KEY is not defined");
  }

  // Step 1: Create generation task
  const createResponse = await fetch(
    "https://api.dev.runwayml.com/v1/image_to_video",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "X-Runway-Version": "2024-11-06",
      },
      body: JSON.stringify({
        model,
        promptText: brief,
        duration: 5,
        watermark: false,
      }),
    },
  );

  if (!createResponse.ok) {
    const errorBody = await createResponse.text();
    throw new Error(
      `Runway ML create error ${createResponse.status}: ${errorBody}`,
    );
  }

  const task = (await createResponse.json()) as RunwayTaskResponse;
  const taskId = task.id;

  // Step 2: Poll for completion
  const maxAttempts = 60;
  const pollIntervalMs = 5000;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));

    const pollResponse = await fetch(
      `https://api.dev.runwayml.com/v1/tasks/${taskId}`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "X-Runway-Version": "2024-11-06",
        },
      },
    );

    if (!pollResponse.ok) {
      continue;
    }

    const pollResult = (await pollResponse.json()) as RunwayTaskResponse;

    if (pollResult.status === "SUCCEEDED" && pollResult.output?.[0]) {
      return { videoUrl: pollResult.output[0], durationSeconds: 5 };
    }

    if (pollResult.status === "FAILED") {
      throw new Error("Runway ML video generation failed");
    }
  }

  throw new Error("Runway ML video generation timed out");
}

// ── Worker ────────────────────────────────────────────────────────

function createVideoWorker(): Worker<ContentJobData> {
  const worker = new Worker<ContentJobData>(
    QueueName.VideoGeneration,
    async (job: Job<ContentJobData>) => {
      const startMs = Date.now();
      const { contentItemId, userId, brief } = job.data;

      if (
        SWITCHES.DISABLE_VIDEO_GENERATION ||
        SWITCHES.DISABLE_CONTENT_GENERATION ||
        SWITCHES.READ_ONLY_MODE
      ) {
        logger.warn("video_worker_skipped", {
          userId,
          reason: "kill_switch_active",
        });
        return;
      }

      const model = getModel(ModelRole.VideoShort);

      const result = await generateVideo(brief, model);

      await ContentItemModel.findByIdAndUpdate(contentItemId, {
        $set: { status: "draft" },
        $push: {
          assets: { type: AssetType.Video, url: result.videoUrl },
        },
      });

      await trackUnitUsage(
        userId,
        model,
        result.durationSeconds,
        "video_generation",
      );

      const latencyMs = Date.now() - startMs;
      logger.info("job_complete", {
        userId,
        jobType: "video",
        model,
        latencyMs,
      });

      try {
        const io = getIO();
        io.to(`user:${userId}`).emit("content:generated", {
          contentItemId,
          assetType: "video",
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
      concurrency: 3,
      limiter: {
        max: 10,
        duration: 60000,
      },
    },
  );

  worker.on("failed", (job: Job<ContentJobData> | undefined, err: Error) => {
    logger.error("video_worker_failed", {
      jobId: job?.id,
      contentItemId: job?.data?.contentItemId,
      error: err.message,
    });
  });

  return worker;
}

export { createVideoWorker };
