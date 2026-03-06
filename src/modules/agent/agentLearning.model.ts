// ─────────────────────────────────────────────────────────────────
// AgentLearning Mongoose Model
// MongoDB metadata store for agent memories. Each document mirrors
// a vector stored in Qdrant (linked by qdrantPointId).
//
// Indexes:
//   { userId, brandId, createdAt } — filtered memory queries + pruning
//   { qdrantPointId }              — unique lookup for Qdrant↔Mongo sync
// ─────────────────────────────────────────────────────────────────

import mongoose, { Schema } from "mongoose";
import type { IAgentLearning } from "../../shared/types";
import { MemoryCategory, LearningSource } from "../../shared/types";

const agentLearningSchema = new Schema<IAgentLearning>(
  {
    userId: { type: String, required: true },
    brandId: { type: String, required: true },
    content: { type: String, required: true },
    category: {
      type: String,
      enum: Object.values(MemoryCategory),
      required: true,
    },
    source: {
      type: String,
      enum: Object.values(LearningSource),
      required: true,
    },
    qdrantPointId: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  {
    // Write-once documents — no updatedAt needed
    timestamps: false,
  },
);

// ── Indexes ──────────────────────────────────────────────────────
// Per-brand memory queries and time-based pruning
agentLearningSchema.index({ userId: 1, brandId: 1, createdAt: -1 });
// Unique Qdrant↔Mongo link
agentLearningSchema.index({ qdrantPointId: 1 }, { unique: true });

export const AgentLearningModel = mongoose.model<IAgentLearning>(
  "AgentLearning",
  agentLearningSchema,
);
