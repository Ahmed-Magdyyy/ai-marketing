import { Request, Response } from "express";
import { clientService } from "./client.service";
import { asyncHandler } from "../../shared/utils/asyncHandler";
import { sendSuccess, sendError } from "../../shared/utils/apiResponse";
import { IUserDocument } from "../auth/user.model";
import { ErrorCode, SuccessCode } from "../../shared/types";

export const getProfile = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const user = req.user as IUserDocument;

    try {
      const profile = await clientService.getProfile(user._id.toString());
      return sendSuccess(res, profile, 200, SuccessCode.Ok, req);
    } catch (error: unknown) {
      if (error instanceof Error && "statusCode" in error) {
        const err = error as { statusCode: number; errorCode?: ErrorCode };
        return sendError(
          res,
          err.statusCode,
          err.errorCode || ErrorCode.InternalError,
          req,
        );
      }
      throw error;
    }
  },
);

export const updateProfile = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const user = req.user as IUserDocument;

    try {
      const updatedProfile = await clientService.updateProfile(
        user._id.toString(),
        req.body,
      );
      return sendSuccess(
        res,
        updatedProfile,
        200,
        SuccessCode.ProfileUpdated,
        req,
      );
    } catch (error: unknown) {
      if (error instanceof Error && "statusCode" in error) {
        const err = error as { statusCode: number; errorCode?: ErrorCode };
        return sendError(
          res,
          err.statusCode,
          err.errorCode || ErrorCode.InternalError,
          req,
        );
      }
      throw error;
    }
  },
);

export const deleteProfile = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const user = req.user as IUserDocument;

    try {
      await clientService.deleteProfile(user._id.toString());
      return sendSuccess(res, null, 200, SuccessCode.Deleted, req);
    } catch (error: unknown) {
      if (error instanceof Error && "statusCode" in error) {
        const err = error as { statusCode: number; errorCode?: ErrorCode };
        return sendError(
          res,
          err.statusCode,
          err.errorCode || ErrorCode.InternalError,
          req,
        );
      }
      throw error;
    }
  },
);
