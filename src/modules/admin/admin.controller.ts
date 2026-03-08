// ─────────────────────────────────────────────────────────────────
// Admin Controller — user management handlers
// ─────────────────────────────────────────────────────────────────

import { Request, Response } from "express";
import { adminService } from "./admin.service";
import { asyncHandler } from "../../shared/utils/asyncHandler";
import { ApiError } from "../../shared/utils/ApiError";
import {
  ErrorCode,
  SuccessCode,
  UserStatus,
  PlanTier,
  PlanStatus,
  BillingCycle,
} from "../../shared/types";
import { sendSuccess } from "../../shared/utils/apiResponse";
import { UserModel } from "../auth/user.model";
import { getPlanLimits } from "../../shared/config/planLimits";
import { logger } from "../../shared/utils/logger";

// ── List Users ──────────────────────────────────────────────────

export const listUsersHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10));
    const limit = Math.min(
      100,
      Math.max(1, parseInt(String(req.query.limit ?? "20"), 10)),
    );
    const status = req.query.status
      ? (String(req.query.status) as UserStatus)
      : undefined;
    const search = req.query.search ? String(req.query.search) : undefined;

    const result = await adminService.listUsers({
      page,
      limit,
      status,
      search,
    });

    return sendSuccess(res, result, 200, SuccessCode.Ok, req);
  },
);

// ── Get User By ID ──────────────────────────────────────────────

export const getUserHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const userId = String(req.params.userId);
    if (!userId) {
      throw new ApiError(400, ErrorCode.ValidationError);
    }

    const user = await adminService.getUserById(userId);

    return sendSuccess(res, { user }, 200, SuccessCode.Ok, req);
  },
);

// ── Update User Status ──────────────────────────────────────────

export const updateUserStatusHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const userId = String(req.params.userId);
    if (!userId) {
      throw new ApiError(400, ErrorCode.ValidationError);
    }

    const adminId = req.user?._id?.toString();
    if (!adminId) {
      throw new ApiError(401, ErrorCode.Unauthorized);
    }

    const { status, reason } = req.body as {
      status: UserStatus;
      reason?: string;
    };

    if (
      !status ||
      !["active", "inactive", "suspended", "banned"].includes(status)
    ) {
      throw new ApiError(400, ErrorCode.ValidationError);
    }

    const user = await adminService.updateUserStatus(
      userId,
      status,
      adminId,
      reason,
    );

    const successCode =
      status === "suspended"
        ? SuccessCode.UserSuspended
        : SuccessCode.UserActivated;

    return sendSuccess(res, { user }, 200, successCode, req);
  },
);

// ── Soft Delete User ────────────────────────────────────────────

export const deleteUserHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const userId = String(req.params.userId);
    if (!userId) {
      throw new ApiError(400, ErrorCode.ValidationError);
    }

    const adminId = req.user?._id?.toString();
    if (!adminId) {
      throw new ApiError(401, ErrorCode.Unauthorized);
    }

    await adminService.softDeleteUser(userId, adminId);

    return sendSuccess(res, null, 200, SuccessCode.Deleted, req);
  },
);

// ── Hard Delete User ────────────────────────────────────────────

export const hardDeleteUserHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const userId = String(req.params.userId);
    const adminId = req.user?._id?.toString();
    if (!adminId) {
      throw new ApiError(401, ErrorCode.Unauthorized);
    }

    const { confirm } = req.body as { confirm: string };
    await adminService.hardDeleteUser(userId, adminId, confirm);

    return sendSuccess(res, null, 200, SuccessCode.AccountDeleted, req);
  },
);

// ── Admin Reset User Password ───────────────────────────────────

export const adminResetPasswordHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const userId = String(req.params.userId);
    const adminId = req.user?._id?.toString();
    if (!adminId) {
      throw new ApiError(401, ErrorCode.Unauthorized);
    }

    const { newPassword } = req.body as { newPassword: string };
    if (!newPassword || newPassword.length < 8) {
      throw new ApiError(400, ErrorCode.ValidationError);
    }

    await adminService.adminResetUserPassword(userId, adminId, newPassword);

    return sendSuccess(res, null, 200, SuccessCode.PasswordResetByAdmin, req);
  },
);

// ── Admin: Set Plan Tier ────────────────────────────────────────
// PUT /api/admin/users/:userId/plan
// Body: { tier: PlanTier, billingCycle?: BillingCycle }

export const adminSetPlanTierHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const userId = String(req.params.userId);
    const adminId = req.user?._id?.toString();
    if (!adminId) {
      throw new ApiError(401, ErrorCode.Unauthorized);
    }

    const { tier, billingCycle } = req.body as {
      tier: PlanTier;
      billingCycle?: BillingCycle;
    };

    const validTiers = Object.values(PlanTier);
    if (!tier || !validTiers.includes(tier)) {
      throw new ApiError(
        400,
        ErrorCode.ValidationError,
        `الخطة لازم تكون واحدة من: ${validTiers.join(", ")}`,
      );
    }

    const user = await UserModel.findById(userId);
    if (!user) {
      throw new ApiError(404, ErrorCode.NotFound);
    }

    const newLimits = getPlanLimits(tier);
    const cycle =
      billingCycle || user.plan.billingCycle || BillingCycle.Monthly;

    // Set period end to 30 days from now (admin override)
    const periodEnd = new Date();
    periodEnd.setDate(periodEnd.getDate() + 30);

    user.plan = {
      tier,
      billingCycle: cycle as BillingCycle,
      status: PlanStatus.Active,
      currentPeriodEnd: periodEnd,
      paymobSubscriptionId: user.plan.paymobSubscriptionId || "",
    };

    user.limits = {
      brandsAllowed: newLimits.brandsAllowed,
      postsPerMonth: newLimits.postsPerMonth,
      imagesPerMonth: newLimits.imagesPerMonth,
      videosPerMonth: newLimits.videosPerMonth,
      voiceoversPerMonth: newLimits.voiceoversPerMonth,
      designsPerMonth: newLimits.designsPerMonth,
      competitorResearchPerMonth: newLimits.competitorResearchPerMonth,
      platforms: newLimits.platforms,
      agentMemoryMonths: newLimits.agentMemoryMonths,
      prioritySupport: newLimits.prioritySupport,
    };

    await user.save();

    logger.info("admin_set_plan_tier", {
      adminId,
      userId,
      tier,
      billingCycle: cycle,
    });

    return sendSuccess(
      res,
      { plan: user.plan, limits: user.limits },
      200,
      SuccessCode.Ok,
      req,
    );
  },
);

// ── Admin: Reset Usage ──────────────────────────────────────────
// POST /api/admin/users/:userId/reset-usage
// Resets all usage counters to 0 for the target user.

export const adminResetUsageHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const userId = String(req.params.userId);
    const adminId = req.user?._id?.toString();
    if (!adminId) {
      throw new ApiError(401, ErrorCode.Unauthorized);
    }

    const user = await UserModel.findById(userId);
    if (!user) {
      throw new ApiError(404, ErrorCode.NotFound);
    }

    const resetAt = new Date(user.plan.currentPeriodEnd);

    user.usage = {
      postsGenerated: 0,
      imagesGenerated: 0,
      videosGenerated: 0,
      voiceoversGenerated: 0,
      designsGenerated: 0,
      competitorResearchRuns: 0,
      resetAt,
    };

    await user.save();

    logger.info("admin_reset_usage", { adminId, userId });

    return sendSuccess(
      res,
      { usage: user.usage },
      200,
      SuccessCode.UsageReset,
      req,
    );
  },
);

// ── Admin: Extend Subscription ──────────────────────────────────
// POST /api/admin/users/:userId/extend-subscription
// Body: { days: number }
// Extends currentPeriodEnd by N days.

export const adminExtendSubscriptionHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const userId = String(req.params.userId);
    const adminId = req.user?._id?.toString();
    if (!adminId) {
      throw new ApiError(401, ErrorCode.Unauthorized);
    }

    const { days } = req.body as { days: number };
    if (!days || typeof days !== "number" || days < 1 || days > 365) {
      throw new ApiError(
        400,
        ErrorCode.ValidationError,
        "عدد الأيام لازم يكون رقم من ١ لـ ٣٦٥",
      );
    }

    const user = await UserModel.findById(userId);
    if (!user) {
      throw new ApiError(404, ErrorCode.NotFound);
    }

    // Extend from current period end or from now (whichever is later)
    const base = new Date(
      Math.max(new Date(user.plan.currentPeriodEnd).getTime(), Date.now()),
    );
    base.setDate(base.getDate() + days);

    user.plan.currentPeriodEnd = base;
    user.plan.status = PlanStatus.Active;
    await user.save();

    logger.info("admin_extend_subscription", {
      adminId,
      userId,
      days,
      newPeriodEnd: base.toISOString(),
    });

    return sendSuccess(res, { plan: user.plan }, 200, SuccessCode.Ok, req);
  },
);
