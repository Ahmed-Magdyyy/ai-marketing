// ─────────────────────────────────────────────────────────────────
// Social Publish Worker
// BullMQ worker: publishes content to social media platforms.
// Checks token expiry, refreshes if within 7 days, then publishes.
// ─────────────────────────────────────────────────────────────────

import { Worker, Job } from "bullmq";
import { getRedisClient } from "../shared/config/redis";
import { QueueName, SocialPublishJobData } from "../shared/config/queues";
import {
  SocialPlatform,
  SocialAccount,
  PostData,
  ContentType,
} from "../shared/types";
import { SWITCHES } from "../shared/middleware/killSwitch.middleware";
import { getIO } from "../shared/utils/socketProvider";
import { encryptToken, decryptToken } from "../shared/utils/tokenEncryption";
import { ContentItemModel } from "../modules/plan/plan.model";
import { BrandProfileModel } from "../modules/brand/brand.model";
import { getProvider } from "../modules/social/providers/provider-registry";
import { logger } from "../shared/utils/logger";

// ── Constants ────────────────────────────────────────────────────

const TOKEN_REFRESH_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// ── Worker ────────────────────────────────────────────────────────

function createSocialPublishWorker(): Worker<SocialPublishJobData> {
  const worker = new Worker<SocialPublishJobData>(
    QueueName.SocialPublish,
    async (job: Job<SocialPublishJobData>) => {
      const startMs = Date.now();
      const { contentItemId, brandId, userId, platform, idempotencyKey } =
        job.data;

      if (SWITCHES.DISABLE_CONTENT_GENERATION || SWITCHES.READ_ONLY_MODE) {
        logger.warn("social_publish_worker_skipped", {
          userId,
          reason: "kill_switch_active",
        });
        return;
      }

      // 1. Load content item
      const contentItem = await ContentItemModel.findById(contentItemId);
      if (!contentItem) {
        logger.error("social_publish_content_not_found", { contentItemId });
        return;
      }

      // 2. Load brand + social account
      const brand = await BrandProfileModel.findById(brandId);
      if (!brand) {
        logger.error("social_publish_brand_not_found", { brandId });
        return;
      }

      const accountDoc = brand.socialAccounts?.find(
        (a: { platform: string }) => a.platform === platform,
      );
      if (!accountDoc) {
        logger.error("social_publish_account_not_found", {
          brandId,
          platform,
        });
        return;
      }

      // 3. Get provider
      const provider = getProvider(platform as SocialPlatform);
      if (!provider) {
        logger.error("social_publish_provider_not_found", { platform });
        return;
      }

      // 4. Build SocialAccount object with decrypted tokens
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

      // 5. Check token expiry — refresh if within 7 days
      if (
        socialAccount.tokenExpiresAt &&
        socialAccount.tokenExpiresAt.getTime() - Date.now() <
          TOKEN_REFRESH_THRESHOLD_MS
      ) {
        logger.info("social_publish_refreshing_token", {
          brandId,
          platform,
          expiresAt: socialAccount.tokenExpiresAt,
        });

        try {
          const refreshed = await provider.refreshToken(socialAccount);

          // Update stored tokens in DB
          const updateFields: Record<string, unknown> = {
            "socialAccounts.$.accessToken": encryptToken(refreshed.accessToken),
            "socialAccounts.$.tokenExpiresAt": refreshed.tokenExpiresAt,
          };

          await BrandProfileModel.updateOne(
            { _id: brandId, "socialAccounts.platform": platform },
            { $set: updateFields },
          );

          // Update local object for publishing
          socialAccount.accessToken = refreshed.accessToken;
          socialAccount.tokenExpiresAt = refreshed.tokenExpiresAt;
        } catch (err) {
          logger.error("social_publish_token_refresh_failed", {
            brandId,
            platform,
            error: err instanceof Error ? err.message : String(err),
          });
          // Continue with existing token — it may still work
        }
      }

      // 6. Build PostData
      const contentDoc = contentItem as unknown as {
        contentType?: string;
        caption?: string;
        hashtags?: string[];
        assets?: { url: string }[];
      };

      const postData: PostData = {
        contentType:
          (contentDoc.contentType as ContentType) ?? ContentType.Post,
        caption: contentDoc.caption ?? "",
        mediaUrls: (contentDoc.assets ?? []).map((a) => a.url).filter(Boolean),
        hashtags: contentDoc.hashtags ?? [],
      };

      // 7. Publish
      const result = await provider.publishPost(socialAccount, postData);

      // 8. Update content item with publish result
      await ContentItemModel.findByIdAndUpdate(contentItemId, {
        $set: {
          publishedPostId: result.postId,
          publishedUrl: result.url,
          publishedAt: new Date(),
          status: "published",
          idempotencyKey,
        },
      });

      const latencyMs = Date.now() - startMs;
      logger.info("social_publish_complete", {
        userId,
        platform,
        contentItemId,
        postId: result.postId,
        latencyMs,
      });

      // 9. Notify client via socket
      try {
        const io = getIO();
        io.to(`user:${userId}`).emit("social:published", {
          contentItemId,
          platform,
          postId: result.postId,
          url: result.url,
          status: "published",
        });
      } catch {
        logger.warn("socket_emit_failed", {
          userId,
          contentItemId,
          event: "social:published",
        });
      }
    },
    {
      connection: getRedisClient(),
      concurrency: 5,
      limiter: {
        max: 30,
        duration: 10000,
      },
    },
  );

  worker.on(
    "failed",
    (job: Job<SocialPublishJobData> | undefined, err: Error) => {
      logger.error("social_publish_worker_failed", {
        jobId: job?.id,
        contentItemId: job?.data?.contentItemId,
        platform: job?.data?.platform,
        error: err.message,
      });
    },
  );

  return worker;
}

export { createSocialPublishWorker };
