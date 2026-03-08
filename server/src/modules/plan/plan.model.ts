import { Schema, InferSchemaType, model } from "mongoose";
import {
  PlanStatusType,
  ContentStatus,
  ContentType,
  AssetType,
} from "../../shared/types";

// ─────────────────────────────────────────────────────────────────
// MarketingPlan — header document only.
// ContentItems live in a separate collection (not embedded).
// CLAUDE.md Schema Rule: embedded content arrays will hit 16MB
// document limit for active plans with 30+ posts + assets.
// ─────────────────────────────────────────────────────────────────

const strategySchema = new Schema(
  {
    objective: { type: String, required: true },
    keyMessages: { type: [String], default: [] },
    contentPillars: { type: [String], default: [] },
    platforms: { type: [String], default: [] },
    postingFrequency: { type: Schema.Types.Mixed, default: {} },
  },
  { _id: false },
);

const marketingPlanSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    brandId: {
      type: Schema.Types.ObjectId,
      ref: "BrandProfile",
      required: true,
    },
    month: { type: Number, required: true, min: 1, max: 12 },
    year: { type: Number, required: true, min: 2024, max: 2030 },
    status: {
      type: String,
      enum: Object.values(PlanStatusType),
      default: PlanStatusType.Draft,
      required: true,
    },
    strategy: { type: strategySchema, required: true },
    egyptianOccasions: { type: [String], default: [] },
    approvedAt: { type: Date },
  },
  {
    timestamps: true,
  },
);

// ── MarketingPlan Indexes ────────────────────────────────────────
marketingPlanSchema.index({ userId: 1, createdAt: -1 });
marketingPlanSchema.index(
  { userId: 1, brandId: 1, month: 1, year: 1 },
  { unique: true },
);

export type MarketingPlan = InferSchemaType<typeof marketingPlanSchema>;
export const MarketingPlanModel = model<MarketingPlan>(
  "MarketingPlan",
  marketingPlanSchema,
);

// ─────────────────────────────────────────────────────────────────
// ContentItem — one document per post in the calendar.
// Separate collection from MarketingPlan, linked by planId.
// ─────────────────────────────────────────────────────────────────

const contentAssetSchema = new Schema(
  {
    type: {
      type: String,
      enum: Object.values(AssetType),
      required: true,
    },
    url: { type: String, required: true },
  },
  { _id: false },
);

const contentItemSchema = new Schema(
  {
    planId: {
      type: Schema.Types.ObjectId,
      ref: "MarketingPlan",
      required: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    brandId: {
      type: Schema.Types.ObjectId,
      ref: "BrandProfile",
      required: true,
    },
    date: { type: Date, required: true },
    platform: { type: String, required: true },
    contentType: {
      type: String,
      enum: Object.values(ContentType),
      required: true,
    },
    caption: { type: String, default: "" },
    hashtags: { type: [String], default: [] },
    designBrief: { type: String, default: "" },
    assets: { type: [contentAssetSchema], default: [] },
    status: {
      type: String,
      enum: Object.values(ContentStatus),
      default: ContentStatus.PendingGeneration,
      required: true,
    },
    scheduledAt: { type: Date },
    postedAt: { type: Date },
    metrics: { type: Schema.Types.Mixed, default: {} },
    idempotencyKey: { type: String },
  },
  {
    timestamps: true,
  },
);

// ── ContentItem Indexes ──────────────────────────────────────────
contentItemSchema.index({ planId: 1, date: 1 });
contentItemSchema.index({ userId: 1, status: 1, scheduledAt: 1 });

export type ContentItem = InferSchemaType<typeof contentItemSchema>;
export const ContentItemModel = model<ContentItem>(
  "ContentItem",
  contentItemSchema,
);
