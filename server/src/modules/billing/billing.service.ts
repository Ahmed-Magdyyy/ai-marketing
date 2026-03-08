// ─────────────────────────────────────────────────────────────────
// Billing Service — Phase 9: Paymob Billing & Subscriptions
// Paymob API integration for Egyptian payment processing.
// Handles: checkout session creation, payment webhooks,
//          renewal webhooks, subscription cancellation.
// ─────────────────────────────────────────────────────────────────

import crypto from "crypto";
import { UserModel, IUserDocument } from "../auth/user.model";
import {
  PlanTier,
  BillingCycle,
  PlanStatus,
  IPaymobWebhookPayload,
} from "../../shared/types";
import { PLAN_LIMITS, getPlanLimits } from "../../shared/config/planLimits";
import { logger } from "../../shared/utils/logger";

// ── Paymob Config ────────────────────────────────────────────────

const PAYMOB_API_KEY = process.env.PAYMOB_API_KEY || "";
const PAYMOB_HMAC_SECRET = process.env.PAYMOB_HMAC_SECRET || "";
const PAYMOB_BASE_URL = "https://accept.paymob.com/v1";

// ── Price Lookup (EGP piasters) ──────────────────────────────────
// Prices from planLimits.ts are in EGP. Paymob expects amount_cents.

function getAmountCents(tier: PlanTier, cycle: BillingCycle): number {
  const plan = PLAN_LIMITS[tier];

  if (tier === PlanTier.Free || tier === PlanTier.Custom) {
    return 0; // Free has no charge; Custom is handled offline
  }

  const price =
    cycle === BillingCycle.Annual ? plan.priceAnnual : plan.priceMonthly;

  if (price === null) {
    return 0;
  }

  return price * 100; // EGP → piasters
}

// ── Create Checkout Session ──────────────────────────────────────
// Creates a Paymob payment intention for upgrading to a paid plan.
// Returns the client_secret (redirect URL) for the frontend.

interface CheckoutResult {
  clientSecret: string;
  paymentIntentionId: string;
}

async function createCheckoutSession(
  user: IUserDocument,
  tier: PlanTier,
  billingCycle: BillingCycle,
): Promise<CheckoutResult> {
  if (tier === PlanTier.Free) {
    throw new Error("Cannot create checkout for free plan");
  }

  if (tier === PlanTier.Custom) {
    throw new Error("Custom plans are handled offline — contact sales");
  }

  const amountCents = getAmountCents(tier, billingCycle);

  if (amountCents === 0) {
    throw new Error(`Invalid price for tier=${tier} cycle=${billingCycle}`);
  }

  const payload = {
    amount: amountCents,
    currency: "EGP",
    payment_methods: [
      // Paymob integration IDs — configured per merchant account
      // These accept card, Fawry, Vodafone Cash, etc.
    ],
    billing_data: {
      first_name: user.name.split(" ")[0] || "User",
      last_name: user.name.split(" ").slice(1).join(" ") || "N/A",
      email: user.email,
      phone_number: user.phone || "N/A",
    },
    extras: {
      userId: user._id.toString(),
      tier,
      billingCycle,
    },
    special_reference: `${user._id.toString()}_${tier}_${billingCycle}_${Date.now()}`,
  };

  const response = await fetch(`${PAYMOB_BASE_URL}/intention/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Token ${PAYMOB_API_KEY}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    logger.error("paymob_checkout_failed", {
      status: response.status,
      body: errorBody,
      userId: user._id.toString(),
    });
    throw new Error(`Paymob checkout failed: ${response.status}`);
  }

  const data = (await response.json()) as {
    client_secret: string;
    id: string;
  };

  logger.info("paymob_checkout_created", {
    userId: user._id.toString(),
    tier,
    billingCycle,
    amountCents,
    intentionId: data.id,
  });

  return {
    clientSecret: data.client_secret,
    paymentIntentionId: data.id,
  };
}

// ── Verify Webhook HMAC ──────────────────────────────────────────
// Paymob signs webhooks with HMAC-SHA512 using the merchant secret.
// Returns true if signature matches, false if tampered.

function verifyWebhookHmac(rawBody: string, receivedHmac: string): boolean {
  if (!PAYMOB_HMAC_SECRET) {
    logger.warn("paymob_hmac_secret_missing");
    return false;
  }

  const computed = crypto
    .createHmac("sha512", PAYMOB_HMAC_SECRET)
    .update(rawBody)
    .digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(computed, "hex"),
    Buffer.from(receivedHmac, "hex"),
  );
}

// ── Handle Payment Success Webhook ───────────────────────────────
// On successful payment: upgrade user plan, copy limits, reset usage.
// Called by the webhook controller after HMAC validation.

async function handlePaymentSuccess(
  payload: IPaymobWebhookPayload,
): Promise<{ userId: string; tier: PlanTier }> {
  const { obj } = payload;

  if (!obj.success) {
    logger.warn("paymob_payment_not_successful", {
      transactionId: obj.id,
    });
    throw new Error("Payment was not successful");
  }

  const extras = obj.payment_key_claims.extra;
  const userId = extras.userId;
  const tier = extras.tier as PlanTier;
  const billingCycle = extras.billingCycle as BillingCycle;

  if (!userId || !tier || !billingCycle) {
    throw new Error("Missing required extras in payment webhook");
  }

  const user = await UserModel.findById(userId);
  if (!user) {
    throw new Error(`User not found for userId=${userId}`);
  }

  // Calculate period end based on billing cycle
  const now = new Date();
  const periodEnd = new Date(now);

  if (billingCycle === BillingCycle.Annual) {
    periodEnd.setFullYear(periodEnd.getFullYear() + 1);
  } else {
    periodEnd.setMonth(periodEnd.getMonth() + 1);
  }

  // Get plan limits for the new tier
  const newLimits = getPlanLimits(tier);

  // Update the user
  user.plan = {
    tier,
    billingCycle,
    status: PlanStatus.Active,
    currentPeriodEnd: periodEnd,
    paymobSubscriptionId: String(obj.order.id),
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

  user.usage = {
    postsGenerated: 0,
    imagesGenerated: 0,
    videosGenerated: 0,
    voiceoversGenerated: 0,
    designsGenerated: 0,
    competitorResearchRuns: 0,
    resetAt: periodEnd,
  };

  await user.save();

  logger.info("payment_success_applied", {
    userId,
    tier,
    billingCycle,
    transactionId: obj.id,
    periodEnd: periodEnd.toISOString(),
  });

  return { userId, tier };
}

// ── Handle Renewal Webhook ───────────────────────────────────────
// On billing renewal: reset all usage counters, update period end.
// Called when Paymob processes a recurring payment.

async function handleRenewalSuccess(
  userId: string,
  billingCycle: BillingCycle,
): Promise<void> {
  const user = await UserModel.findById(userId);
  if (!user) {
    throw new Error(`User not found for renewal: userId=${userId}`);
  }

  const now = new Date();
  const newPeriodEnd = new Date(now);

  if (billingCycle === BillingCycle.Annual) {
    newPeriodEnd.setFullYear(newPeriodEnd.getFullYear() + 1);
  } else {
    newPeriodEnd.setMonth(newPeriodEnd.getMonth() + 1);
  }

  user.plan.status = PlanStatus.Active;
  user.plan.currentPeriodEnd = newPeriodEnd;

  user.usage = {
    postsGenerated: 0,
    imagesGenerated: 0,
    videosGenerated: 0,
    voiceoversGenerated: 0,
    designsGenerated: 0,
    competitorResearchRuns: 0,
    resetAt: newPeriodEnd,
  };

  await user.save();

  logger.info("renewal_success_applied", {
    userId,
    billingCycle,
    newPeriodEnd: newPeriodEnd.toISOString(),
  });
}

// ── Cancel Subscription ──────────────────────────────────────────
// Marks subscription as cancelled. User keeps access until period end.

async function cancelSubscription(
  userId: string,
): Promise<{ cancelledAt: Date; accessUntil: Date }> {
  const user = await UserModel.findById(userId);
  if (!user) {
    throw new Error(`User not found for cancellation: userId=${userId}`);
  }

  if (user.plan.tier === PlanTier.Free) {
    throw new Error("Cannot cancel free plan");
  }

  if (user.plan.status === PlanStatus.Cancelled) {
    throw new Error("Subscription already cancelled");
  }

  const cancelledAt = new Date();
  const accessUntil = new Date(user.plan.currentPeriodEnd);

  user.plan.status = PlanStatus.Cancelled;
  await user.save();

  logger.info("subscription_cancelled", {
    userId,
    tier: user.plan.tier,
    cancelledAt: cancelledAt.toISOString(),
    accessUntil: accessUntil.toISOString(),
  });

  return { cancelledAt, accessUntil };
}

// ── Get Usage Summary ────────────────────────────────────────────
// Returns current usage vs limits for the billing dashboard.

interface UsageSummary {
  tier: PlanTier;
  billingCycle: BillingCycle;
  status: PlanStatus;
  currentPeriodEnd: Date;
  usage: {
    posts: { used: number; limit: number };
    images: { used: number; limit: number };
    videos: { used: number; limit: number };
    voiceovers: { used: number; limit: number };
    designs: { used: number; limit: number };
    competitorResearch: { used: number; limit: number };
  };
  brands: { used: number; limit: number };
  platforms: string[];
  prioritySupport: boolean;
}

async function getUsageSummary(user: IUserDocument): Promise<UsageSummary> {
  // Count user's actual brands
  // Import dynamically to avoid circular dependency
  const { BrandProfileModel } = await import("../brand/brand.model");
  const brandCount = await BrandProfileModel.countDocuments({
    userId: user._id,
    isDeleted: { $ne: true },
  });

  return {
    tier: user.plan.tier as PlanTier,
    billingCycle: user.plan.billingCycle as BillingCycle,
    status: user.plan.status as PlanStatus,
    currentPeriodEnd: user.plan.currentPeriodEnd,
    usage: {
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
    },
    brands: {
      used: brandCount,
      limit: user.limits.brandsAllowed,
    },
    platforms: user.limits.platforms,
    prioritySupport: user.limits.prioritySupport,
  };
}

export {
  createCheckoutSession,
  verifyWebhookHmac,
  handlePaymentSuccess,
  handleRenewalSuccess,
  cancelSubscription,
  getUsageSummary,
  getAmountCents,
  type CheckoutResult,
  type UsageSummary,
};
