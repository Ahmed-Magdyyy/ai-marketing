// ─────────────────────────────────────────────────────────────────
// Plan Limits — SINGLE SOURCE OF TRUTH for all plan tiers.
// Never hardcode limits in routes, controllers, or workers.
// When a plan changes, update it here only.
// ─────────────────────────────────────────────────────────────────

import { PlanTier, UserLimits, UserUsage } from "../types";

// ── Plan Limits Interface ─────────────────────────────────────────

interface PlanLimits extends UserLimits {
  priceMonthly: number | null;
  priceAnnual: number | null;
  maxConcurrentJobs: number;
  maxCrawlPagesPerRun: number;
  maxCrawlMinutesPerRun: number;
}

interface QuotaCheckResult {
  allowed: boolean;
  used: number;
  limit: number | null;
}

// ── Safe Limits for Custom Tier ───────────────────────────────────
// "Unlimited" custom plans still have code-enforced ceilings.
const MAX_SAFE_LIMIT = {
  brandsAllowed: 50,
  postsPerMonth: 500,
  imagesPerMonth: 500,
  videosPerMonth: 100,
  voiceoversPerMonth: 100,
  designsPerMonth: 500,
  competitorResearchPerMonth: 200,
} as const;

// ── Plan Definitions ──────────────────────────────────────────────

const PLAN_LIMITS: Record<PlanTier, PlanLimits> = {
  [PlanTier.Free]: {
    priceMonthly: 0,
    priceAnnual: 0,
    brandsAllowed: 1,
    postsPerMonth: 2,
    imagesPerMonth: 2,
    videosPerMonth: 0,
    voiceoversPerMonth: 0,
    designsPerMonth: 2,
    competitorResearchPerMonth: 0,
    platforms: ["facebook"],
    agentMemoryMonths: 1,
    prioritySupport: false,
    maxConcurrentJobs: 1,
    maxCrawlPagesPerRun: 0,
    maxCrawlMinutesPerRun: 0,
  },

  [PlanTier.Starter]: {
    priceMonthly: 299,
    priceAnnual: 2990,
    brandsAllowed: 1,
    postsPerMonth: 12,
    imagesPerMonth: 12,
    videosPerMonth: 0,
    voiceoversPerMonth: 0,
    designsPerMonth: 12,
    competitorResearchPerMonth: 2,
    platforms: ["facebook", "instagram"],
    agentMemoryMonths: 3,
    prioritySupport: false,
    maxConcurrentJobs: 2,
    maxCrawlPagesPerRun: 20,
    maxCrawlMinutesPerRun: 5,
  },

  [PlanTier.Growth]: {
    priceMonthly: 699,
    priceAnnual: 6990,
    brandsAllowed: 2,
    postsPerMonth: 40,
    imagesPerMonth: 40,
    videosPerMonth: 8,
    voiceoversPerMonth: 8,
    designsPerMonth: 40,
    competitorResearchPerMonth: 10,
    platforms: ["facebook", "instagram", "tiktok", "twitter"],
    agentMemoryMonths: 12,
    prioritySupport: false,
    maxConcurrentJobs: 5,
    maxCrawlPagesPerRun: 50,
    maxCrawlMinutesPerRun: 10,
  },

  [PlanTier.Agency]: {
    priceMonthly: 1499,
    priceAnnual: 14990,
    brandsAllowed: 10,
    postsPerMonth: 120,
    imagesPerMonth: 120,
    videosPerMonth: 30,
    voiceoversPerMonth: 30,
    designsPerMonth: 120,
    competitorResearchPerMonth: 50,
    platforms: ["facebook", "instagram", "tiktok", "twitter", "youtube"],
    agentMemoryMonths: 24,
    prioritySupport: true,
    maxConcurrentJobs: 15,
    maxCrawlPagesPerRun: 100,
    maxCrawlMinutesPerRun: 15,
  },

  [PlanTier.Custom]: {
    priceMonthly: null,
    priceAnnual: null,
    brandsAllowed: MAX_SAFE_LIMIT.brandsAllowed,
    postsPerMonth: MAX_SAFE_LIMIT.postsPerMonth,
    imagesPerMonth: MAX_SAFE_LIMIT.imagesPerMonth,
    videosPerMonth: MAX_SAFE_LIMIT.videosPerMonth,
    voiceoversPerMonth: MAX_SAFE_LIMIT.voiceoversPerMonth,
    designsPerMonth: MAX_SAFE_LIMIT.designsPerMonth,
    competitorResearchPerMonth: MAX_SAFE_LIMIT.competitorResearchPerMonth,
    platforms: ["facebook", "instagram", "tiktok", "twitter", "youtube"],
    agentMemoryMonths: 36,
    prioritySupport: true,
    maxConcurrentJobs: 30,
    maxCrawlPagesPerRun: 200,
    maxCrawlMinutesPerRun: 20,
  },
};

// ── Monthly AI Cost Caps (USD) — enforced by aiCostTracker ───────

const MONTHLY_COST_CAPS_USD: Record<PlanTier, number | null> = {
  [PlanTier.Free]: 0.1,
  [PlanTier.Starter]: 2,
  [PlanTier.Growth]: 8,
  [PlanTier.Agency]: 25,
  [PlanTier.Custom]: null, // no cap — monitored manually
};

// ── Accessors ─────────────────────────────────────────────────────

function getPlanLimits(tier: PlanTier): PlanLimits {
  const limits: PlanLimits | undefined = PLAN_LIMITS[tier];
  if (!limits) {
    throw new Error(`Unknown plan tier: ${tier}`);
  }
  return limits;
}

type QuotaResource =
  | "posts"
  | "images"
  | "videos"
  | "voiceovers"
  | "designs"
  | "competitorResearch";

function checkQuota(
  user: { usage: UserUsage; limits: UserLimits },
  resource: QuotaResource,
): QuotaCheckResult {
  const resourceMap: Record<
    QuotaResource,
    { used: number; limit: number | null }
  > = {
    posts: {
      used: user.usage.postsGenerated,
      limit: user.limits.postsPerMonth,
    },
    images: {
      used: user.usage.imagesGenerated,
      limit: user.limits.imagesPerMonth,
    },
    videos: {
      used: user.usage.videosGenerated,
      limit: user.limits.videosPerMonth,
    },
    voiceovers: {
      used: user.usage.voiceoversGenerated,
      limit: user.limits.voiceoversPerMonth,
    },
    designs: {
      used: user.usage.designsGenerated,
      limit: user.limits.designsPerMonth,
    },
    competitorResearch: {
      used: user.usage.competitorResearchRuns,
      limit: user.limits.competitorResearchPerMonth,
    },
  };

  const { used, limit } = resourceMap[resource];

  // null = unlimited (custom plan) — never block
  if (limit === null) {
    return { allowed: true, used, limit: null };
  }

  return { allowed: used < limit, used, limit };
}

export {
  PlanLimits,
  QuotaCheckResult,
  QuotaResource,
  PLAN_LIMITS,
  MONTHLY_COST_CAPS_USD,
  MAX_SAFE_LIMIT,
  getPlanLimits,
  checkQuota,
};
