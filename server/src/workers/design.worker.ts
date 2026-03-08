// ─────────────────────────────────────────────────────────────────
// Design Generation Worker
// BullMQ worker: generates social media designs via IDesignRenderer
// abstraction (MVP: Canva). Never references a provider directly.
// ─────────────────────────────────────────────────────────────────

import { Worker, Job } from "bullmq";
import { getRedisClient } from "../shared/config/redis";
import { QueueName, ContentJobData } from "../shared/config/queues";
import { AssetType } from "../shared/types";
import { SWITCHES } from "../shared/middleware/killSwitch.middleware";
import { trackUnitUsage } from "../shared/utils/aiCostTracker";
import { getIO } from "../shared/utils/socketProvider";
import { ContentItemModel } from "../modules/plan/plan.model";
import { logger } from "../shared/utils/logger";
import {
  IDesignRenderer,
  DesignBrandAssets,
} from "./renderers/renderer.interface";
import { CanvaRenderer } from "./renderers/canva.renderer";

// ── Renderer instance ────────────────────────────────────────────
// Swap this line to switch design providers:
const renderer: IDesignRenderer = new CanvaRenderer();

// ── Worker ────────────────────────────────────────────────────────

function createDesignWorker(): Worker<ContentJobData> {
  const worker = new Worker<ContentJobData>(
    QueueName.DesignGeneration,
    async (job: Job<ContentJobData>) => {
      const startMs = Date.now();
      const { contentItemId, userId, brief, brandDNA } = job.data;

      if (SWITCHES.DISABLE_CONTENT_GENERATION || SWITCHES.READ_ONLY_MODE) {
        logger.warn("design_worker_skipped", {
          userId,
          reason: "kill_switch_active",
        });
        return;
      }

      const brandAssets: DesignBrandAssets = {
        primaryColor: brandDNA.primaryColor,
        secondaryColor: brandDNA.secondaryColor,
        logoUrl: brandDNA.logoUrl,
        fontFamily: brandDNA.fontFamily,
      };

      const result = await renderer.render(brief, brandAssets);

      await ContentItemModel.findByIdAndUpdate(contentItemId, {
        $set: { status: "draft" },
        $push: {
          assets: { type: AssetType.Design, url: result.url },
        },
      });

      await trackUnitUsage(
        userId,
        renderer.providerName,
        1,
        "design_generation",
      );

      const latencyMs = Date.now() - startMs;
      logger.info("job_complete", {
        userId,
        jobType: "design",
        provider: renderer.providerName,
        latencyMs,
      });

      try {
        const io = getIO();
        io.to(`user:${userId}`).emit("content:generated", {
          contentItemId,
          assetType: "design",
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
        max: 30,
        duration: 60000,
      },
    },
  );

  worker.on("failed", (job: Job<ContentJobData> | undefined, err: Error) => {
    logger.error("design_worker_failed", {
      jobId: job?.id,
      contentItemId: job?.data?.contentItemId,
      error: err.message,
    });
  });

  return worker;
}

export { createDesignWorker };
