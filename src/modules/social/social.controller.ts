// ─────────────────────────────────────────────────────────────────
// Social Controller — request handlers for social media endpoints.
// GET    /api/social/connect/:platform        — get OAuth URL
// GET    /api/social/callback                 — handle OAuth callback (fixed URL)
// POST   /api/social/publish/:contentItemId   — publish content
// POST   /api/social/schedule/:contentItemId  — schedule content
// GET    /api/social/accounts/:brandId        — list connected accounts
// DELETE /api/social/accounts/:brandId/:platform — disconnect account
// ─────────────────────────────────────────────────────────────────

import { Request, Response } from "express";
import { SocialPlatform } from "../../shared/types";
import { asyncHandler } from "../../shared/utils/asyncHandler";
import { ApiError } from "../../shared/utils/ApiError";
import { ErrorCode, SuccessCode } from "../../shared/types";
import { sendSuccess } from "../../shared/utils/apiResponse";
import { getProvider } from "./providers/provider-registry";
import type { OAuthState } from "./providers/social-provider.interface";
import {
  publishContent,
  scheduleContent,
  connectAccount,
  disconnectAccount,
  listConnectedAccounts,
} from "./social.service";
import {
  connectPlatformSchema,
  scheduleContentSchema,
  platformParamSchema,
  contentItemIdParamSchema,
  brandIdParamSchema,
  disconnectParamSchema,
} from "./social.validation";
import { IUserDocument } from "../auth/user.model";
import { logger } from "../../shared/utils/logger";

// ── Callback redirect URI (fixed — Meta requires exact match) ────

function getCallbackRedirectUri(): string {
  const base = process.env.BASE_URL ?? "http://localhost:3000";
  return `${base}/api/social/callback`;
}

// ── GET /api/social/connect/:platform ────────────────────────────
// Returns the OAuth authorization URL for the given platform.
// Client should redirect the user's browser to this URL.
// State param encodes { platform, brandId, userId } as base64url.

export const getAuthUrl = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    // Validate platform param
    const { error: paramError } = platformParamSchema.validate(req.params, {
      abortEarly: false,
    });
    if (paramError) {
      throw new ApiError(
        400,
        ErrorCode.ValidationError,
        paramError.details.map((d) => d.message).join(", "),
      );
    }

    // Validate query (brandId)
    const { error: queryError, value: queryValue } =
      connectPlatformSchema.validate(req.query, {
        abortEarly: false,
      });
    if (queryError) {
      throw new ApiError(
        400,
        ErrorCode.ValidationError,
        queryError.details.map((d) => d.message).join(", "),
      );
    }

    const user = req.user as IUserDocument;
    const platform = req.params.platform as SocialPlatform;

    const provider = getProvider(platform);
    if (!provider) {
      throw new ApiError(
        400,
        ErrorCode.ValidationError,
        `المنصة "${platform}" مش مدعومة حالياً`,
      );
    }

    const redirectUri = getCallbackRedirectUri();
    const authUrl = provider.getAuthUrl({
      brandId: queryValue.brandId as string,
      userId: String(user._id),
      redirectUri,
    });

    return sendSuccess(res, { authUrl, platform }, 200, SuccessCode.Ok, req);
  },
);

// ── GET /api/social/callback ─────────────────────────────────────
// Fixed URL — Meta requires exact redirect URI match in App Dashboard.
// Platform + brandId + userId decoded from base64 state parameter.

export const handleOAuthCallback = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { code, state, error: oauthError } = req.query;

    // Meta sends error param on user denial
    if (oauthError) {
      throw new ApiError(
        400,
        ErrorCode.ExternalServiceError,
        `OAuth خطأ: ${String(oauthError)}`,
      );
    }

    if (!code || !state) {
      throw new ApiError(
        400,
        ErrorCode.ValidationError,
        "بيانات الـ OAuth ناقصة — الكود أو الـ state مش موجود",
      );
    }

    // Decode state: base64url → JSON { platform, brandId, userId }
    let oauthState: OAuthState;
    try {
      const decoded = Buffer.from(String(state), "base64url").toString("utf8");
      oauthState = JSON.parse(decoded) as OAuthState;
    } catch {
      throw new ApiError(
        400,
        ErrorCode.ValidationError,
        "الـ state بتاع الـ OAuth مش صالح",
      );
    }

    if (!oauthState.platform || !oauthState.brandId || !oauthState.userId) {
      throw new ApiError(
        400,
        ErrorCode.ValidationError,
        "بيانات الـ OAuth state ناقصة",
      );
    }

    const redirectUri = getCallbackRedirectUri();

    // Exchange code for tokens and connect account
    const result = await connectAccount(
      oauthState.userId,
      oauthState.brandId,
      oauthState.platform,
      String(code),
      redirectUri,
    );

    logger.info("oauth_callback_success", {
      platform: oauthState.platform,
      brandId: oauthState.brandId,
      userId: oauthState.userId,
      accountId: result.accountId,
    });

    return sendSuccess(
      res,
      {
        platform: result.platform,
        accountId: result.accountId,
        accountHandle: result.accountHandle,
        pageId: result.pageId,
        pageName: result.pageName,
      },
      200,
      SuccessCode.Ok,
      req,
    );
  },
);

// ── POST /api/social/publish/:contentItemId ──────────────────────
// Idempotent: if the content item is already posted, returns cached
// result without calling the provider again.

export const publishContentHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { error: paramError } = contentItemIdParamSchema.validate(
      req.params,
      { abortEarly: false },
    );
    if (paramError) {
      throw new ApiError(
        400,
        ErrorCode.ValidationError,
        paramError.details.map((d) => d.message).join(", "),
      );
    }

    const user = req.user as IUserDocument;
    const contentItemId = req.params.contentItemId as string;

    const result = await publishContent(String(user._id), contentItemId);

    return sendSuccess(res, result, 200, SuccessCode.Ok, req);
  },
);

// ── POST /api/social/schedule/:contentItemId ─────────────────────

export const scheduleContentHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    // Validate params
    const { error: paramError } = contentItemIdParamSchema.validate(
      req.params,
      { abortEarly: false },
    );
    if (paramError) {
      throw new ApiError(
        400,
        ErrorCode.ValidationError,
        paramError.details.map((d) => d.message).join(", "),
      );
    }

    // Validate body
    const { error: bodyError, value } = scheduleContentSchema.validate(
      req.body,
      { abortEarly: false },
    );
    if (bodyError) {
      throw new ApiError(
        400,
        ErrorCode.ValidationError,
        bodyError.details.map((d) => d.message).join(", "),
      );
    }

    const user = req.user as IUserDocument;
    const contentItemId = req.params.contentItemId as string;

    await scheduleContent(
      String(user._id),
      contentItemId,
      new Date(value.scheduledAt as string),
    );

    return sendSuccess(
      res,
      { contentItemId, scheduledAt: value.scheduledAt },
      200,
      SuccessCode.Ok,
      req,
    );
  },
);

// ── GET /api/social/accounts/:brandId ────────────────────────────

export const listAccountsHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { error: paramError } = brandIdParamSchema.validate(req.params, {
      abortEarly: false,
    });
    if (paramError) {
      throw new ApiError(
        400,
        ErrorCode.ValidationError,
        paramError.details.map((d) => d.message).join(", "),
      );
    }

    const user = req.user as IUserDocument;
    const brandId = req.params.brandId as string;

    const accounts = await listConnectedAccounts(String(user._id), brandId);

    return sendSuccess(res, { accounts }, 200, SuccessCode.Ok, req);
  },
);

// ── DELETE /api/social/accounts/:brandId/:platform ───────────────

export const disconnectAccountHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { error: paramError } = disconnectParamSchema.validate(req.params, {
      abortEarly: false,
    });
    if (paramError) {
      throw new ApiError(
        400,
        ErrorCode.ValidationError,
        paramError.details.map((d) => d.message).join(", "),
      );
    }

    const user = req.user as IUserDocument;
    const brandId = req.params.brandId as string;
    const platform = req.params.platform as string;

    await disconnectAccount(
      String(user._id),
      brandId,
      platform as SocialPlatform,
    );

    return sendSuccess(res, null, 200, SuccessCode.Ok, req);
  },
);
