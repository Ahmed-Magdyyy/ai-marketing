// ─────────────────────────────────────────────────────────────────
// Billing Validation — Joi schemas for billing endpoints
// Phase 9: Paymob Billing & Subscriptions
// ─────────────────────────────────────────────────────────────────

import Joi from "joi";
import { PlanTier, BillingCycle } from "../../shared/types";

// Allowed paid tiers for checkout (free = auto, custom = offline)
const paidTiers = [PlanTier.Starter, PlanTier.Growth, PlanTier.Agency];
const billingCycles = [BillingCycle.Monthly, BillingCycle.Annual];

// ── POST /api/billing/checkout ───────────────────────────────────

export const checkoutSchema = Joi.object({
  tier: Joi.string()
    .valid(...paidTiers)
    .required()
    .messages({
      "any.only": "الخطة لازم تكون starter أو growth أو agency",
      "any.required": "الخطة مطلوبة",
    }),
  billingCycle: Joi.string()
    .valid(...billingCycles)
    .required()
    .messages({
      "any.only": "دورة الفوترة لازم تكون monthly أو annual",
      "any.required": "دورة الفوترة مطلوبة",
    }),
});

// ── POST /api/billing/webhook ────────────────────────────────────
// Webhook body is validated structurally — Paymob sends it unsigned
// in query and signed via HMAC. We only do structural checks here.

export const webhookSchema = Joi.object({
  type: Joi.string().valid("TRANSACTION").required().messages({
    "any.only": "نوع الـ webhook لازم يكون TRANSACTION",
    "any.required": "نوع الـ webhook مطلوب",
  }),
  obj: Joi.object({
    id: Joi.number().required(),
    success: Joi.boolean().required(),
    amount_cents: Joi.number().required(),
    currency: Joi.string().required(),
    order: Joi.object({
      id: Joi.number().required(),
    }).required(),
    payment_key_claims: Joi.object({
      billing_data: Joi.object({
        email: Joi.string().required(),
        first_name: Joi.string().required(),
        last_name: Joi.string().required(),
      }).required(),
      extra: Joi.object().required(),
    }).required(),
    source_data: Joi.object({
      type: Joi.string().required(),
      sub_type: Joi.string().required(),
    }).required(),
    created_at: Joi.string().required(),
  })
    .required()
    .unknown(true), // Allow extra Paymob fields
}).unknown(true); // Allow extra top-level Paymob fields
