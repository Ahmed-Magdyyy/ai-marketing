// ─────────────────────────────────────────────────────────────────
// Social Service
// Orchestrates social media publishing, scheduling, and account
// management. Idempotency enforced via idempotencyKey on ContentItem.
// ─────────────────────────────────────────────────────────────────

import { Queue } from "bullmq";
import {
  SocialPlatform,
  SocialAccount,
  ContentStatus,
  ContentType,
  PostData,
  PublishResult,
  PlanTier,
} from "../../shared/types";
import {
  QueueName,
  SocialPublishJobData,
  createQueue,
  addSocialPublishJob,
} from "../../shared/config/queues";
import { encryptToken, decryptToken } from "../../shared/utils/tokenEncryption";
import { ContentItemModel } from "../plan/plan.model";
import { BrandProfileModel } from "../brand/brand.model";
import { getProvider } from "./providers/provider-registry";
import type { OAuthCallbackResult } from "./providers/social-provider.interface";
import { logger } from "../../shared/utils/logger";

// ── Queue Instance ───────────────────────────────────────────────

let socialPublishQueue: Queue | null = null;

function getSocialPublishQueue(): Queue {
  if (!socialPublishQueue) {
    socialPublishQueue = createQueue(QueueName.SocialPublish);
  }
  return socialPublishQueue;
}

// ── Publish Content ──────────────────────────────────────────────
// Idempotent: if contentItem already has idempotencyKey + status=posted,
// returns the cached result without calling the provider again.

async function publishContent(
  userId: string,
  contentItemId: string,
): Promise<PublishResult> {
  // 1. Load content item
  const contentItem = await ContentItemModel.findOne({
    _id: contentItemId,
    userId,
  });
  if (!contentItem) {
    throw new Error("Content item not found");
  }

  // 2. Idempotency check — never publish the same item twice
  const idempotencyKey = `publish:${contentItemId}`;
  if (
    contentItem.idempotencyKey === idempotencyKey &&
    contentItem.status === ContentStatus.Posted
  ) {
    logger.info("publish_idempotency_hit", { contentItemId, idempotencyKey });
    return {
      postId:
        (contentItem as unknown as { publishedPostId?: string })
          .publishedPostId ?? contentItemId,
      platform: contentItem.platform as unknown as SocialPlatform,
      publishedAt: contentItem.postedAt ?? new Date(),
      url: (contentItem as unknown as { publishedUrl?: string }).publishedUrl,
    };
  }

  // 3. Validate status — must be approved or draft
  const publishableStatuses = [
    ContentStatus.Approved,
    ContentStatus.Draft,
  ] as string[];
  if (!publishableStatuses.includes(contentItem.status)) {
    throw new Error(
      `Content item cannot be published — status is "${contentItem.status}"`,
    );
  }

  // 4. Load brand + social account
  const brand = await BrandProfileModel.findById(contentItem.brandId);
  if (!brand) {
    throw new Error("Brand not found");
  }

  const platform = contentItem.platform as string;
  const accountDoc = brand.socialAccounts?.find(
    (a: { platform: string }) => a.platform === platform,
  );
  if (!accountDoc) {
    throw new Error(`No connected ${platform} account found for this brand`);
  }

  // 5. Get the provider
  const provider = getProvider(platform as SocialPlatform);
  if (!provider) {
    throw new Error(`No social provider registered for platform: ${platform}`);
  }

  // 6. Build SocialAccount with decrypted tokens
  const socialAccount: SocialAccount = {
    platform: accountDoc.platform as SocialPlatform,
    accountId: accountDoc.accountId,
    accountHandle: accountDoc.accountHandle ?? undefined,
    accessToken: decryptToken(accountDoc.accessToken),
    refreshToken: accountDoc.refreshToken
      ? decryptToken(accountDoc.refreshToken)
      : undefined,
    pageId: accountDoc.pageId ?? undefined,
    pageName: accountDoc.pageName ?? undefined,
    tokenExpiresAt: accountDoc.tokenExpiresAt
      ? new Date(accountDoc.tokenExpiresAt)
      : undefined,
    connectedAt: accountDoc.connectedAt
      ? new Date(accountDoc.connectedAt)
      : new Date(),
  };

  // 7. Build PostData
  const postData: PostData = {
    contentType: (contentItem.contentType as ContentType) ?? ContentType.Post,
    caption: contentItem.caption ?? "",
    mediaUrls: (contentItem.assets ?? [])
      .map((a: { url: string }) => a.url)
      .filter(Boolean),
    hashtags: contentItem.hashtags ?? [],
  };

  // 8. Publish via provider
  const result = await provider.publishPost(socialAccount, postData);

  // 9. Update content item — mark as posted
  await ContentItemModel.findByIdAndUpdate(contentItemId, {
    $set: {
      status: ContentStatus.Posted,
      postedAt: result.publishedAt,
      idempotencyKey,
      metrics: {},
    },
  });

  logger.info("social_publish_success", {
    userId,
    contentItemId,
    platform,
    postId: result.postId,
  });

  return result;
}

// ── Schedule Content ─────────────────────────────────────────────
// Enqueues a delayed job in the social-publish BullMQ queue.

async function scheduleContent(
  userId: string,
  contentItemId: string,
  scheduledAt: Date,
  tier: PlanTier = PlanTier.Free,
): Promise<void> {
  // 1. Validate scheduledAt is in the future
  const now = Date.now();
  const delayMs = scheduledAt.getTime() - now;
  if (delayMs <= 0) {
    throw new Error("Scheduled time must be in the future");
  }

  // 2. Load content item
  const contentItem = await ContentItemModel.findOne({
    _id: contentItemId,
    userId,
  });
  if (!contentItem) {
    throw new Error("Content item not found");
  }

  // 3. Validate status
  const schedulableStatuses = [
    ContentStatus.Approved,
    ContentStatus.Draft,
  ] as string[];
  if (!schedulableStatuses.includes(contentItem.status)) {
    throw new Error(
      `Content item cannot be scheduled — status is "${contentItem.status}"`,
    );
  }

  // 4. Build job data
  const idempotencyKey = `publish:${contentItemId}`;
  const jobData: SocialPublishJobData = {
    contentItemId,
    planId: String(contentItem.planId),
    userId,
    brandId: String(contentItem.brandId),
    platform: contentItem.platform as string,
    idempotencyKey,
    scheduledAt: scheduledAt.toISOString(),
  };

  // 5. Enqueue with delay
  const queue = getSocialPublishQueue();
  await addSocialPublishJob(queue, jobData, tier, delayMs);

  // 6. Update content item status
  await ContentItemModel.findByIdAndUpdate(contentItemId, {
    $set: {
      status: ContentStatus.Scheduled,
      scheduledAt,
      idempotencyKey,
    },
  });

  logger.info("social_schedule_success", {
    userId,
    contentItemId,
    platform: contentItem.platform,
    scheduledAt: scheduledAt.toISOString(),
    delayMs,
  });
}

// ── Connect Account ──────────────────────────────────────────────
// Handles the OAuth callback: exchanges code for tokens, encrypts,
// and stores in BrandProfile.socialAccounts.

async function connectAccount(
  userId: string,
  brandId: string,
  platform: SocialPlatform,
  code: string,
  redirectUri: string,
): Promise<OAuthCallbackResult> {
  // 1. Verify brand ownership
  const brand = await BrandProfileModel.findOne({ _id: brandId, userId });
  if (!brand) {
    throw new Error("Brand not found or access denied");
  }

  // 2. Get provider and exchange code
  const provider = getProvider(platform);
  if (!provider) {
    throw new Error(`No social provider registered for platform: ${platform}`);
  }

  const callbackResult = await provider.handleCallback(code, redirectUri);

  // 3. Encrypt tokens
  const encryptedAccessToken = encryptToken(callbackResult.accessToken);
  const encryptedRefreshToken = callbackResult.refreshToken
    ? encryptToken(callbackResult.refreshToken)
    : undefined;

  // 4. Upsert — remove existing account for this platform, add new
  await BrandProfileModel.updateOne(
    { _id: brandId },
    {
      $pull: {
        socialAccounts: { platform: callbackResult.platform },
      },
    },
  );

  const accountData: Record<string, unknown> = {
    platform: callbackResult.platform,
    accountId: callbackResult.accountId,
    accountHandle: callbackResult.accountHandle,
    accessToken: encryptedAccessToken,
    refreshToken: encryptedRefreshToken,
    tokenExpiresAt: callbackResult.tokenExpiresAt,
    connectedAt: new Date(),
  };

  if (callbackResult.pageId) {
    accountData.pageId = callbackResult.pageId;
  }
  if (callbackResult.pageName) {
    accountData.pageName = callbackResult.pageName;
  }

  await BrandProfileModel.updateOne(
    { _id: brandId },
    { $push: { socialAccounts: accountData } },
  );

  logger.info("social_account_connected", {
    userId,
    brandId,
    platform: callbackResult.platform,
    accountId: callbackResult.accountId,
  });

  return callbackResult;
}

// ── Disconnect Account ───────────────────────────────────────────

async function disconnectAccount(
  userId: string,
  brandId: string,
  platform: SocialPlatform,
): Promise<void> {
  const result = await BrandProfileModel.updateOne(
    { _id: brandId, userId },
    { $pull: { socialAccounts: { platform } } },
  );

  if (result.matchedCount === 0) {
    throw new Error("Brand not found or access denied");
  }

  logger.info("social_account_disconnected", {
    userId,
    brandId,
    platform,
  });
}

// ── List Connected Accounts ──────────────────────────────────────
// Returns accounts with tokens redacted for API responses.

interface RedactedSocialAccount {
  platform: string;
  accountId: string;
  accountHandle?: string;
  pageId?: string;
  pageName?: string;
  tokenExpiresAt?: Date;
  connectedAt: Date;
}

async function listConnectedAccounts(
  userId: string,
  brandId: string,
): Promise<RedactedSocialAccount[]> {
  const brand = await BrandProfileModel.findOne({ _id: brandId, userId });
  if (!brand) {
    throw new Error("Brand not found or access denied");
  }

  return (brand.socialAccounts ?? []).map(
    (a: {
      platform: string;
      accountId: string;
      accountHandle?: string | null;
      pageId?: string | null;
      pageName?: string | null;
      tokenExpiresAt?: Date | null;
      connectedAt?: Date | null;
    }) => ({
      platform: a.platform,
      accountId: a.accountId,
      accountHandle: a.accountHandle ?? undefined,
      pageId: a.pageId ?? undefined,
      pageName: a.pageName ?? undefined,
      tokenExpiresAt: a.tokenExpiresAt ?? undefined,
      connectedAt: a.connectedAt ? new Date(a.connectedAt) : new Date(),
    }),
  );
}

export {
  publishContent,
  scheduleContent,
  connectAccount,
  disconnectAccount,
  listConnectedAccounts,
  RedactedSocialAccount,
};
