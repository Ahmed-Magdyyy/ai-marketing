// ─────────────────────────────────────────────────────────────────
// Analytics Service — aggregation queries for platform metrics
// All functions are admin-only, called from analytics.controller.ts.
// ─────────────────────────────────────────────────────────────────

import { UserModel } from "../auth/user.model";
import {
  MarketingPlanModel,
  ContentItemModel,
} from "../plan/plan.model";
import { AiUsageLog } from "../../shared/models/AiUsageLog.model";
import { logger } from "../../shared/utils/logger";

// ── Types ────────────────────────────────────────────────────────

interface PlatformStats {
  totalUsers: number;
  activeUsers: number;
  suspendedUsers: number;
  totalPlans: number;
  totalContentItems: number;
  totalAiCostUSD: number;
}

interface GrowthDataPoint {
  date: string; // YYYY-MM-DD
  count: number;
}

interface ContentMetrics {
  totalItems: number;
  byStatus: Record<string, number>;
  byPlatform: Record<string, number>;
  byContentType: Record<string, number>;
}

interface AIUsageMetrics {
  totalCostUSD: number;
  totalCalls: number;
  byModel: { model: string; calls: number; costUSD: number }[];
  byContext: { context: string; calls: number; costUSD: number }[];
}

interface RevenueMetrics {
  totalUsers: number;
  byPlanTier: { tier: string; count: number }[];
  byBillingCycle: { cycle: string; count: number }[];
}

// ── getPlatformStats ─────────────────────────────────────────────

async function getPlatformStats(): Promise<PlatformStats> {
  logger.info("analytics_platform_stats_query");

  const [userStats, totalPlans, totalContentItems, costAgg] =
    await Promise.all([
      UserModel.aggregate([
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            active: {
              $sum: { $cond: [{ $eq: ["$status", "active"] }, 1, 0] },
            },
            suspended: {
              $sum: { $cond: [{ $eq: ["$status", "suspended"] }, 1, 0] },
            },
          },
        },
      ]),
      MarketingPlanModel.countDocuments(),
      ContentItemModel.countDocuments(),
      AiUsageLog.aggregate([
        { $group: { _id: null, total: { $sum: "$estimatedCostUSD" } } },
      ]),
    ]);

  const stats = userStats[0] || { total: 0, active: 0, suspended: 0 };
  const cost = costAgg[0]?.total || 0;

  return {
    totalUsers: stats.total,
    activeUsers: stats.active,
    suspendedUsers: stats.suspended,
    totalPlans,
    totalContentItems,
    totalAiCostUSD: Math.round(cost * 100) / 100,
  };
}

// ── getUserGrowthData ────────────────────────────────────────────
// Returns daily new sign-ups for the last 30 days.

async function getUserGrowthData(
  days: number = 30,
): Promise<GrowthDataPoint[]> {
  logger.info("analytics_user_growth_query", { days });

  const since = new Date();
  since.setDate(since.getDate() - days);

  const results = await UserModel.aggregate([
    { $match: { createdAt: { $gte: since } } },
    {
      $group: {
        _id: {
          $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
        },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
    { $project: { _id: 0, date: "$_id", count: 1 } },
  ]);

  return results as GrowthDataPoint[];
}

// ── getContentMetrics ────────────────────────────────────────────

async function getContentMetrics(): Promise<ContentMetrics> {
  logger.info("analytics_content_metrics_query");

  const [totalItems, byStatus, byPlatform, byContentType] = await Promise.all([
    ContentItemModel.countDocuments(),
    ContentItemModel.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
    ContentItemModel.aggregate([
      { $group: { _id: "$platform", count: { $sum: 1 } } },
    ]),
    ContentItemModel.aggregate([
      { $group: { _id: "$contentType", count: { $sum: 1 } } },
    ]),
  ]);

  const toRecord = (
    arr: { _id: string; count: number }[],
  ): Record<string, number> =>
    Object.fromEntries(arr.map((r) => [r._id, r.count]));

  return {
    totalItems,
    byStatus: toRecord(byStatus),
    byPlatform: toRecord(byPlatform),
    byContentType: toRecord(byContentType),
  };
}

// ── getAIUsageMetrics ────────────────────────────────────────────
// Aggregated AI spend for the last N days.

async function getAIUsageMetrics(days: number = 30): Promise<AIUsageMetrics> {
  logger.info("analytics_ai_usage_query", { days });

  const since = new Date();
  since.setDate(since.getDate() - days);

  const [totalAgg, byModel, byContext] = await Promise.all([
    AiUsageLog.aggregate([
      { $match: { timestamp: { $gte: since } } },
      {
        $group: {
          _id: null,
          totalCost: { $sum: "$estimatedCostUSD" },
          totalCalls: { $sum: 1 },
        },
      },
    ]),
    AiUsageLog.aggregate([
      { $match: { timestamp: { $gte: since } } },
      {
        $group: {
          _id: "$model",
          calls: { $sum: 1 },
          costUSD: { $sum: "$estimatedCostUSD" },
        },
      },
      { $sort: { costUSD: -1 } },
    ]),
    AiUsageLog.aggregate([
      { $match: { timestamp: { $gte: since } } },
      {
        $group: {
          _id: "$context",
          calls: { $sum: 1 },
          costUSD: { $sum: "$estimatedCostUSD" },
        },
      },
      { $sort: { costUSD: -1 } },
    ]),
  ]);

  const totals = totalAgg[0] || { totalCost: 0, totalCalls: 0 };

  return {
    totalCostUSD: Math.round(totals.totalCost * 100) / 100,
    totalCalls: totals.totalCalls,
    byModel: byModel.map((r) => ({
      model: r._id as string,
      calls: r.calls as number,
      costUSD: Math.round((r.costUSD as number) * 100) / 100,
    })),
    byContext: byContext.map((r) => ({
      context: r._id as string,
      calls: r.calls as number,
      costUSD: Math.round((r.costUSD as number) * 100) / 100,
    })),
  };
}

// ── getRevenueMetrics ────────────────────────────────────────────
// Breakdown of users by plan tier and billing cycle.

async function getRevenueMetrics(): Promise<RevenueMetrics> {
  logger.info("analytics_revenue_metrics_query");

  const [totalUsers, byPlanTier, byBillingCycle] = await Promise.all([
    UserModel.countDocuments(),
    UserModel.aggregate([
      { $group: { _id: "$plan.tier", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    UserModel.aggregate([
      { $group: { _id: "$plan.billingCycle", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
  ]);

  return {
    totalUsers,
    byPlanTier: byPlanTier.map((r) => ({
      tier: (r._id as string) || "none",
      count: r.count as number,
    })),
    byBillingCycle: byBillingCycle.map((r) => ({
      cycle: (r._id as string) || "none",
      count: r.count as number,
    })),
  };
}

export {
  getPlatformStats,
  getUserGrowthData,
  getContentMetrics,
  getAIUsageMetrics,
  getRevenueMetrics,
  PlatformStats,
  GrowthDataPoint,
  ContentMetrics,
  AIUsageMetrics,
  RevenueMetrics,
};
