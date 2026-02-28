import { Request, Response } from "express";
import { asyncHandler } from "../../shared/utils/asyncHandler";
import { sendSuccess, sendError } from "../../shared/utils/apiResponse";
import { ErrorCode, IBrandProfile } from "../../shared/types";
import { chat } from "./agent.service";
import { BrandProfileModel } from "../brand/brand.model";

export const chatHandler = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?._id?.toString();
  if (!userId) {
    return sendError(res, 401, ErrorCode.Unauthorized, req);
  }

  const {
    userMessage,
    brandId,
    fileIds,
    socketId,
  }: {
    userMessage: string;
    brandId?: string;
    fileIds?: string[];
    socketId?: string;
  } = req.body;

  if (!userMessage || userMessage.trim().length === 0) {
    return sendError(res, 400, ErrorCode.ValidationError, req);
  }

  let brandProfile: IBrandProfile | null = null;

  if (brandId) {
    const brand = await BrandProfileModel.findById(brandId).lean();

    if (!brand) {
      return sendError(res, 404, ErrorCode.NotFound, req);
    }

    if (brand.userId.toString() !== userId) {
      return sendError(res, 403, ErrorCode.Forbidden, req);
    }

    // lean() returns a POJO — cast to IBrandProfile (ObjectId fields serialize via toString)
    brandProfile = brand as unknown as IBrandProfile;
  }

  const { reply, inputTokens, outputTokens } = await chat(
    userId,
    userMessage,
    brandProfile,
    fileIds,
    socketId,
  );

  return sendSuccess(res, { reply, inputTokens, outputTokens });
});
