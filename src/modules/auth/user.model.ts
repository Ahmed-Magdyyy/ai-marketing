// ─────────────────────────────────────────────────────────────────
// User Mongoose Model — maps to the User schema in CLAUDE.md
// ─────────────────────────────────────────────────────────────────

import mongoose, { Schema, Document } from "mongoose";
import bcrypt from "bcrypt";
import {
  PlanTier,
  BillingCycle,
  PlanStatus,
  UserRole,
  IUser,
  UserStatus,
  SignupProvider,
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
      index: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      default: "",
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
      default: UserRole.User,
    },
    plan: {
      tier: {
        type: String,
        enum: Object.values(PlanTier),
        default: PlanTier.Free,
      },
      billingCycle: {
        type: String,
        enum: Object.values(BillingCycle),
        default: BillingCycle.Monthly,
      },
      status: {
        type: String,
        enum: Object.values(PlanStatus),
        default: PlanStatus.Active,
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

    // ── Enhanced Auth Fields ──────────────────────────────────
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: [
        "active",
        "inactive",
        "suspended",
        "banned",
      ] satisfies UserStatus[],
      default: "inactive" satisfies UserStatus,
    },
    statusReason: {
      type: String,
      default: "",
    },
    statusChangedAt: {
      type: Date,
      default: undefined,
    },
    statusChangedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: undefined,
    },
    signupProvider: {
      type: String,
      enum: ["email", "google"] satisfies SignupProvider[],
      default: "email" satisfies SignupProvider,
    },
    authProviders: [
      {
        provider: {
          type: String,
          required: true,
          enum: ["google"],
        },
        providerUserId: {
          type: String,
          required: true,
        },
        providerEmail: {
          type: String,
          required: true,
        },
        linkedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    passwordChangedAt: {
      type: Date,
      default: undefined,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: { createdAt: "createdAt", updatedAt: false },
  },
);

// ── Password comparison method ───────────────────────────────────
userSchema.methods.comparePassword = async function (
  candidatePassword: string,
): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

// ── Compound sparse unique index for authProviders ──────────────
// Prevents the same provider account from being linked to multiple users
userSchema.index(
  { "authProviders.provider": 1, "authProviders.providerUserId": 1 },
  { unique: true, sparse: true },
);

// ── Soft-delete query middleware ─────────────────────────────────
// Automatically exclude soft-deleted users from all find queries
// eslint-disable-next-line @typescript-eslint/no-explicit-any
userSchema.pre(/^find/, function (this: any) {
  if (this.getFilter().deletedAt === undefined) {
    this.where({ deletedAt: null });
  }
});

const UserModel = mongoose.model<IUserDocument>("User", userSchema);

export { UserModel };
