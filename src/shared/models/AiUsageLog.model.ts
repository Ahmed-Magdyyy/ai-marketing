// ─────────────────────────────────────────────────────────────────
// AiUsageLog Mongoose Model
// Separate collection tracking every paid AI API call.
// Used by aiCostTracker.ts and costGuard.middleware.ts.
// ─────────────────────────────────────────────────────────────────

import mongoose, { Schema } from "mongoose";
import type { IAiUsageLog } from "../types";

const aiUsageLogSchema = new Schema<IAiUsageLog>(
  {
    userId: { type: String, required: true },
    model: { type: String, required: true },
    inputTokens: { type: Number },
    outputTokens: { type: Number },
    units: { type: Number }, // for image/video/voiceover
    estimatedCostUSD: { type: Number, required: true },
    context: { type: String, required: true, default: "unknown" },
    timestamp: { type: Date, required: true, default: Date.now },
  },
  {
    // No updatedAt needed — usage logs are write-once
    timestamps: false,
  },
);

// ── Indexes (per CLAUDE.md) ──────────────────────────────────────
// Per-user cost lookups (costGuard, user dashboards)
aiUsageLogSchema.index({ userId: 1, timestamp: -1 });
// Global cost dashboards
aiUsageLogSchema.index({ timestamp: -1 });

export const AiUsageLog = mongoose.model<IAiUsageLog>(
  "AiUsageLog",
  aiUsageLogSchema,
);
