import { Schema, InferSchemaType, model } from "mongoose";

// ── UploadedFile Schema ───────────────────────────────────────────
// Stores metadata for files uploaded by users (documents for context
// injection, and brand assets like logos/images).
// Text is extracted from documents (PDF/Word/Excel) and stored in
// extractedText for agent context injection.
// Binary images (.png/.jpg) and design files (.psd/.ai/.eps) have
// extractedText = null.

const uploadedFileSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    filename: { type: String, required: true },
    mimeType: { type: String, required: true },
    assetType: {
      type: String,
      enum: ["document", "brand_asset"],
      required: true,
    },
    extractedText: { type: String, default: null },
    r2Key: { type: String, required: true },
    fileSizeBytes: { type: Number, required: true },
    parseWarning: { type: String, default: null },
    createdAt: { type: Date, default: Date.now },
  },
  {
    timestamps: false,
  },
);

// ── Indexes: fast user-file lookups ───────────────────────────────
uploadedFileSchema.index({ userId: 1, createdAt: -1 });
uploadedFileSchema.index({ userId: 1, assetType: 1 });

export type UploadedFile = InferSchemaType<typeof uploadedFileSchema>;
export const UploadedFileModel = model<UploadedFile>(
  "UploadedFile",
  uploadedFileSchema,
);
