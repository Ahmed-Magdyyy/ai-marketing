// ─────────────────────────────────────────────────────────────────
// Email Service — Nodemailer transporter + OTP email templates
// Uses EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASSWORD from env
// ─────────────────────────────────────────────────────────────────

import nodemailer from "nodemailer";
import { logger } from "./logger";
const sendEmail = async (options: {
  email: string;
  subject: string;
  message: string;
}) => {
  // creating the transporter ( service that will send email like gmail)
  const transporter = nodemailer.createTransport({
    // service: "hostinger",
    name: process.env.EMAIL_HOST,
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT), // if secure true => port = 465 || if secure false => port = 587
    secure: true,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });

  // define email options ( from , to , subject , email content )
  const emailOptions = {
    from: "Petyard <bohy.ahmed@gmail.com>",
    to: options.email,
    subject: options.subject,
    html: options.message,
  };

  transporter.verify(function (error, success) {
    if (error) {
      logger.error("email_transport_verify_error", { error: String(error) });
    } else {
      logger.info("email_transport_verify_success", {
        message: "Server is ready to take our messages",
      });
    }
  });

  await transporter.sendMail(emailOptions);
};

export default sendEmail;

// ── OTP Email Template ──────────────────────────────────────────

type OtpPurpose = "email_verification" | "password_reset";

const OTP_SUBJECTS: Record<OtpPurpose, { ar: string; en: string }> = {
  email_verification: {
    ar: "كود تأكيد الإيميل",
    en: "Email Verification Code",
  },
  password_reset: {
    ar: "كود تغيير الباسورد",
    en: "Password Reset Code",
  },
};

const OTP_HEADINGS: Record<OtpPurpose, { ar: string; en: string }> = {
  email_verification: {
    ar: "تأكيد الإيميل",
    en: "Verify Your Email",
  },
  password_reset: {
    ar: "تغيير الباسورد",
    en: "Reset Your Password",
  },
};

const OTP_DESCRIPTIONS: Record<OtpPurpose, { ar: string; en: string }> = {
  email_verification: {
    ar: "استخدم الكود ده لتأكيد إيميلك. الكود صالح لمدة 10 دقايق.",
    en: "Use this code to verify your email. The code is valid for 10 minutes.",
  },
  password_reset: {
    ar: "استخدم الكود ده لتغيير الباسورد. الكود صالح لمدة 10 دقايق.",
    en: "Use this code to reset your password. The code is valid for 10 minutes.",
  },
};

export function buildOtpEmail(
  otp: string,
  lang: "ar" | "en",
  purpose: OtpPurpose,
): string {
  const dir = lang === "ar" ? "rtl" : "ltr";
  const heading = OTP_HEADINGS[purpose][lang];
  const description = OTP_DESCRIPTIONS[purpose][lang];

  return `
<!DOCTYPE html>
<html dir="${dir}" lang="${lang}">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 0;">
    <tr><td align="center">
      <table width="420" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;padding:40px;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <tr><td align="center" style="padding-bottom:24px;">
          <h1 style="margin:0;font-size:22px;color:#1a1a1a;">${heading}</h1>
        </td></tr>
        <tr><td align="center" style="padding-bottom:24px;">
          <p style="margin:0;font-size:15px;color:#555;">${description}</p>
        </td></tr>
        <tr><td align="center" style="padding-bottom:32px;">
          <div style="display:inline-block;background:#f0f0f0;border-radius:8px;padding:16px 32px;font-size:32px;font-weight:bold;letter-spacing:8px;color:#1a1a1a;">
            ${otp}
          </div>
        </td></tr>
        <tr><td align="center">
          <p style="margin:0;font-size:12px;color:#999;">
            ${lang === "ar" ? "لو مطلبتش الكود ده، تجاهل الإيميل ده." : "If you did not request this code, please ignore this email."}
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`.trim();
}

export function getOtpSubject(purpose: OtpPurpose, lang: "ar" | "en"): string {
  return OTP_SUBJECTS[purpose][lang];
}
