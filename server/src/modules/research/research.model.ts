import { Schema, InferSchemaType, model } from "mongoose";
import { ResearchJobStatus, ScrapingTier } from "../../shared/types";

// ─────────────────────────────────────────────────────────────────
// Research Job — standalone collection for competitor research runs.
// Tracks scrape lifecycle: pending → scraping → analyzing → completed | failed.
// One document per research request (single-page or deep crawl).
// ─────────────────────────────────────────────────────────────────

const researchJobSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    brandProfileId: {
      type: Schema.Types.ObjectId,
      ref: "BrandProfile",
      required: true,
    },
    url: { type: String, required: true },
    domain: { type: String, required: true },
    status: {
      type: String,
      enum: Object.values(ResearchJobStatus),
      default: ResearchJobStatus.Pending,
      required: true,
    },
    jobId: { type: String }, // BullMQ job ID — set when enqueued
    scrapingTier: {
      type: Number,
      enum: Object.values(ScrapingTier).filter(
        (v): v is number => typeof v === "number",
      ),
      default: ScrapingTier.Fast,
    },
    pagesScraped: { type: Number, default: 0 },
    rawText: { type: String, default: "" },
    analysis: { type: Schema.Types.Mixed, default: {} },
    error: { type: String, default: "" },
    scrapedAt: { type: Date },
    analyzedAt: { type: Date },
  },
  {
    timestamps: true, // adds createdAt + updatedAt automatically
  },
);

// ── Indexes ──────────────────────────────────────────────────────
// 1. User's research history (newest first)
researchJobSchema.index({ userId: 1, createdAt: -1 });

// 2. Per-brand domain lookup (find existing research for same competitor)
researchJobSchema.index({ brandProfileId: 1, domain: 1 });

// 3. BullMQ job lookup (unique sparse — only set when job is enqueued)
researchJobSchema.index({ jobId: 1 }, { unique: true, sparse: true });

export type ResearchJob = InferSchemaType<typeof researchJobSchema>;
export const ResearchJobModel = model<ResearchJob>(
  "ResearchJob",
  researchJobSchema,
);
