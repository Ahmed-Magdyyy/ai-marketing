// ─────────────────────────────────────────────────────────────────
// Research Validation — Joi schemas for research endpoints
// ─────────────────────────────────────────────────────────────────

import Joi from "joi";

// ── Shared: ObjectId string pattern ──────────────────────────────

const objectId = Joi.string()
  .pattern(/^[0-9a-fA-F]{24}$/)
  .messages({
    "string.pattern.base": "الـ ID مش بصيغة صحيحة",
  });

// ── POST /api/research/crawl ─────────────────────────────────────

export const deepCrawlSchema = Joi.object({
  brandProfileId: objectId.required().messages({
    "any.required": "معرّف البراند مطلوب",
  }),
  url: Joi.string().uri().required().messages({
    "string.uri": "الرابط مش صالح",
    "any.required": "رابط الموقع مطلوب",
  }),
  maxPages: Joi.number().integer().min(1).max(50).optional().messages({
    "number.min": "عدد الصفحات لازم يكون ١ على الأقل",
    "number.max": "عدد الصفحات مينفعش يزيد عن ٥٠",
  }),
  timeCapSeconds: Joi.number().integer().min(30).max(300).optional().messages({
    "number.min": "الحد الأدنى للوقت ٣٠ ثانية",
    "number.max": "الحد الأقصى للوقت ٣٠٠ ثانية",
  }),
});

// ── POST /api/research/scrape ────────────────────────────────────

export const scrapeSingleSchema = Joi.object({
  brandProfileId: objectId.required().messages({
    "any.required": "معرّف البراند مطلوب",
  }),
  url: Joi.string().uri().required().messages({
    "string.uri": "الرابط مش صالح",
    "any.required": "رابط الموقع مطلوب",
  }),
  tier: Joi.number().integer().min(1).max(4).optional().messages({
    "number.min": "مستوى الـ scraping لازم يكون ١ على الأقل",
    "number.max": "مستوى الـ scraping مينفعش يزيد عن ٤",
  }),
});
