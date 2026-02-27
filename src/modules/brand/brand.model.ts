import { Schema, InferSchemaType, model } from "mongoose";
import { ArabicDialect } from "../../shared/types";

const competitorSchema = new Schema({
  name: { type: String, required: true },
  website: { type: String },
  socialUrls: { type: [String], default: [] },
  crawlId: { type: String },
  identifiedAt: { type: Date, default: Date.now },
  insights: { type: String },
});

const socialAccountSchema = new Schema({
  platform: {
    type: String,
    enum: ["facebook", "instagram", "tiktok", "twitter", "youtube"],
    required: true,
  },
  accountId: { type: String, required: true },
  accountHandle: { type: String },
  accessToken: { type: String, required: true }, // Encrypted
  connectedAt: { type: Date, default: Date.now },
});

const targetAudienceSchema = new Schema({
  ageRange: { type: String },
  gender: { type: String },
  interests: { type: [String], default: [] },
  painPoints: { type: [String], default: [] },
  platforms: { type: [String], default: [] },
});

const brandDNASchema = new Schema({
  contentDialect: {
    type: String,
    enum: Object.values(ArabicDialect),
    default: ArabicDialect.Egyptian,
  },
  colors: { type: [String], default: [] },
  fonts: { type: [String], default: [] },
  tone: { type: String },
  personality: { type: String },
  uvp: { type: String },
  targetAudience: { type: targetAudienceSchema },
  competitors: { type: [competitorSchema], default: [] },
});

const brandProfileSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    businessName: { type: String, required: true },
    industry: { type: String, required: true },
    description: { type: String },
    website: { type: String },
    onboardingComplete: { type: Boolean, default: false },
    targetMarket: {
      country: { type: String },
      city: { type: String },
    },
    brandDNA: {
      type: brandDNASchema,
      default: () => ({}),
    },
    socialAccounts: { type: [socialAccountSchema], default: [] },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
  },
);

export type BrandProfile = InferSchemaType<typeof brandProfileSchema>;
export const BrandProfileModel = model<BrandProfile>(
  "BrandProfile",
  brandProfileSchema,
);
