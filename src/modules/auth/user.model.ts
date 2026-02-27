// ─────────────────────────────────────────────────────────────────
// User Mongoose Model — maps to the User schema in CLAUDE.md
// ─────────────────────────────────────────────────────────────────

import mongoose, { Schema, Document } from "mongoose";
import bcrypt from "bcryptjs";
import {
  PlanTier,
  BillingCycle,
  PlanStatus,
  UserRole,
  IUser,
} from "../../shared/types";

export interface IUserDocument extends Omit<IUser, "_id">, Document {
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const userSchema = new Schema<IUserDocument>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    phone: {
      type: String,
      default: "",
    },
    lang: {
      type: String,
      enum: ["ar", "en"],
      default: "ar",
    },
    role: {
      type: String,
      enum: Object.values(UserRole),
      default: UserRole.USER,
    },
    plan: {
      tier: {
        type: String,
        enum: Object.values(PlanTier),
        default: PlanTier.FREE,
      },
      billingCycle: {
        type: String,
        enum: Object.values(BillingCycle),
        default: BillingCycle.MONTHLY,
      },
      status: {
        type: String,
        enum: Object.values(PlanStatus),
        default: PlanStatus.ACTIVE,
      },
      currentPeriodEnd: {
        type: Date,
        default: (): Date => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      },
      paymobSubscriptionId: {
        type: String,
        default: "",
      },
    },
    limits: {
      brandsAllowed: { type: Number, default: 1 },
      postsPerMonth: { type: Number, default: 10 },
      imagesPerMonth: { type: Number, default: 5 },
      videosPerMonth: { type: Number, default: 0 },
      voiceoversPerMonth: { type: Number, default: 0 },
      designsPerMonth: { type: Number, default: 0 },
      competitorResearchPerMonth: { type: Number, default: 0 },
      platforms: { type: [String], default: ["instagram"] },
      agentMemoryMonths: { type: Number, default: 1 },
      prioritySupport: { type: Boolean, default: false },
    },
    usage: {
      postsGenerated: { type: Number, default: 0 },
      imagesGenerated: { type: Number, default: 0 },
      videosGenerated: { type: Number, default: 0 },
      voiceoversGenerated: { type: Number, default: 0 },
      designsGenerated: { type: Number, default: 0 },
      competitorResearchRuns: { type: Number, default: 0 },
      resetAt: {
        type: Date,
        default: (): Date => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    },
    refreshToken: {
      type: String,
      default: undefined,
    },
    lastLoginAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: { createdAt: "createdAt", updatedAt: false },
  },
);

// ── Index for email lookups ──────────────────────────────────────
userSchema.index({ email: 1 }, { unique: true });

// ── Password comparison method ───────────────────────────────────
userSchema.methods.comparePassword = async function (
  candidatePassword: string,
): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

const UserModel = mongoose.model<IUserDocument>("User", userSchema);

export { UserModel };
