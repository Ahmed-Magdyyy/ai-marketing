import { Router } from "express";
import multer from "multer";
import { UploadController } from "./upload.controller";
import { authMiddleware } from "../auth/auth.middleware";
import { asyncHandler } from "../../shared/utils/asyncHandler";

const uploadRouter = Router();

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    // We enforce 50MB globally here; finer-grained logic is in the service.
    fileSize: 50 * 1024 * 1024,
  },
});

/**
 * POST /api/upload
 * Requires auth token.
 * Accepts up to 5 files under the field "files".
 */
uploadRouter.post(
  "/",
  authMiddleware,
  upload.array("files", 5),
  asyncHandler(UploadController.uploadFiles),
);

export { uploadRouter };
