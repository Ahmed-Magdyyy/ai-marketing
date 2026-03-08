// ─────────────────────────────────────────────────────────────────
// Billing Controller — Phase 9: Paymob Billing & Subscriptions
// POST /api/billing/checkout  — create Paymob checkout session
// POST /api/billing/webhook   — handle Paymob payment webhook
// GET  /api/billing/usage     — current usage vs limits dashboard
// POST /api/billing/cancel    — cancel active subscription
// ─────────────────────────────────────────────────────────────────

import { Request, Response } from "express";
import {
  createCheckoutSession,
  verifyWebhookHmac,
  handlePaymentSuccess,
  cancelSubscription,
  getUsageSummary,
} from "./billing.service";
import { checkoutSchema, webhookSchema } from "./billing.validation";
import { asyncHandler } from "../../shared/utils/asyncHandler";
import { ApiError } from "../../shared/utils/ApiError";
import {
  sendSuccess,
  sendCreated,
  sendError,
} from "../../shared/utils/apiResponse";
import {
  ErrorCode,
  SuccessCode,
  PlanTier,
  BillingCycle,
  IPaymobWebhookPayload,
} from "../../shared/types";
import { IUserDocument } from "../auth/user.model";
import { logger } from "../../shared/utils/logger";

// ── POST /api/billing/checkout ───────────────────────────────────
// Creates a Paymob payment intention for upgrading to a paid plan.
// Returns clientSecret for frontend redirect to Paymob checkout page.

export const checkout = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { error, value } = checkoutSchema.validate(req.body, {
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
    const tier = value.tier as PlanTier;
    const billingCycle = value.billingCycle as BillingCycle;

    // Cannot checkout for free or custom plans
    if (tier === PlanTier.Free || tier === PlanTier.Custom) {
      throw new ApiError(
        400,
        ErrorCode.ValidationError,
        "الخطة دي مش متاحة للشراء أونلاين.",
      );
    }

    const result = await createCheckoutSession(user, tier, billingCycle);

    return sendCreated(res, result, SuccessCode.SubscriptionCreated, req);
  },
);

// ── POST /api/billing/webhook ────────────────────────────────────
// Paymob transaction webhook. Validates HMAC, processes payment.
// Returns 200 OK to acknowledge receipt (Paymob requires this).

export const webhook = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    // HMAC verification — Paymob sends hmac in query string
    const hmac = req.query.hmac as string;

    if (!hmac) {
      logger.warn("webhook_missing_hmac");
      sendError(res, 400, ErrorCode.ValidationError, req);
      return;
    }

    // Verify HMAC signature using raw body
    const rawBody =
      typeof req.body === "string" ? req.body : JSON.stringify(req.body);

    if (!verifyWebhookHmac(rawBody, hmac)) {
      logger.warn("webhook_hmac_mismatch");
      sendError(res, 401, ErrorCode.Unauthorized, req);
      return;
    }

    // Validate webhook structure
    const payload =
      typeof req.body === "string" ? JSON.parse(req.body) : req.body;

    const { error } = webhookSchema.validate(payload, {
      abortEarly: false,
    });

    if (error) {
      logger.warn("webhook_validation_failed", {
        errors: error.details.map((d) => d.message),
      });
      // Still return 200 — don't retry invalid payloads
      res.status(200).json({ received: true, valid: false });
      return;
    }

    const webhookPayload = payload as IPaymobWebhookPayload;

    if (!webhookPayload.obj.success) {
      logger.info("webhook_payment_failed", {
        transactionId: webhookPayload.obj.id,
      });
      // Acknowledge receipt even for failed payments
      res.status(200).json({ received: true, success: false });
      return;
    }

    try {
      const result = await handlePaymentSuccess(webhookPayload);

      logger.info("webhook_payment_processed", {
        userId: result.userId,
        tier: result.tier,
        transactionId: webhookPayload.obj.id,
      });

      res.status(200).json({ received: true, success: true });
    } catch (err) {
      logger.error("webhook_processing_error", {
        transactionId: webhookPayload.obj.id,
        error: err instanceof Error ? err.message : String(err),
      });
      // Return 200 to prevent Paymob retries on business logic errors
      res.status(200).json({ received: true, error: "processing_failed" });
    }
  },
);

// ── GET /api/billing/usage ───────────────────────────────────────
// Returns current usage vs limits for the user's billing dashboard.

export const usage = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const user = req.user as IUserDocument;

    const summary = await getUsageSummary(user);

    return sendSuccess(res, summary, 200, SuccessCode.Ok, req);
  },
);

// ── POST /api/billing/cancel ─────────────────────────────────────
// Cancels the user's active subscription. Access continues until period end.

export const cancel = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const user = req.user as IUserDocument;

    if (user.plan.tier === PlanTier.Free) {
      throw new ApiError(
        400,
        ErrorCode.ValidationError,
        "مفيش اشتراك نشط للإلغاء.",
      );
    }

    const result = await cancelSubscription(user._id.toString());

    return sendSuccess(
      res,
      result,
      200,
      SuccessCode.SubscriptionCancelled,
      req,
    );
  },
);
