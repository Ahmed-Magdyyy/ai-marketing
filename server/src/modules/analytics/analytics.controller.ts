// ─────────────────────────────────────────────────────────────────
// Analytics Controller — admin-only analytics endpoints
// ─────────────────────────────────────────────────────────────────

import { Request, Response } from "express";
import { asyncHandler } from "../../shared/utils/asyncHandler";
import { SuccessCode } from "../../shared/types";
import { sendSuccess } from "../../shared/utils/apiResponse";
import {
  getPlatformStats,
  getUserGrowthData,
  getContentMetrics,
  getAIUsageMetrics,
  getRevenueMetrics,
} from "./analytics.service";

// ── GET /api/analytics/platform ─────────────────────────────────

export const platformStatsHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const stats = await getPlatformStats();
    return sendSuccess(res, stats, 200, SuccessCode.AnalyticsRetrieved, req);
  },
);

// ── GET /api/analytics/users/growth ─────────────────────────────

export const userGrowthHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const days = Math.min(
      365,
      Math.max(1, parseInt(String(req.query.days ?? "30"), 10)),
    );
    const data = await getUserGrowthData(days);
    return sendSuccess(res, { days, data }, 200, SuccessCode.AnalyticsRetrieved, req);
  },
);

// ── GET /api/analytics/content ──────────────────────────────────

export const contentMetricsHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const metrics = await getContentMetrics();
    return sendSuccess(res, metrics, 200, SuccessCode.AnalyticsRetrieved, req);
  },
);

// ── GET /api/analytics/ai-usage ─────────────────────────────────

export const aiUsageHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const days = Math.min(
      365,
      Math.max(1, parseInt(String(req.query.days ?? "30"), 10)),
    );
    const metrics = await getAIUsageMetrics(days);
    return sendSuccess(res, metrics, 200, SuccessCode.AnalyticsRetrieved, req);
  },
);

// ── GET /api/analytics/revenue ──────────────────────────────────

export const revenueMetricsHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const metrics = await getRevenueMetrics();
    return sendSuccess(res, metrics, 200, SuccessCode.AnalyticsRetrieved, req);
  },
);
