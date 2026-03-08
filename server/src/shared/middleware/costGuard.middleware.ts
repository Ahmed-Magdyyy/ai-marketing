// ─────────────────────────────────────────────────────────────────
// Cost Guard Middleware — Phase 9: Billing & Subscriptions
// Enforces monthly AI cost caps per plan tier.
// If a user's estimated monthly AI spend exceeds their plan's cap,
// block further content generation with 429 + ErrorCode.CostCapReached.
// Custom plans (null cap) are not auto-capped — monitored manually.
// ─────────────────────────────────────────────────────────────────

import { Request, Response, NextFunction } from "express";
import { ErrorCode } from "../types";
import { sendError } from "../utils/apiResponse";
import { MONTHLY_COST_CAPS_USD } from "../config/planLimits";
import { AiUsageLog } from "../models/AiUsageLog.model";
import { logger } from "../utils/logger";
import type { PlanTier } from "../types";

// ── costGuard ────────────────────────────────────────────────────
// Apply to all content generation and agent chat routes.
// Aggregates AiUsageLog for the current month, checks against cap.
// Usage: router.post('/generate', costGuard, handler)

async function costGuard(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const user = req.user;
  if (!user) {
    sendError(res, 401, ErrorCode.Unauthorized, req);
    return;
  }

  const tier = user.plan.tier as PlanTier;
  const cap = MONTHLY_COST_CAPS_USD[tier];

  // Custom plan — no auto cap, monitored manually
  if (cap === null) {
    next();
    return;
  }

  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const result = await AiUsageLog.aggregate<{ _id: null; total: number }>([
      {
        $match: {
          userId: user._id.toString(),
          timestamp: { $gte: startOfMonth },
        },
      },
      { $group: { _id: null, total: { $sum: "$estimatedCostUSD" } } },
    ]);

    const spent = result[0]?.total ?? 0;

    if (spent >= cap) {
      logger.warn("cost_cap_reached", {
        userId: user._id.toString(),
        tier,
        spentUSD: spent,
        capUSD: cap,
      });

      sendError(res, 429, ErrorCode.CostCapReached, req, {
        spentUSD: parseFloat(spent.toFixed(4)),
        capUSD: cap,
        upgradeUrl: `${process.env.FRONTEND_URL || ""}/billing/upgrade`,
      });
      return;
    }

    next();
  } catch (err) {
    // Cost guard failure should not block requests — log and pass through
    logger.error("cost_guard_error", {
      userId: user._id.toString(),
      error: err instanceof Error ? err.message : String(err),
    });
    next();
  }
}

export { costGuard };
