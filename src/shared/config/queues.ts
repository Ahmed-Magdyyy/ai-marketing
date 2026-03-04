// ─────────────────────────────────────────────────────────────────
// BullMQ Queue Configuration
// Single source of truth for all content generation queues.
// Workers import QueueName + createQueue. Services import addContentJob.
// ─────────────────────────────────────────────────────────────────

import { Queue } from "bullmq";
import { PlanTier } from "../types";
import { getRedisClient } from "./redis";

// ── Queue Names ──────────────────────────────────────────────────

enum QueueName {
  CaptionGeneration = "caption-generation",
  ImageGeneration = "image-generation",
  VideoGeneration = "video-generation",
  VoiceoverGeneration = "voiceover-generation",
  DesignGeneration = "design-generation",
}

// ── Plan Priority ────────────────────────────────────────────────
// Lower number = higher priority in BullMQ.
// Free jobs are lowest priority — never block paid users.

const PLAN_PRIORITY: Record<PlanTier, number> = {
  [PlanTier.Custom]: 1,
  [PlanTier.Agency]: 1,
  [PlanTier.Growth]: 2,
  [PlanTier.Starter]: 3,
  [PlanTier.Free]: 4,
};

// ── Queue Factory ────────────────────────────────────────────────

function createQueue(name: QueueName): Queue {
  return new Queue(name, {
    connection: getRedisClient(),
  });
}

// ── Content Job Data ─────────────────────────────────────────────

interface ContentJobData {
  contentItemId: string;
  planId: string;
  userId: string;
  brandId: string;
  brief: string;
  brandDNA: {
    tone?: string;
    personality?: string;
    contentDialect?: string;
    primaryColor?: string;
    secondaryColor?: string;
    logoUrl?: string;
    fontFamily?: string;
  };
}

// ── Add Content Job ──────────────────────────────────────────────
// Wraps queue.add() with idempotency key and plan-based priority.

async function addContentJob(
  queue: Queue,
  assetType: string,
  contentItemId: string,
  data: ContentJobData,
  tier: PlanTier,
): Promise<void> {
  await queue.add(`generate-${assetType}`, data, {
    jobId: `${assetType}:${contentItemId}`,
    priority: PLAN_PRIORITY[tier],
  });
}

export { QueueName, ContentJobData, PLAN_PRIORITY, createQueue, addContentJob };
