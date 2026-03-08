// ─────────────────────────────────────────────────────────────────
// Content Generation Service
// Orchestrates content generation: fetches pending items, checks
// quotas, and queues BullMQ jobs for each asset type.
// Entry point: triggerContentGeneration(plan, userId)
// ─────────────────────────────────────────────────────────────────

import { Queue } from "bullmq";
import { Types } from "mongoose";
import {
  PlanTier,
  ContentStatus,
  ContentType,
  AssetType,
} from "../../shared/types";
import {
  QueueName,
  ContentJobData,
  createQueue,
  addContentJob,
} from "../../shared/config/queues";
import { checkQuota, QuotaResource } from "../../shared/config/planLimits";
import { ContentItemModel, MarketingPlan } from "../plan/plan.model";
import { BrandProfileModel } from "../brand/brand.model";
import { UserModel } from "../auth/user.model";
import { logger } from "../../shared/utils/logger";

// ── Queue instances (created once at import time) ────────────────

const captionQueue: Queue = createQueue(QueueName.CaptionGeneration);
const imageQueue: Queue = createQueue(QueueName.ImageGeneration);
const videoQueue: Queue = createQueue(QueueName.VideoGeneration);
const voiceoverQueue: Queue = createQueue(QueueName.VoiceoverGeneration);
const designQueue: Queue = createQueue(QueueName.DesignGeneration);

// ── Asset type → queue + quota resource mapping ──────────────────

interface AssetQueueMapping {
  queue: Queue;
  quotaResource: QuotaResource;
}

const ASSET_QUEUE_MAP: Record<string, AssetQueueMapping> = {
  [AssetType.Caption]: {
    queue: captionQueue,
    quotaResource: "posts",
  },
  [AssetType.Image]: {
    queue: imageQueue,
    quotaResource: "images",
  },
  [AssetType.Video]: {
    queue: videoQueue,
    quotaResource: "videos",
  },
  [AssetType.Voiceover]: {
    queue: voiceoverQueue,
    quotaResource: "voiceovers",
  },
  [AssetType.Design]: {
    queue: designQueue,
    quotaResource: "designs",
  },
};

// ── Content type → required asset types ──────────────────────────

function getRequiredAssets(contentType: string): string[] {
  switch (contentType) {
    case ContentType.Post:
      return [AssetType.Caption, AssetType.Image, AssetType.Design];
    case ContentType.Reel:
      return [
        AssetType.Caption,
        AssetType.Video,
        AssetType.Voiceover,
        AssetType.Design,
      ];
    case ContentType.Story:
      return [AssetType.Caption, AssetType.Image, AssetType.Design];
    case ContentType.Carousel:
      return [AssetType.Caption, AssetType.Image, AssetType.Design];
    case ContentType.Ad:
      return [AssetType.Caption, AssetType.Image, AssetType.Design];
    default:
      return [AssetType.Caption, AssetType.Image];
  }
}

// ── triggerContentGeneration ─────────────────────────────────────

async function triggerContentGeneration(
  plan: MarketingPlan & { _id: Types.ObjectId },
  userId: string,
): Promise<{ queued: number; skipped: number }> {
  const planId = String(plan._id);

  // 1. Fetch user for tier + quota checks
  const user = await UserModel.findById(userId).lean();
  if (!user) {
    logger.error("trigger_content_no_user", { userId, planId });
    return { queued: 0, skipped: 0 };
  }

  const tier: PlanTier = (user.plan?.tier as PlanTier) ?? PlanTier.Free;

  // 2. Fetch brand profile for brandDNA
  const brand = await BrandProfileModel.findById(plan.brandId).lean();
  if (!brand) {
    logger.error("trigger_content_no_brand", {
      brandId: String(plan.brandId),
      planId,
    });
    return { queued: 0, skipped: 0 };
  }

  // 3. Fetch all pending content items for this plan
  const pendingItems = await ContentItemModel.find({
    planId: plan._id,
    status: ContentStatus.PendingGeneration,
  }).lean();

  if (pendingItems.length === 0) {
    logger.info("trigger_content_no_pending", { planId });
    return { queued: 0, skipped: 0 };
  }

  // 4. Build brandDNA payload for job data
  const brandDNA: ContentJobData["brandDNA"] = {
    tone: brand.brandDNA?.tone ?? undefined,
    personality: brand.brandDNA?.personality ?? undefined,
    contentDialect: brand.brandDNA?.contentDialect ?? undefined,
    primaryColor: brand.brandDNA?.colors?.[0] ?? undefined,
    secondaryColor: brand.brandDNA?.colors?.[1] ?? undefined,
    fontFamily: brand.brandDNA?.fonts?.[0] ?? undefined,
  };

  let queued = 0;
  let skipped = 0;

  // 5. Queue jobs for each content item
  for (const item of pendingItems) {
    const contentItemId = String(item._id);
    const requiredAssets = getRequiredAssets(item.contentType);
    const brief =
      item.designBrief ||
      item.caption ||
      `Generate content for ${item.contentType} on ${item.platform}`;

    for (const assetType of requiredAssets) {
      const mapping = ASSET_QUEUE_MAP[assetType];
      if (!mapping) continue;

      // Check quota before queuing
      const quotaResult = checkQuota(
        { usage: user.usage, limits: user.limits },
        mapping.quotaResource,
      );

      if (!quotaResult.allowed) {
        logger.warn("trigger_content_quota_exceeded", {
          userId,
          planId,
          contentItemId,
          assetType,
          resource: mapping.quotaResource,
          used: quotaResult.used,
          limit: quotaResult.limit,
        });
        skipped++;
        continue;
      }

      const jobData: ContentJobData = {
        contentItemId,
        planId,
        userId,
        brandId: String(plan.brandId),
        brief,
        brandDNA,
      };

      await addContentJob(
        mapping.queue,
        assetType,
        contentItemId,
        jobData,
        tier,
      );
      queued++;
    }
  }

  logger.info("trigger_content_complete", {
    planId,
    userId,
    totalItems: pendingItems.length,
    queued,
    skipped,
  });

  return { queued, skipped };
}

export { triggerContentGeneration };
