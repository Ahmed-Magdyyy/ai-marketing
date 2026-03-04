// ─────────────────────────────────────────────────────────────────
// Plan Service — generates monthly marketing plans via Claude.
// generatePlan() is the orchestrator: strategy → calendar → arab
// occasions → persist to DB. All Claude calls use getModel() —
// never hardcoded model strings.
// ─────────────────────────────────────────────────────────────────

import Anthropic from "@anthropic-ai/sdk";
import { Types } from "mongoose";
import { getModel } from "../../shared/config/models";
import { ModelRole } from "../../shared/types";
import { ApiError } from "../../shared/utils/ApiError";
import { logger } from "../../shared/utils/logger";
import { trackTokenUsage } from "../../shared/utils/aiCostTracker";
import { getOccasions, Occasion } from "../../shared/utils/arabCalendar";
import { BrandProfileModel } from "../brand/brand.model";
import { MarketingPlanModel, ContentItemModel } from "./plan.model";
import {
  PlanStatusType,
  ContentStatus,
  ContentType,
  ErrorCode,
} from "../../shared/types";

// ── Anthropic Client ─────────────────────────────────────────────

const anthropic = new Anthropic();

// ── Interfaces ───────────────────────────────────────────────────

interface GeneratePlanInput {
  userId: Types.ObjectId | string;
  brandId: Types.ObjectId | string;
  month: number;
  year: number;
  postsPerMonth?: number;
}

interface StrategyResult {
  objective: string;
  keyMessages: string[];
  contentPillars: string[];
  platforms: string[];
  postingFrequency: Record<string, number>;
}

interface CalendarItem {
  date: string;
  platform: string;
  contentType: string;
  caption: string;
  hashtags: string[];
  designBrief: string;
  isOccasion?: boolean;
  occasionName?: string;
}

interface GeneratePlanResult {
  planId: string;
  strategy: StrategyResult;
  contentItems: CalendarItem[];
  egyptianOccasions: string[];
}

// ── Strategy Generation ──────────────────────────────────────────

async function generateStrategy(
  brandProfile: {
    businessName: string;
    industry: string;
    description?: string;
    brandDNA?: {
      tone?: string;
      personality?: string;
      contentDialect?: string;
      targetAudience?: {
        ageRange?: string;
        gender?: string;
        interests?: string[];
        painPoints?: string[];
        platforms?: string[];
      };
    };
    targetMarket?: { country?: string; city?: string };
  },
  month: number,
  year: number,
  userId: string,
): Promise<StrategyResult> {
  const model = getModel(ModelRole.AgentReasoning);

  const systemPrompt = `انت استراتيجي تسويق رقمي محترف بتشتغل مع وكالة تسويق مصرية.
اسم البراند: ${brandProfile.businessName}
الصناعة: ${brandProfile.industry}
الوصف: ${brandProfile.description || "مفيش وصف"}
النبرة: ${brandProfile.brandDNA?.tone || "مش محددة"}
الشخصية: ${brandProfile.brandDNA?.personality || "مش محددة"}
السوق المستهدف: ${brandProfile.targetMarket?.country || "مصر"} - ${brandProfile.targetMarket?.city || ""}
الجمهور المستهدف: ${brandProfile.brandDNA?.targetAudience?.ageRange || ""} ${brandProfile.brandDNA?.targetAudience?.gender || ""}
الاهتمامات: ${brandProfile.brandDNA?.targetAudience?.interests?.join("، ") || ""}

المطلوب: اعمل استراتيجية تسويقية لشهر ${month}/${year}.
رجّع JSON object بس — من غير markdown، من غير أي كلام قبله أو بعده.
الـ JSON لازم يحتوي على:
- objective: هدف الشهر (جملة واحدة)
- keyMessages: مصفوفة من 3-5 رسائل رئيسية
- contentPillars: مصفوفة من 3+ أعمدة محتوى مناسبة للصناعة
- platforms: مصفوفة المنصات المقترحة (facebook, instagram, tiktok, إلخ)
- postingFrequency: object فيه اسم المنصة وعدد البوستات في الشهر`;

  const startMs = Date.now();

  const response = await anthropic.messages.create({
    model,
    max_tokens: 2048,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: `اعمل الاستراتيجية التسويقية لشهر ${month}/${year} للبراند "${brandProfile.businessName}" في صناعة "${brandProfile.industry}".`,
      },
    ],
  });

  const latencyMs = Date.now() - startMs;

  await trackTokenUsage(
    userId,
    model,
    response.usage.input_tokens,
    response.usage.output_tokens,
    "plan_strategy_generation",
  );

  logger.info("plan_strategy_generated", {
    userId,
    model,
    role: ModelRole.AgentReasoning,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    latencyMs,
  });

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Claude returned no text content for strategy generation.");
  }

  let strategy: StrategyResult;
  try {
    strategy = JSON.parse(textBlock.text) as StrategyResult;
  } catch (parseErr) {
    logger.error("plan_strategy_json_parse_failed", {
      error: String(parseErr),
      rawResponse: textBlock.text.slice(0, 500),
      userId,
    });
    throw new Error(
      "Failed to parse strategy response from Claude. " +
        "The model did not return valid JSON.",
    );
  }

  // Validate minimum content pillars
  if (!strategy.contentPillars || strategy.contentPillars.length < 3) {
    logger.warn("plan_strategy_insufficient_pillars", {
      userId,
      pillarsCount: strategy.contentPillars?.length ?? 0,
    });
  }

  return strategy;
}

// ── Content Calendar Generation ──────────────────────────────────

async function generateContentCalendar(
  strategy: StrategyResult,
  brandProfile: {
    businessName: string;
    industry: string;
    brandDNA?: {
      tone?: string;
      contentDialect?: string;
    };
  },
  month: number,
  year: number,
  postsPerMonth: number,
  userId: string,
): Promise<CalendarItem[]> {
  const model = getModel(ModelRole.AgentReasoning);

  const systemPrompt = `انت content calendar specialist بتشتغل مع وكالة تسويق مصرية.
اسم البراند: ${brandProfile.businessName}
الصناعة: ${brandProfile.industry}
اللهجة: ${brandProfile.brandDNA?.contentDialect || "مصري"}
النبرة: ${brandProfile.brandDNA?.tone || ""}

الاستراتيجية:
- الهدف: ${strategy.objective}
- الرسائل الرئيسية: ${strategy.keyMessages.join("، ")}
- أعمدة المحتوى: ${strategy.contentPillars.join("، ")}
- المنصات: ${strategy.platforms.join("، ")}

المطلوب: اعمل content calendar لشهر ${month}/${year} فيه ${postsPerMonth} بوست.
وزّع البوستات على أيام الشهر بالتساوي.
الكابشنز لازم تكون بالعامية المصرية.
رجّع JSON array بس — من غير markdown، من غير أي كلام قبله أو بعده.
كل عنصر في المصفوفة لازم يحتوي على:
- date: التاريخ بصيغة "YYYY-MM-DD"
- platform: اسم المنصة
- contentType: نوع المحتوى (post, reel, story, carousel, ad)
- caption: الكابشن بالعامية المصرية
- hashtags: مصفوفة هاشتاجات
- designBrief: وصف التصميم المطلوب بالتفصيل`;

  const startMs = Date.now();

  const response = await anthropic.messages.create({
    model,
    max_tokens: 8192,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: `اعمل الـ content calendar — ${postsPerMonth} بوست لشهر ${month}/${year}.`,
      },
    ],
  });

  const latencyMs = Date.now() - startMs;

  await trackTokenUsage(
    userId,
    model,
    response.usage.input_tokens,
    response.usage.output_tokens,
    "plan_calendar_generation",
  );

  logger.info("plan_calendar_generated", {
    userId,
    model,
    role: ModelRole.AgentReasoning,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    latencyMs,
    postsPerMonth,
  });

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Claude returned no text content for calendar generation.");
  }

  let calendar: CalendarItem[];
  try {
    calendar = JSON.parse(textBlock.text) as CalendarItem[];
  } catch (parseErr) {
    logger.error("plan_calendar_json_parse_failed", {
      error: String(parseErr),
      rawResponse: textBlock.text.slice(0, 500),
      userId,
    });
    throw new Error(
      "Failed to parse calendar response from Claude. " +
        "The model did not return valid JSON.",
    );
  }

  return calendar;
}

// ── Incorporate Arab Calendar ────────────────────────────────────

function incorporateArabCalendar(
  contentCalendar: CalendarItem[],
  month: number,
  year: number,
  country: string = "egypt",
): { calendar: CalendarItem[]; occasions: string[] } {
  const occasions: Occasion[] = getOccasions(month, year, country);
  const occasionNames = occasions.map((o) => o.arabicName);

  if (occasions.length === 0) {
    return { calendar: contentCalendar, occasions: [] };
  }

  // Check how many occasion posts already exist
  const existingOccasionPosts = contentCalendar.filter(
    (item) => item.isOccasion,
  );

  const minimumOccasionPosts = 2;
  const needed = Math.max(
    0,
    minimumOccasionPosts - existingOccasionPosts.length,
  );

  if (needed === 0) {
    return { calendar: contentCalendar, occasions: occasionNames };
  }

  // Inject occasion posts for occasions not yet covered
  const injected: CalendarItem[] = [];
  for (let i = 0; i < Math.min(needed, occasions.length); i++) {
    const occ = occasions[i];
    const dateStr = occ.date.toISOString().split("T")[0];

    injected.push({
      date: dateStr,
      platform: "instagram",
      contentType: ContentType.Post,
      caption: `🎉 بمناسبة ${occ.arabicName} — كل سنة وانتوا طيبين! 🌙`,
      hashtags: [`#${occ.name.replace(/\s/g, "")}`, `#${occ.arabicName}`],
      designBrief: `تصميم احتفالي بمناسبة ${occ.arabicName}. ألوان البراند مع عناصر بصرية تناسب المناسبة.`,
      isOccasion: true,
      occasionName: occ.arabicName,
    });
  }

  return {
    calendar: [...contentCalendar, ...injected],
    occasions: occasionNames,
  };
}

// ── Generate Plan (Orchestrator) ─────────────────────────────────

async function generatePlan(
  input: GeneratePlanInput,
): Promise<GeneratePlanResult> {
  const { userId, brandId, month, year, postsPerMonth = 25 } = input;
  const userIdStr = String(userId);

  // 1. Validate brand ownership
  const brandDoc = await BrandProfileModel.findOne({
    _id: brandId,
    userId,
  }).lean();

  if (!brandDoc) {
    throw new ApiError(
      404,
      ErrorCode.NotFound,
      "البراند مش موجود أو مش بتاعك.",
    );
  }

  // Normalize nullable Mongoose fields to undefined for service functions
  const brandProfile = {
    businessName: brandDoc.businessName,
    industry: brandDoc.industry,
    description: brandDoc.description ?? undefined,
    targetMarket: brandDoc.targetMarket
      ? {
          country: brandDoc.targetMarket.country ?? undefined,
          city: brandDoc.targetMarket.city ?? undefined,
        }
      : undefined,
    brandDNA: brandDoc.brandDNA
      ? {
          tone: brandDoc.brandDNA.tone ?? undefined,
          personality: brandDoc.brandDNA.personality ?? undefined,
          contentDialect: brandDoc.brandDNA.contentDialect ?? undefined,
          targetAudience: brandDoc.brandDNA.targetAudience
            ? {
                ageRange:
                  brandDoc.brandDNA.targetAudience.ageRange ?? undefined,
                gender: brandDoc.brandDNA.targetAudience.gender ?? undefined,
                interests: brandDoc.brandDNA.targetAudience.interests ?? [],
                painPoints: brandDoc.brandDNA.targetAudience.painPoints ?? [],
                platforms: brandDoc.brandDNA.targetAudience.platforms ?? [],
              }
            : undefined,
        }
      : undefined,
  };

  logger.info("plan_generation_start", {
    userId: userIdStr,
    brandId: String(brandId),
    month,
    year,
    postsPerMonth,
  });

  // 2. Generate strategy
  const strategy = await generateStrategy(brandProfile, month, year, userIdStr);

  // 3. Generate content calendar
  const rawCalendar = await generateContentCalendar(
    strategy,
    brandProfile,
    month,
    year,
    postsPerMonth,
    userIdStr,
  );

  // 4. Inject Egyptian/Arab cultural occasions (≥2 per month)
  const country = brandProfile.targetMarket?.country || "egypt";
  const { calendar, occasions } = incorporateArabCalendar(
    rawCalendar,
    month,
    year,
    country,
  );

  // 5. Persist to DB
  const result = await savePlan(
    userIdStr,
    String(brandId),
    month,
    year,
    strategy,
    calendar,
    occasions,
  );

  logger.info("plan_generation_complete", {
    userId: userIdStr,
    brandId: String(brandId),
    planId: result.planId,
    totalItems: calendar.length,
    occasionCount: occasions.length,
  });

  return result;
}

// ── Save Plan to DB ──────────────────────────────────────────────

async function savePlan(
  userId: string,
  brandId: string,
  month: number,
  year: number,
  strategy: StrategyResult,
  calendar: CalendarItem[],
  occasions: string[],
): Promise<GeneratePlanResult> {
  const plan = await MarketingPlanModel.create({
    userId,
    brandId,
    month,
    year,
    status: PlanStatusType.Draft,
    strategy,
    egyptianOccasions: occasions,
  });

  const contentDocs = calendar.map((item) => ({
    planId: plan._id,
    userId,
    brandId,
    date: new Date(item.date),
    platform: item.platform,
    contentType: item.contentType,
    caption: item.caption,
    hashtags: item.hashtags,
    designBrief: item.designBrief,
    status: ContentStatus.PendingGeneration,
    idempotencyKey: `${plan._id}-${item.date}-${item.platform}-${item.contentType}`,
  }));

  await ContentItemModel.insertMany(contentDocs);

  return {
    planId: String(plan._id),
    strategy,
    contentItems: calendar,
    egyptianOccasions: occasions,
  };
}

// ── Exports ──────────────────────────────────────────────────────

export const planService = {
  generatePlan,
  generateStrategy,
  generateContentCalendar,
  incorporateArabCalendar,
};
