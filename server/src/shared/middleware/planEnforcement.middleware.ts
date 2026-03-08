// ─────────────────────────────────────────────────────────────────
// Plan Enforcement Middleware — Phase 9: Billing & Subscriptions
// enforceQuota(resource)  → 403 if user exceeds plan quota
// enforceSubscription()   → 402 if subscription expired/cancelled
// ─────────────────────────────────────────────────────────────────

import { Request, Response, NextFunction } from "express";
import { ErrorCode, PlanStatus } from "../types";
import { sendError } from "../utils/apiResponse";
import { checkQuota, QuotaResource } from "../config/planLimits";
import { logger } from "../utils/logger";

// ── enforceQuota ─────────────────────────────────────────────────
// Middleware factory: checks user.usage vs user.limits for a resource.
// Returns 403 + ErrorCode.QuotaExceeded if usage >= limit.
// Usage: router.post('/generate', enforceQuota('posts'), handler)

function enforceQuota(
  resource: QuotaResource,
): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = req.user;
    if (!user) {
      sendError(res, 401, ErrorCode.Unauthorized, req);
      return;
    }

    const result = checkQuota(
      { usage: user.usage, limits: user.limits },
      resource,
    );

    if (!result.allowed) {
      logger.warn("quota_exceeded", {
        userId: user._id.toString(),
        resource,
        used: result.used,
        limit: result.limit,
      });

      sendError(res, 403, ErrorCode.QuotaExceeded, req, {
        resource,
        used: result.used,
        limit: result.limit,
        upgradeUrl: `${process.env.FRONTEND_URL || ""}/billing/upgrade`,
      });
      return;
    }

    next();
  };
}

// ── enforceSubscription ──────────────────────────────────────────
// Checks user.plan.status and user.plan.currentPeriodEnd.
// Returns 402 + ErrorCode.PlanExpired if expired or cancelled.
// Free-tier users always pass — free plan never expires.
// Usage: router.use(enforceSubscription())

function enforceSubscription(): (
  req: Request,
  res: Response,
  next: NextFunction,
) => void {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = req.user;
    if (!user) {
      sendError(res, 401, ErrorCode.Unauthorized, req);
      return;
    }

    // Free tier always passes — no billing period to enforce
    if (user.plan.tier === "free") {
      next();
      return;
    }

    // Cancelled subscriptions are blocked
    if (user.plan.status === PlanStatus.Cancelled) {
      logger.warn("subscription_cancelled", {
        userId: user._id.toString(),
        tier: user.plan.tier,
      });

      sendError(res, 402, ErrorCode.PlanExpired, req, {
        status: user.plan.status,
        renewUrl: `${process.env.FRONTEND_URL || ""}/billing/renew`,
      });
      return;
    }

    // Past-due subscriptions are blocked
    if (user.plan.status === PlanStatus.PastDue) {
      logger.warn("subscription_past_due", {
        userId: user._id.toString(),
        tier: user.plan.tier,
      });

      sendError(res, 402, ErrorCode.PlanExpired, req, {
        status: user.plan.status,
        renewUrl: `${process.env.FRONTEND_URL || ""}/billing/renew`,
      });
      return;
    }

    // Expired period end check (status might still say 'active' if webhook delayed)
    if (
      user.plan.currentPeriodEnd &&
      new Date(user.plan.currentPeriodEnd) < new Date()
    ) {
      logger.warn("subscription_period_expired", {
        userId: user._id.toString(),
        tier: user.plan.tier,
        currentPeriodEnd: user.plan.currentPeriodEnd,
      });

      sendError(res, 402, ErrorCode.PlanExpired, req, {
        status: "expired",
        currentPeriodEnd: user.plan.currentPeriodEnd,
        renewUrl: `${process.env.FRONTEND_URL || ""}/billing/renew`,
      });
      return;
    }

    next();
  };
}

export { enforceQuota, enforceSubscription };
