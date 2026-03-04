// ─────────────────────────────────────────────────────────────────
// Plan Validation — Joi schemas for marketing plan endpoints
// ─────────────────────────────────────────────────────────────────

import Joi from "joi";

// ── Shared: ObjectId string pattern ──────────────────────────────

const objectId = Joi.string()
  .pattern(/^[0-9a-fA-F]{24}$/)
  .messages({
    "string.pattern.base": "الـ ID مش بصيغة صحيحة",
  });

// ── POST /api/plan/generate ──────────────────────────────────────

export const generatePlanSchema = Joi.object({
  brandId: objectId.required().messages({
    "any.required": "معرّف البراند مطلوب",
  }),
  month: Joi.number().integer().min(1).max(12).required().messages({
    "number.min": "الشهر لازم يكون من ١ لـ ١٢",
    "number.max": "الشهر لازم يكون من ١ لـ ١٢",
    "any.required": "الشهر مطلوب",
  }),
  year: Joi.number().integer().min(2024).max(2030).required().messages({
    "number.min": "السنة لازم تكون من ٢٠٢٤ لـ ٢٠٣٠",
    "number.max": "السنة لازم تكون من ٢٠٢٤ لـ ٢٠٣٠",
    "any.required": "السنة مطلوبة",
  }),
  postsPerMonth: Joi.number().integer().min(5).max(50).optional().messages({
    "number.min": "عدد البوستات لازم يكون ٥ على الأقل",
    "number.max": "عدد البوستات مينفعش يزيد عن ٥٠",
  }),
});

// ── PUT /api/plan/:id/item/:itemId ───────────────────────────────

export const updateContentItemSchema = Joi.object({
  caption: Joi.string().optional().messages({
    "string.base": "الكابشن لازم يكون نص",
  }),
  hashtags: Joi.array().items(Joi.string()).optional().messages({
    "array.base": "الهاشتاجات لازم تكون مصفوفة",
  }),
  designBrief: Joi.string().optional().messages({
    "string.base": "وصف التصميم لازم يكون نص",
  }),
  date: Joi.date().iso().optional().messages({
    "date.format": "التاريخ لازم يكون بصيغة ISO",
  }),
  platform: Joi.string()
    .valid("facebook", "instagram", "tiktok", "twitter", "youtube")
    .optional()
    .messages({
      "any.only":
        "المنصة لازم تكون facebook أو instagram أو tiktok أو twitter أو youtube",
    }),
  contentType: Joi.string()
    .valid("post", "reel", "story", "carousel", "ad")
    .optional()
    .messages({
      "any.only":
        "نوع المحتوى لازم يكون post أو reel أو story أو carousel أو ad",
    }),
})
  .min(1)
  .messages({
    "object.min": "لازم تبعت حقل واحد على الأقل للتعديل",
  });
