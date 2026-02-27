// ─────────────────────────────────────────────────────────────────
// Auth Validation — Joi schemas for register and login
// ─────────────────────────────────────────────────────────────────

import Joi from "joi";

export const registerSchema = Joi.object({
  email: Joi.string().email().required().messages({
    "string.email": "البريد الإلكتروني غير صالح",
    "any.required": "البريد الإلكتروني مطلوب",
  }),
  password: Joi.string()
    .min(8)
    .max(128)
    .pattern(/[A-Z]/, "uppercase letter")
    .pattern(/[a-z]/, "lowercase letter")
    .pattern(/[0-9]/, "digit")
    .required()
    .messages({
      "string.min": "كلمة المرور لازم تكون ٨ حروف على الأقل",
      "string.pattern.name":
        "كلمة المرور لازم تحتوي على حرف كبير وحرف صغير ورقم",
      "any.required": "كلمة المرور مطلوبة",
    }),
  name: Joi.string().min(2).max(100).required().messages({
    "string.min": "الاسم لازم يكون حرفين على الأقل",
    "any.required": "الاسم مطلوب",
  }),
  phone: Joi.string().allow("").optional(),
  lang: Joi.string().valid("ar", "en").default("ar"),
});

export const loginSchema = Joi.object({
  email: Joi.string().email().required().messages({
    "string.email": "البريد الإلكتروني غير صالح",
    "any.required": "البريد الإلكتروني مطلوب",
  }),
  password: Joi.string().required().messages({
    "any.required": "كلمة المرور مطلوبة",
  }),
});
