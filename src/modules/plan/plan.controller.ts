// ─────────────────────────────────────────────────────────────────
// Plan Controller — request handlers for marketing plan endpoints.
// POST /api/plan/generate       — generate new plan
// GET  /api/plan/:id            — get plan + content items
// PUT  /api/plan/:id/approve    — approve plan
// PUT  /api/plan/:id/item/:itemId — update single content item
// ─────────────────────────────────────────────────────────────────

import { Request, Response } from "express";
import { Types } from "mongoose";
import { planService } from "./plan.service";
import { generatePlanSchema, updateContentItemSchema } from "./plan.validation";
import { asyncHandler } from "../../shared/utils/asyncHandler";
import { logger } from "../../shared/utils/logger";
import { ApiError } from "../../shared/utils/ApiError";
import { ErrorCode, SuccessCode } from "../../shared/types";
import { triggerContentGeneration } from "../content/content.service";
import { sendSuccess, sendCreated } from "../../shared/utils/apiResponse";
import { MarketingPlanModel, ContentItemModel } from "./plan.model";
import { IUserDocument } from "../auth/user.model";

// ── POST /api/plan/generate ──────────────────────────────────────

export const generatePlan = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { error, value } = generatePlanSchema.validate(req.body, {
      abortEarly: false,
    });
    if (error) {
      throw new ApiError(
        400,
        ErrorCode.ValidationError,
        error.details.map((d) => d.message).join(", "),
      );
    }

    const user = req.user as IUserDocument;
    const result = await planService.generatePlan({
      userId: user._id,
      brandId: value.brandId,
      month: value.month,
      year: value.year,
      postsPerMonth: value.postsPerMonth,
    });

    return sendCreated(res, result, SuccessCode.Created, req);
  },
);

// ── GET /api/plan/:id ────────────────────────────────────────────

export const getPlan = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const user = req.user as IUserDocument;
    const planId = req.params.id;

    const plan = await MarketingPlanModel.findOne({
      _id: planId,
      userId: user._id,
    }).lean();

    if (!plan) {
      throw new ApiError(
        404,
        ErrorCode.NotFound,
        "الخطة مش موجودة أو مش بتاعتك.",
      );
    }

    const contentItems = await ContentItemModel.find({
      planId: plan._id,
    })
      .sort({ date: 1 })
      .lean();

    return sendSuccess(res, { plan, contentItems }, 200, SuccessCode.Ok, req);
  },
);

// ── PUT /api/plan/:id/approve ────────────────────────────────────

export const approvePlan = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const user = req.user as IUserDocument;
    const planId = req.params.id;

    const plan = await MarketingPlanModel.findOneAndUpdate(
      { _id: planId, userId: user._id, status: "draft" },
      { $set: { status: "approved", approvedAt: new Date() } },
      { new: true },
    ).lean();

    if (!plan) {
      throw new ApiError(
        404,
        ErrorCode.NotFound,
        "الخطة مش موجودة، مش بتاعتك، أو تمت الموافقة عليها قبل كدا.",
      );
    }

    // Phase 6 — queue content generation jobs asynchronously
    triggerContentGeneration(plan, String(user._id)).catch((err: unknown) =>
      logger.error("approve_plan_content_gen_failed", { error: err }),
    );

    // Phase 7/9 — auto-schedule social posts after content generation completes.
    // Future: iterate plan contentItems with scheduledAt and enqueue social-publish jobs.

    return sendSuccess(res, plan, 200, SuccessCode.Ok, req);
  },
);

// ── PUT /api/plan/:id/item/:itemId ───────────────────────────────

export const updateContentItem = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { error, value } = updateContentItemSchema.validate(req.body, {
      abortEarly: false,
    });
    if (error) {
      throw new ApiError(
        400,
        ErrorCode.ValidationError,
        error.details.map((d) => d.message).join(", "),
      );
    }

    const user = req.user as IUserDocument;
    const { id: planId, itemId } = req.params;

    // Verify plan ownership first
    const plan = await MarketingPlanModel.findOne({
      _id: planId,
      userId: user._id,
    }).lean();

    if (!plan) {
      throw new ApiError(
        404,
        ErrorCode.NotFound,
        "الخطة مش موجودة أو مش بتاعتك.",
      );
    }

    const updatedItem = await ContentItemModel.findOneAndUpdate(
      {
        _id: new Types.ObjectId(itemId as string),
        planId: plan._id,
        userId: user._id,
      },
      { $set: value },
      { new: true },
    ).lean();

    if (!updatedItem) {
      throw new ApiError(404, ErrorCode.NotFound, "عنصر المحتوى مش موجود.");
    }

    return sendSuccess(res, updatedItem, 200, SuccessCode.Ok, req);
  },
);
