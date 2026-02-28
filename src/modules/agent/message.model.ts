import { Schema, InferSchemaType, model } from "mongoose";
import { ConversationRole } from "../../shared/types";

// ── ConversationMessage Schema ────────────────────────────────────
// Separate collection for agent conversation history.
// CLAUDE.md rule: conversationHistory MUST live in its own collection,
// NOT as an embedded array — embedded arrays hit MongoDB's 16MB limit
// for active long-term clients.
// Query pattern: find({ userId }).sort({ timestamp: -1 }).limit(50)

const conversationMessageSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    role: {
      type: String,
      enum: Object.values(ConversationRole),
      required: true,
    },
    content: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
  },
  {
    timestamps: false,
  },
);

// ── Index: userId + timestamp descending for fast history retrieval ─
conversationMessageSchema.index({ userId: 1, timestamp: -1 });

export type ConversationMessage = InferSchemaType<
  typeof conversationMessageSchema
>;
export const ConversationMessageModel = model<ConversationMessage>(
  "ConversationMessage",
  conversationMessageSchema,
);
