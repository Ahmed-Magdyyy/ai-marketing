import { Request, Response } from "express";
import { brandService } from "./brand.service";
import { asyncHandler } from "../../shared/utils/asyncHandler";
import { ErrorCode } from "../../shared/types";
import { sendSuccess, sendError } from "../../shared/utils/apiResponse";
import { IUserDocument } from "../auth/user.model";

export const createBrand = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const user = req.user as IUserDocument;
    const userId = user._id;
    const { businessName, industry, description, brandDNA } = req.body;

    if (!businessName || !industry) {
      return sendError(res, 400, ErrorCode.ValidationError, req);
    }

    try {
      const newBrand = await brandService.createBrand({
        userId,
        businessName,
        industry,
        description,
        brandDNA,
      });

      return sendSuccess(res, newBrand, "Created successfully", 201);
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

export const updateBrand = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const user = req.user as IUserDocument;
    const userId = user._id;
    const brandId = req.params.id;

    if (!brandId || typeof brandId !== "string" || brandId.length !== 24) {
      return sendError(res, 400, ErrorCode.NotFound, req);
    }

    try {
      const updatedBrand = await brandService.updateBrand(
        userId,
        brandId,
        req.body,
      );

      return sendSuccess(res, updatedBrand);
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

export const getBrand = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const user = req.user as IUserDocument;
    const userId = user._id;
    const brandId = req.params.id;

    if (!brandId || typeof brandId !== "string" || brandId.length !== 24) {
      return sendError(res, 400, ErrorCode.NotFound, req);
    }

    try {
      const brand = await brandService.getBrand(userId, brandId);
      return sendSuccess(res, brand);
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
