// ─────────────────────────────────────────────────────────────────
// Research Worker — BullMQ processor for deep-crawl jobs.
// Calls ResearchScraper.deepCrawlAndStream(), emits Socket.io
// events per page, updates ResearchJob status in MongoDB.
// ─────────────────────────────────────────────────────────────────

import { Worker, Job } from "bullmq";
import { getRedisClient } from "../../shared/config/redis";
import { getIO } from "../../shared/utils/socketProvider";
import { logger } from "../../shared/utils/logger";
import { SWITCHES } from "../../shared/middleware/killSwitch.middleware";
import { ResearchJobModel } from "./research.model";
import { researchService } from "./research.service";
import { BrandProfileModel } from "../brand/brand.model";
import { ResearchScraper, NdjsonItem } from "./research.scraper";
import { ResearchJobStatus } from "../../shared/types";

// ── Job Payload ──────────────────────────────────────────────────

interface DeepCrawlJobData {
  researchJobId: string;
  userId: string;
  brandProfileId: string;
  url: string;
  domain: string;
  maxPages: number;
  timeCapSeconds: number;
}

// ── Worker Processor ─────────────────────────────────────────────

async function processDeepCrawl(job: Job<DeepCrawlJobData>): Promise<void> {
  const { researchJobId, userId, url, maxPages, timeCapSeconds } = job.data;

  // ── Kill switch guard ──────────────────────────────────────────
  if (SWITCHES.DISABLE_DEEP_RESEARCH || SWITCHES.READ_ONLY_MODE) {
    await ResearchJobModel.updateOne(
      { _id: researchJobId },
      {
        $set: {
          status: ResearchJobStatus.Failed,
          error: "Service temporarily disabled.",
        },
      },
    );
    throw new Error("KILL_DEEP_RESEARCH is active \u2014 job aborted.");
  }

  const io = getIO();
  const socketRoom = `research:${userId}`;

  logger.info("research_worker_started", {
    researchJobId,
    jobId: job.id,
    url,
    maxPages,
  });

  // ── Transition: pending → scraping ─────────────────────────────
  await ResearchJobModel.updateOne(
    { _id: researchJobId },
    { $set: { status: ResearchJobStatus.Scraping } },
  );

  io.to(socketRoom).emit("research:status", {
    researchJobId,
    status: ResearchJobStatus.Scraping,
    url,
  });

  // ── Stream crawl pages ─────────────────────────────────────────
  let pagesScraped = 0;
  const allText: string[] = [];

  try {
    await ResearchScraper.deepCrawlAndStream(
      url,
      maxPages,
      timeCapSeconds,
      (item: NdjsonItem) => {
        if (item.type === "page") {
          pagesScraped++;

          // Collect raw text for analysis
          if (item.body_text) {
            allText.push(item.body_text.slice(0, 5_000));
          }

          // Real-time progress via Socket.io
          io.to(socketRoom).emit("research:page", {
            researchJobId,
            pageNumber: item.page_number,
            url: item.url,
            title: item.title,
            tier: item.tier,
            pagesScraped,
            maxPages,
          });

          // Update DB progress every 3 pages (avoid excessive writes)
          if (pagesScraped % 3 === 0) {
            ResearchJobModel.updateOne(
              { _id: researchJobId },
              { $set: { pagesScraped } },
            ).catch((err: unknown) => {
              logger.warn("research_worker_progress_update_failed", {
                error: String(err),
                researchJobId,
              });
            });
          }
        } else if (item.type === "error") {
          logger.warn("research_worker_page_error", {
            researchJobId,
            url: item.url,
            error: item.error,
          });

          io.to(socketRoom).emit("research:page_error", {
            researchJobId,
            url: item.url,
            error: item.error,
          });
        } else if (item.type === "checkpoint") {
          logger.info("research_worker_checkpoint", {
            researchJobId,
            pagesScraped: item.pages_scraped,
            reason: item.reason,
          });
        }
      },
    );

    // ── Transition: scraping → analyzing ───────────────────────────
    const rawText = allText.join("\n\n---\n\n").slice(0, 200_000);

    await ResearchJobModel.updateOne(
      { _id: researchJobId },
      {
        $set: {
          status: ResearchJobStatus.Analyzing,
          pagesScraped,
          rawText,
          scrapedAt: new Date(),
        },
      },
    );

    io.to(socketRoom).emit("research:status", {
      researchJobId,
      status: ResearchJobStatus.Analyzing,
      pagesScraped,
    });

    // ── Analyze with Claude ───────────────────────────────────────
    // Fetch BrandProfile for context
    const brand = await BrandProfileModel.findById(job.data.brandProfileId)
      .select("businessName industry targetMarket")
      .lean();

    const brandContext = {
      brandName: brand?.businessName ?? "Unknown",
      industry: brand?.industry ?? "Unknown",
      targetMarket: brand?.targetMarket
        ? `${brand.targetMarket.country ?? ""}${brand.targetMarket.city ? `, ${brand.targetMarket.city}` : ""}`
        : "Egypt",
    };

    // Detect language from brand profile (default Egyptian Arabic)
    const lang: "ar" | "en" = "ar";

    const analysis = await researchService.analyzeCompetitor(
      rawText,
      brandContext,
      lang,
      userId,
    );

    // ── Transition: analyzing → completed ──────────────────────────
    await ResearchJobModel.updateOne(
      { _id: researchJobId },
      {
        $set: {
          status: ResearchJobStatus.Completed,
          analysis,
          analyzedAt: new Date(),
        },
      },
    );

    io.to(socketRoom).emit("research:status", {
      researchJobId,
      status: ResearchJobStatus.Completed,
      pagesScraped,
      analysis,
    });

    logger.info("research_worker_completed", {
      researchJobId,
      pagesScraped,
    });
  } catch (err) {
    // ── Transition: → failed ───────────────────────────────────────
    const errorMessage = String(err);

    await ResearchJobModel.updateOne(
      { _id: researchJobId },
      {
        $set: {
          status: ResearchJobStatus.Failed,
          error: errorMessage,
          pagesScraped,
        },
      },
    );

    io.to(socketRoom).emit("research:status", {
      researchJobId,
      status: ResearchJobStatus.Failed,
      error: errorMessage,
    });

    logger.error("research_worker_failed", {
      researchJobId,
      error: errorMessage,
    });

    // Re-throw so BullMQ can retry (3 attempts, exponential backoff)
    throw err;
  }
}

// ── Worker Bootstrap ─────────────────────────────────────────────
// Called once at startup to register the processor.

let researchWorker: Worker | null = null;

function startResearchWorker(): Worker {
  if (researchWorker) {
    return researchWorker;
  }

  researchWorker = new Worker<DeepCrawlJobData>(
    "research:deep-crawl",
    processDeepCrawl,
    {
      connection: getRedisClient(),
      concurrency: 2, // max 2 crawls in parallel per instance
      limiter: {
        max: 5,
        duration: 60_000, // max 5 jobs per minute (rate limit)
      },
    },
  );

  researchWorker.on("failed", (job, err) => {
    logger.error("research_worker_job_failed", {
      jobId: job?.id,
      error: String(err),
      attemptsMade: job?.attemptsMade,
    });
  });

  researchWorker.on("completed", (job) => {
    logger.info("research_worker_job_completed", {
      jobId: job.id,
    });
  });

  logger.info("research_worker_started", {
    queue: "research:deep-crawl",
    concurrency: 2,
  });

  return researchWorker;
}

async function stopResearchWorker(): Promise<void> {
  if (researchWorker) {
    await researchWorker.close();
    researchWorker = null;
    logger.info("research_worker_stopped");
  }
}

export { startResearchWorker, stopResearchWorker };
