// ─────────────────────────────────────────────────────────────────
// Social Validation — Joi schemas for social media endpoints
// ─────────────────────────────────────────────────────────────────

import Joi from "joi";

// ── Shared: ObjectId string pattern ──────────────────────────────

const objectId = Joi.string()
  .pattern(/^[0-9a-fA-F]{24}$/)
  .messages({
    "string.pattern.base": "الـ ID مش بصيغة صحيحة",
  });

// ── GET /api/social/connect/:platform ────────────────────────────

export const connectPlatformSchema = Joi.object({
  brandId: objectId.required().messages({
    "any.required": "معرّف البراند مطلوب",
  }),
});

// ── POST /api/social/publish/:contentItemId ──────────────────────

export const publishContentSchema = Joi.object({
  // No body required — contentItemId comes from params
}).allow({});

// ── POST /api/social/schedule/:contentItemId ─────────────────────

export const scheduleContentSchema = Joi.object({
  scheduledAt: Joi.date().iso().required().messages({
    "date.format": "الوقت المجدول لازم يكون بصيغة ISO",
    "any.required": "وقت الجدولة مطلوب",
  }),
});

// ── Params Validation ────────────────────────────────────────────

export const platformParamSchema = Joi.object({
  platform: Joi.string()
    .valid(
      "facebook",
      "instagram",
      "instagram_login",
      "tiktok",
      "twitter",
      "youtube",
    )
    .required()
    .messages({
      "any.only":
        "المنصة لازم تكون facebook أو instagram أو instagram_login أو tiktok أو twitter أو youtube",
      "any.required": "المنصة مطلوبة",
    }),
});

export const contentItemIdParamSchema = Joi.object({
  contentItemId: objectId.required().messages({
    "any.required": "معرّف عنصر المحتوى مطلوب",
  }),
});

export const brandIdParamSchema = Joi.object({
  brandId: objectId.required().messages({
    "any.required": "معرّف البراند مطلوب",
  }),
});

export const disconnectParamSchema = Joi.object({
  brandId: objectId.required().messages({
    "any.required": "معرّف البراند مطلوب",
  }),
  platform: Joi.string()
    .valid(
      "facebook",
      "instagram",
      "instagram_login",
      "tiktok",
      "twitter",
      "youtube",
    )
    .required()
    .messages({
      "any.only":
        "المنصة لازم تكون facebook أو instagram أو instagram_login أو tiktok أو twitter أو youtube",
      "any.required": "المنصة مطلوبة",
    }),
});
