// ─────────────────────────────────────────────────────────────────
// Research Controller — request handlers for competitor research.
// POST /api/research/crawl       — enqueue deep crawl
// POST /api/research/scrape      — single-page scrape
// GET  /api/research/job/:jobId  — poll job status
// ─────────────────────────────────────────────────────────────────

import { Request, Response } from "express";
import { researchService } from "./research.service";
import { deepCrawlSchema, scrapeSingleSchema } from "./research.validation";
import { asyncHandler } from "../../shared/utils/asyncHandler";
import { ApiError } from "../../shared/utils/ApiError";
import { ErrorCode, SuccessCode, ScrapingTier } from "../../shared/types";
import { sendSuccess, sendCreated } from "../../shared/utils/apiResponse";
import { IUserDocument } from "../auth/user.model";

// ── POST /api/research/crawl ─────────────────────────────────────

export const enqueueDeepCrawl = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { error, value } = deepCrawlSchema.validate(req.body, {
      abortEarly: false,
    });
    if (error) {
      throw new ApiError(
        400,
        ErrorCode.ValidationError,
        error.details.map((d) => d.message).join(", "),
      );
    }

    const user = req.user as IUserDocument;
    const result = await researchService.enqueueDeepCrawl({
      userId: user._id,
      brandProfileId: value.brandProfileId,
      url: value.url,
      maxPages: value.maxPages,
      timeCapSeconds: value.timeCapSeconds,
    });

    return sendCreated(res, result, SuccessCode.Created, req);
  },
);

// ── POST /api/research/scrape ────────────────────────────────────

export const scrapeSinglePage = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { error, value } = scrapeSingleSchema.validate(req.body, {
      abortEarly: false,
    });
    if (error) {
      throw new ApiError(
        400,
        ErrorCode.ValidationError,
        error.details.map((d) => d.message).join(", "),
      );
    }

    const user = req.user as IUserDocument;
    const scrapingTier: ScrapingTier = value.tier ?? ScrapingTier.Fast;

    const result = await researchService.scrapeSinglePage(
      user._id,
      value.brandProfileId,
      { url: value.url, tier: scrapingTier },
    );

    return sendSuccess(res, result, 200, SuccessCode.Ok, req);
  },
);

// ── GET /api/research/job/:jobId ─────────────────────────────────

export const getJobStatus = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const jobId = req.params.jobId as string;

    if (!jobId) {
      throw new ApiError(400, ErrorCode.ValidationError, "معرّف الوظيفة مطلوب");
    }

    const user = req.user as IUserDocument;
    const status = await researchService.getJobStatus(jobId, user._id);

    return sendSuccess(res, status, 200, SuccessCode.Ok, req);
  },
);
