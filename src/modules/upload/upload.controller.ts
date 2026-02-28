import { Request, Response, NextFunction } from "express";
import { UploadService } from "./upload.service";
import { UploadedFileModel } from "./upload.model";
import { sendSuccess } from "../../shared/utils/apiResponse";
import { ApiError } from "../../shared/utils/ApiError";
import { ErrorCode } from "../../shared/types";
import { logger } from "../../shared/utils/logger";

export class UploadController {
  /**
   * Handles multi-file uploads.
   * Max 5 files per request. Handled by multer in the routes.
   * POST /api/upload
   */
  public static async uploadFiles(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const authUser = req.user;
      if (!authUser || !authUser._id) {
        throw new ApiError(
          401,
          ErrorCode.Unauthorized,
          "User not authenticated.",
        );
      }

      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        throw new ApiError(
          400,
          ErrorCode.ValidationError,
          "No files uploaded.",
        );
      }

      if (files.length > 5) {
        throw new ApiError(
          400,
          ErrorCode.ValidationError,
          "Maximum 5 files allowed per request.",
        );
      }

      const uploadResults = [];

      for (const file of files) {
        // 1. Process and upload to R2
        const processed = await UploadService.processFile({
          userId: authUser._id.toString(),
          filename: file.originalname,
          mimeType: file.mimetype,
          buffer: file.buffer,
          size: file.size,
        });

        // 2. Save metadata to MongoDB
        const newDoc = new UploadedFileModel({
          userId: authUser._id.toString(),
          filename: processed.filename,
          mimeType: processed.mimeType,
          assetType: processed.assetType,
          extractedText: processed.extractedText,
          r2Key: processed.r2Key,
          fileSizeBytes: processed.fileSizeBytes,
          parseWarning: processed.parseWarning,
        });

        const savedDoc = await newDoc.save();

        uploadResults.push({
          fileId: savedDoc._id.toString(),
          filename: processed.filename,
          mimeType: processed.mimeType,
          assetType: processed.assetType,
          extractedText: processed.extractedText,
          parseWarning: processed.parseWarning,
          r2Key: processed.r2Key,
        });
      }

      logger.info(
        `User ${authUser._id.toString()} uploaded ${files.length} files successfully.`,
      );

      sendSuccess(res, uploadResults, "Files uploaded successfully.");
    } catch (error) {
      next(error);
    }
  }
}
