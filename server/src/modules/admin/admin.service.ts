// ─────────────────────────────────────────────────────────────────
// Admin Service — user management operations
// ─────────────────────────────────────────────────────────────────

import mongoose from "mongoose";
import bcrypt from "bcrypt";
import { UserModel, IUserDocument } from "../auth/user.model";
import { BrandProfileModel } from "../brand/brand.model";
import { ConversationMessageModel } from "../agent/message.model";
import { UploadedFileModel } from "../upload/upload.model";
import { AiUsageLog as AiUsageLogModel } from "../../shared/models/AiUsageLog.model";
import { deleteFromStorage } from "../../shared/config/r2";
import { ApiError } from "../../shared/utils/ApiError";
import { ErrorCode, UserStatus } from "../../shared/types";
import { logger } from "../../shared/utils/logger";

const SALT_ROUNDS = 12;

// ── List Users ──────────────────────────────────────────────────

interface ListUsersInput {
  page: number;
  limit: number;
  status?: UserStatus;
  search?: string;
}

interface ListUsersResult {
  users: IUserDocument[];
  total: number;
  page: number;
  totalPages: number;
}

async function listUsers(input: ListUsersInput): Promise<ListUsersResult> {
  const { page, limit, status, search } = input;
  const skip = (page - 1) * limit;

  const filter: Record<string, unknown> = {};

  if (status) {
    filter.status = status;
  }

  if (search) {
    filter.$or = [
      { email: { $regex: search, $options: "i" } },
      { name: { $regex: search, $options: "i" } },
    ];
  }

  const [users, total] = await Promise.all([
    UserModel.find(filter)
      .select("-passwordHash -refreshToken")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    UserModel.countDocuments(filter),
  ]);

  return {
    users,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

// ── Get User By ID ──────────────────────────────────────────────

async function getUserById(userId: string): Promise<IUserDocument> {
  const user = await UserModel.findById(userId).select(
    "-passwordHash -refreshToken",
  );
  if (!user) {
    throw new ApiError(404, ErrorCode.NotFound);
  }
  return user;
}

// ── Update User Status ──────────────────────────────────────────

async function updateUserStatus(
  userId: string,
  status: UserStatus,
  adminId: string,
  reason?: string,
): Promise<IUserDocument> {
  const user = await UserModel.findById(userId);
  if (!user) {
    throw new ApiError(404, ErrorCode.NotFound);
  }

  user.status = status;
  user.statusReason = reason || "";
  user.statusChangedAt = new Date();
  user.statusChangedBy = adminId;
  await user.save();

  logger.info("admin_status_changed", {
    adminId,
    userId,
    status,
    reason,
  });

  return user;
}

// ── Soft Delete User ────────────────────────────────────────────

async function softDeleteUser(userId: string, adminId: string): Promise<void> {
  const user = await UserModel.findById(userId);
  if (!user) {
    throw new ApiError(404, ErrorCode.NotFound);
  }

  user.deletedAt = new Date();
  user.status = "inactive";
  user.statusReason = "Deleted by admin";
  user.statusChangedAt = new Date();
  user.statusChangedBy = adminId;
  await user.save();

  logger.info("admin_user_soft_deleted", { adminId, userId });
}

// ── Hard Delete User ────────────────────────────────────────────

async function hardDeleteUser(
  userId: string,
  adminId: string,
  confirmPhrase: string,
): Promise<void> {
  if (confirmPhrase !== "DELETE_PERMANENTLY") {
    throw new ApiError(400, ErrorCode.ValidationError);
  }

  // Log BEFORE deletion
  logger.warn("admin_hard_delete_user", { adminId, userId });

  await AiUsageLogModel.deleteMany({ userId });

  // 1. Delete conversation messages
  await ConversationMessageModel.deleteMany({ userId });

  // 2. Delete uploaded files (also remove from R2/B2 storage)
  const files = await UploadedFileModel.find({ userId });
  for (const file of files) {
    try {
      await deleteFromStorage(file.r2Key);
    } catch (err) {
      logger.error("hard_delete_storage_cleanup_failed", {
        userId,
        r2Key: file.r2Key,
        error: String(err),
      });
    }
  }
  await UploadedFileModel.deleteMany({ userId });

  // 3. Delete brand profiles
  await BrandProfileModel.deleteMany({ userId });

  // 4. Delete the user document (bypass soft-delete middleware)
  await UserModel.deleteOne({ _id: userId });
}

// ── Admin Reset User Password ───────────────────────────────────

async function adminResetUserPassword(
  userId: string,
  adminId: string,
  newPassword: string,
): Promise<void> {
  const rawUser = await UserModel.collection.findOne({
    _id: new mongoose.Types.ObjectId(userId),
  });
  if (!rawUser) throw new ApiError(404, ErrorCode.NotFound);

  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await UserModel.updateOne(
    { _id: userId },
    { $set: { passwordHash, passwordChangedAt: new Date(), refreshToken: "" } },
  );
  logger.warn("admin_reset_user_password", { adminId, userId });
}

export const adminService = {
  listUsers,
  getUserById,
  updateUserStatus,
  softDeleteUser,
  hardDeleteUser,
  adminResetUserPassword,
};
