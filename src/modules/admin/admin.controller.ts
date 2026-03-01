// ─────────────────────────────────────────────────────────────────
// Admin Controller — user management handlers
// ─────────────────────────────────────────────────────────────────

import { Request, Response } from "express";
import { adminService } from "./admin.service";
import { asyncHandler } from "../../shared/utils/asyncHandler";
import { ApiError } from "../../shared/utils/ApiError";
import { ErrorCode, SuccessCode, UserStatus } from "../../shared/types";
import { sendSuccess } from "../../shared/utils/apiResponse";

// ── List Users ──────────────────────────────────────────────────

export const listUsersHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10));
    const limit = Math.min(
      100,
      Math.max(1, parseInt(String(req.query.limit ?? "20"), 10)),
    );
    const status = req.query.status
      ? (String(req.query.status) as UserStatus)
      : undefined;
    const search = req.query.search ? String(req.query.search) : undefined;

    const result = await adminService.listUsers({
      page,
      limit,
      status,
      search,
    });

    return sendSuccess(res, result, 200, SuccessCode.Ok, req);
  },
);

// ── Get User By ID ──────────────────────────────────────────────

export const getUserHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const userId = String(req.params.userId);
    if (!userId) {
      throw new ApiError(400, ErrorCode.ValidationError);
    }

    const user = await adminService.getUserById(userId);

    return sendSuccess(res, { user }, 200, SuccessCode.Ok, req);
  },
);

// ── Update User Status ──────────────────────────────────────────

export const updateUserStatusHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const userId = String(req.params.userId);
    if (!userId) {
      throw new ApiError(400, ErrorCode.ValidationError);
    }

    const adminId = req.user?._id?.toString();
    if (!adminId) {
      throw new ApiError(401, ErrorCode.Unauthorized);
    }

    const { status, reason } = req.body as {
      status: UserStatus;
      reason?: string;
    };

    if (
      !status ||
      !["active", "inactive", "suspended", "banned"].includes(status)
    ) {
      throw new ApiError(400, ErrorCode.ValidationError);
    }

    const user = await adminService.updateUserStatus(
      userId,
      status,
      adminId,
      reason,
    );

    const successCode =
      status === "suspended"
        ? SuccessCode.UserSuspended
        : SuccessCode.UserActivated;

    return sendSuccess(res, { user }, 200, successCode, req);
  },
);

// ── Soft Delete User ────────────────────────────────────────────

export const deleteUserHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const userId = String(req.params.userId);
    if (!userId) {
      throw new ApiError(400, ErrorCode.ValidationError);
    }

    const adminId = req.user?._id?.toString();
    if (!adminId) {
      throw new ApiError(401, ErrorCode.Unauthorized);
    }

    await adminService.softDeleteUser(userId, adminId);

    return sendSuccess(res, null, 200, SuccessCode.Deleted, req);
  },
);

// ── Hard Delete User ────────────────────────────────────────────

export const hardDeleteUserHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const userId = String(req.params.userId);
    const adminId = req.user?._id?.toString();
    if (!adminId) {
      throw new ApiError(401, ErrorCode.Unauthorized);
    }

    const { confirm } = req.body as { confirm: string };
    await adminService.hardDeleteUser(userId, adminId, confirm);

    return sendSuccess(res, null, 200, SuccessCode.AccountDeleted, req);
  },
);

// ── Admin Reset User Password ───────────────────────────────────

export const adminResetPasswordHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const userId = String(req.params.userId);
    const adminId = req.user?._id?.toString();
    if (!adminId) {
      throw new ApiError(401, ErrorCode.Unauthorized);
    }

    const { newPassword } = req.body as { newPassword: string };
    if (!newPassword || newPassword.length < 8) {
      throw new ApiError(400, ErrorCode.ValidationError);
    }

    await adminService.adminResetUserPassword(userId, adminId, newPassword);

    return sendSuccess(res, null, 200, SuccessCode.PasswordResetByAdmin, req);
  },
);
