// ─────────────────────────────────────────────────────────────────
// Research Service — business logic for competitor research.
// enqueueDeepCrawl() creates a ResearchJob doc + enqueues BullMQ job.
// analyzeCompetitor() calls Claude for competitive intelligence.
// getJobStatus() returns current status for polling.
// ─────────────────────────────────────────────────────────────────

import Anthropic from "@anthropic-ai/sdk";
import { Queue } from "bullmq";
import { Types } from "mongoose";
import { getRedisClient } from "../../shared/config/redis";
import { getModel } from "../../shared/config/models";
import { ResearchJobModel } from "./research.model";
import { ResearchScraper } from "./research.scraper";
import { ApiError } from "../../shared/utils/ApiError";
import { logger } from "../../shared/utils/logger";
import { trackTokenUsage } from "../../shared/utils/aiCostTracker";
import {
  ErrorCode,
  ModelRole,
  ResearchJobStatus,
  ScrapingTier,
  ScrapeOptions,
  ScrapeResult,
} from "../../shared/types";

// ── Anthropic Client ─────────────────────────────────────────────
// Reads ANTHROPIC_API_KEY from process.env automatically.

const anthropic = new Anthropic();

// ── BullMQ Queue ─────────────────────────────────────────────────
// Lazy-initialized to avoid connecting to Redis at import time.

let researchQueue: Queue | null = null;

function getResearchQueue(): Queue {
  if (!researchQueue) {
    researchQueue = new Queue("research:deep-crawl", {
      connection: getRedisClient(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 5_000 },
        removeOnComplete: { count: 200 },
        removeOnFail: { count: 500 },
      },
    });
  }
  return researchQueue;
}

// ── Interfaces ───────────────────────────────────────────────────

interface EnqueueDeepCrawlInput {
  userId: Types.ObjectId | string;
  brandProfileId: Types.ObjectId | string;
  url: string;
  maxPages?: number;
  timeCapSeconds?: number;
}

interface DeepCrawlResult {
  jobId: string;
  researchJobId: string;
}

// ── Service Functions ────────────────────────────────────────────

/**
 * Enqueues a deep crawl job via BullMQ.
 * Creates a ResearchJob document in DB first, then enqueues.
 * Returns the BullMQ jobId + MongoDB document ID for tracking.
 */
async function enqueueDeepCrawl(
  input: EnqueueDeepCrawlInput,
): Promise<DeepCrawlResult> {
  const {
    userId,
    brandProfileId,
    url,
    maxPages = 15,
    timeCapSeconds = 90,
  } = input;

  // Extract domain for deduplication lookups
  let domain: string;
  try {
    domain = new URL(url).hostname;
  } catch {
    throw new ApiError(400, ErrorCode.ValidationError, "Invalid URL provided.");
  }

  // Create the ResearchJob document (status: pending)
  const researchJob = await ResearchJobModel.create({
    userId,
    brandProfileId,
    url,
    domain,
    status: ResearchJobStatus.Pending,
    scrapingTier: ScrapingTier.Fast,
    pagesScraped: 0,
  });

  // Enqueue into BullMQ
  const queue = getResearchQueue();
  const job = await queue.add("deep-crawl", {
    researchJobId: researchJob._id.toString(),
    userId: userId.toString(),
    brandProfileId: brandProfileId.toString(),
    url,
    domain,
    maxPages,
    timeCapSeconds,
  });

  // Store BullMQ job ID back on the document
  researchJob.jobId = job.id!;
  await researchJob.save();

  logger.info("research_deep_crawl_enqueued", {
    researchJobId: researchJob._id.toString(),
    bullmqJobId: job.id,
    url,
    domain,
  });

  return {
    jobId: job.id!,
    researchJobId: researchJob._id.toString(),
  };
}

/**
 * Returns the current status of a research job for polling.
 * Used by GET /api/research/job/:jobId
 */
async function getJobStatus(jobId: string, userId: Types.ObjectId | string) {
  const job = await ResearchJobModel.findOne({ jobId }).lean();

  if (!job) {
    throw new ApiError(404, ErrorCode.NotFound);
  }

  // Ensure the user owns this job
  if (job.userId.toString() !== userId.toString()) {
    throw new ApiError(403, ErrorCode.Forbidden);
  }

  return {
    status: job.status,
    url: job.url,
    domain: job.domain,
    pagesScraped: job.pagesScraped,
    scrapingTier: job.scrapingTier,
    analysis: job.analysis,
    error: job.error,
    scrapedAt: job.scrapedAt,
    analyzedAt: job.analyzedAt,
    createdAt: job.createdAt,
  };
}

/**
 * Single-page scrape — thin wrapper around ResearchScraper.scrapeSingle().
 * Creates a ResearchJob document for audit trail.
 */
async function scrapeSinglePage(
  userId: Types.ObjectId | string,
  brandProfileId: Types.ObjectId | string,
  options: ScrapeOptions,
): Promise<ScrapeResult> {
  let domain: string;
  try {
    domain = new URL(options.url).hostname;
  } catch {
    throw new ApiError(400, ErrorCode.ValidationError, "Invalid URL provided.");
  }

  // Create audit record
  const researchJob = await ResearchJobModel.create({
    userId,
    brandProfileId,
    url: options.url,
    domain,
    status: ResearchJobStatus.Scraping,
    scrapingTier: options.tier || ScrapingTier.Fast,
  });

  try {
    const result = await ResearchScraper.scrapeSingle(options);

    // Update job to completed
    researchJob.status = ResearchJobStatus.Completed;
    researchJob.pagesScraped = 1;
    researchJob.rawText = result.bodyText.slice(0, 50_000);
    researchJob.scrapedAt = new Date();
    await researchJob.save();

    return result;
  } catch (err) {
    researchJob.status = ResearchJobStatus.Failed;
    researchJob.error = String(err);
    await researchJob.save();
    throw err;
  }
}

// ── Competitor Analysis Interfaces ───────────────────────────────

interface BrandContext {
  brandName: string;
  industry: string;
  targetMarket: string;
}

interface CompetitorAnalysis {
  summary: string;
  products: unknown;
  pricing: unknown;
  targetAudience: unknown;
  contentStrategy: unknown;
  strengths: unknown;
  weaknesses: unknown;
  socialPresence: unknown;
  recommendations: unknown;
}

/**
 * Calls Claude (AgentReasoning model) to produce a structured
 * competitive analysis from scraped text.
 * System prompt is in Egyptian Arabic when lang === 'ar'.
 */
async function analyzeCompetitor(
  rawText: string,
  brandContext: BrandContext,
  lang: "ar" | "en",
  userId: string,
): Promise<Record<string, unknown>> {
  const model = getModel(ModelRole.AgentReasoning);

  const systemPrompt =
    lang === "ar"
      ? `انت محلل ذكاء تسويقي متخصص بتساعد وكالة تسويق مصرية.\nاسم البراند اللي بتشتغل معاه: ${brandContext.brandName}\nالصناعة: ${brandContext.industry}\nالسوق المستهدف: ${brandContext.targetMarket}\n\nهتحلل بيانات المنافس اللي جايالك وترجع تحليل تنافسي شامل.\nرجّع JSON object بس — من غير markdown، من غير أي كلام قبله أو بعده.\nالـ JSON لازم يحتوي على الحقول دي: summary, products, pricing, targetAudience, contentStrategy, strengths, weaknesses, socialPresence, recommendations`
      : `You are a marketing intelligence analyst helping a marketing agency.\nBrand: ${brandContext.brandName}\nIndustry: ${brandContext.industry}\nTarget Market: ${brandContext.targetMarket}\n\nAnalyze the competitor data provided and return a comprehensive competitive analysis.\nReturn ONLY a JSON object — no markdown, no preamble, no explanation.\nThe JSON must contain these fields: summary, products, pricing, targetAudience, contentStrategy, strengths, weaknesses, socialPresence, recommendations`;

  const userPrompt = `Analyze this competitor's website content:\n\n${rawText.slice(0, 100_000)}`;

  const startMs = Date.now();

  const response = await anthropic.messages.create({
    model,
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const latencyMs = Date.now() - startMs;

  // ── Cost Tracking ────────────────────────────────────────────
  await trackTokenUsage(
    userId,
    model,
    response.usage.input_tokens,
    response.usage.output_tokens,
    "competitor_analysis",
  );

  logger.info("research_analyze_competitor_complete", {
    userId,
    model,
    role: ModelRole.AgentReasoning,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    latencyMs,
  });

  // ── Extract text from response ───────────────────────────────
  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Claude returned no text content for competitor analysis.");
  }

  // ── Safe JSON parse ──────────────────────────────────────────
  let analysis: CompetitorAnalysis;
  try {
    analysis = JSON.parse(textBlock.text) as CompetitorAnalysis;
  } catch (parseErr) {
    logger.error("research_analyze_competitor_json_parse_failed", {
      error: String(parseErr),
      rawResponse: textBlock.text.slice(0, 500),
      userId,
    });
    throw new Error(
      "Failed to parse competitor analysis response from Claude. " +
        "The model did not return valid JSON.",
    );
  }

  return analysis as unknown as Record<string, unknown>;
}

export const researchService = {
  enqueueDeepCrawl,
  getJobStatus,
  scrapeSinglePage,
  analyzeCompetitor,
  getResearchQueue,
};
