// ─────────────────────────────────────────────────────────────────
// Instagram Login Provider
// Instagram Business Login — no Facebook Page required.
// Simpler flow, recommended for non-technical users.
// Graph API v25.0 — https://graph.facebook.com/v25.0/...
// ─────────────────────────────────────────────────────────────────

import type {
  SocialAccount,
  PostData,
  PublishResult,
  PostMetrics,
  PageInsights,
} from "../../../shared/types";
import { SocialPlatform } from "../../../shared/types";
import type {
  SocialProvider,
  OAuthParams,
  OAuthCallbackResult,
} from "./social-provider.interface";
import { registerProvider } from "./provider-registry";
import { logger } from "../../../shared/utils/logger";

const GRAPH_API = "https://graph.facebook.com/v25.0";
const SCOPES = [
  "instagram_content_publish",
  "instagram_manage_insights",
  "instagram_basic",
].join(",");

function getAppCredentials(): { appId: string; appSecret: string } {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  if (!appId || !appSecret) {
    throw new Error("META_APP_ID and META_APP_SECRET must be set");
  }
  return { appId, appSecret };
}

function encodeState(params: OAuthParams, platform: SocialPlatform): string {
  const state = JSON.stringify({
    platform,
    brandId: params.brandId,
    userId: params.userId,
  });
  return Buffer.from(state).toString("base64url");
}

/**
 * Polls an Instagram media container until status is FINISHED.
 * Max 10 attempts, 3-second interval.
 */
async function pollContainerStatus(
  containerId: string,
  accessToken: string,
): Promise<void> {
  const MAX_ATTEMPTS = 10;
  const INTERVAL_MS = 3000;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const url = `${GRAPH_API}/${containerId}?fields=status_code,status&access_token=${accessToken}`;
    const res = await fetch(url);
    const data = (await res.json()) as {
      status_code?: string;
      status?: string;
    };

    if (data.status_code === "FINISHED") {
      return;
    }

    if (data.status_code === "ERROR") {
      throw new Error(
        `Instagram container ${containerId} failed: ${data.status || "unknown error"}`,
      );
    }

    if (attempt < MAX_ATTEMPTS) {
      await new Promise((resolve) => setTimeout(resolve, INTERVAL_MS));
    }
  }

  throw new Error(
    `Instagram container ${containerId} did not finish after ${MAX_ATTEMPTS} attempts`,
  );
}

const instagramLoginProvider: SocialProvider = {
  platform: SocialPlatform.Instagram,

  getAuthUrl(params: OAuthParams): string {
    const { appId } = getAppCredentials();
    const state = encodeState(params, SocialPlatform.Instagram);
    const authUrl = new URL("https://www.instagram.com/oauth/authorize");
    authUrl.searchParams.set("client_id", appId);
    authUrl.searchParams.set("redirect_uri", params.redirectUri);
    authUrl.searchParams.set("scope", SCOPES);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("state", state);
    return authUrl.toString();
  },

  async handleCallback(
    code: string,
    redirectUri: string,
  ): Promise<OAuthCallbackResult> {
    const { appId, appSecret } = getAppCredentials();

    // Step 1: Exchange code for short-lived token
    const tokenRes = await fetch(`${GRAPH_API}/oauth/access_token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: appId,
        client_secret: appSecret,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
        code,
      }),
    });
    const tokenData = (await tokenRes.json()) as {
      access_token?: string;
      error?: { message: string };
    };
    if (!tokenData.access_token) {
      throw new Error(
        `Instagram token exchange failed: ${tokenData.error?.message || "unknown"}`,
      );
    }

    // Step 2: Exchange short-lived for long-lived token (60 days)
    const longLivedRes = await fetch(
      `${GRAPH_API}/access_token?grant_type=ig_exchange_token&client_secret=${appSecret}&access_token=${tokenData.access_token}`,
    );
    const longLivedData = (await longLivedRes.json()) as {
      access_token?: string;
      expires_in?: number;
      error?: { message: string };
    };
    if (!longLivedData.access_token) {
      throw new Error(
        `Instagram long-lived token exchange failed: ${longLivedData.error?.message || "unknown"}`,
      );
    }

    const accessToken = longLivedData.access_token;
    const tokenExpiresAt = new Date(
      Date.now() + (longLivedData.expires_in || 5184000) * 1000,
    );

    // Step 3: Get user profile and verify Business/Creator account
    const meRes = await fetch(
      `${GRAPH_API}/me?fields=id,username,account_type&access_token=${accessToken}`,
    );
    const meData = (await meRes.json()) as {
      id?: string;
      username?: string;
      account_type?: string;
      error?: { message: string };
    };
    if (!meData.id) {
      throw new Error(
        `Instagram profile fetch failed: ${meData.error?.message || "unknown"}`,
      );
    }

    // Reject personal accounts
    if (
      meData.account_type &&
      meData.account_type.toUpperCase() === "PERSONAL"
    ) {
      throw new Error(
        "محتاج تحوّل حسابك لـ Business أو Creator account الأول — مجاني من إعدادات Instagram",
      );
    }

    logger.info("instagram_login_connected", {
      accountId: meData.id,
      username: meData.username,
      accountType: meData.account_type,
    });

    return {
      accessToken,
      tokenExpiresAt,
      accountId: meData.id,
      accountHandle: meData.username,
      platform: SocialPlatform.Instagram,
    };
  },

  async refreshToken(
    account: SocialAccount,
  ): Promise<{ accessToken: string; tokenExpiresAt: Date }> {
    // Instagram long-lived tokens can be refreshed via Graph API
    const res = await fetch(
      `${GRAPH_API}/refresh_access_token?grant_type=ig_refresh_token&access_token=${account.accessToken}`,
    );
    const data = (await res.json()) as {
      access_token?: string;
      expires_in?: number;
      error?: { message: string };
    };
    if (!data.access_token) {
      throw new Error(
        `Instagram token refresh failed: ${data.error?.message || "unknown"}`,
      );
    }

    return {
      accessToken: data.access_token,
      tokenExpiresAt: new Date(
        Date.now() + (data.expires_in || 5184000) * 1000,
      ),
    };
  },

  async publishPost(
    account: SocialAccount,
    postData: PostData,
  ): Promise<PublishResult> {
    const igUserId = account.accountId;
    const accessToken = account.accessToken;

    // Step 1: Create media container
    const containerParams: Record<string, string> = {
      caption: postData.caption,
      access_token: accessToken,
    };

    if (postData.hashtags?.length) {
      containerParams.caption += "\n\n" + postData.hashtags.join(" ");
    }

    if (postData.mediaUrls.length === 1) {
      // Single image/video
      const mediaUrl = postData.mediaUrls[0];
      const isVideo =
        postData.contentType === "reel" || mediaUrl.match(/\.(mp4|mov|avi)$/i);
      containerParams[isVideo ? "video_url" : "image_url"] = mediaUrl;
      if (isVideo) {
        containerParams.media_type = "REELS";
      }
    } else if (postData.mediaUrls.length > 1) {
      // Carousel: create child containers first
      const childIds: string[] = [];
      for (const mediaUrl of postData.mediaUrls) {
        const isVideo = mediaUrl.match(/\.(mp4|mov|avi)$/i);
        const childRes = await fetch(`${GRAPH_API}/${igUserId}/media`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            [isVideo ? "video_url" : "image_url"]: mediaUrl,
            is_carousel_item: true,
            access_token: accessToken,
          }),
        });
        const childData = (await childRes.json()) as {
          id?: string;
          error?: { message: string };
        };
        if (!childData.id) {
          throw new Error(
            `Instagram carousel child creation failed: ${childData.error?.message || "unknown"}`,
          );
        }
        await pollContainerStatus(childData.id, accessToken);
        childIds.push(childData.id);
      }
      containerParams.media_type = "CAROUSEL";
      containerParams.children = childIds.join(",");
    }

    const containerRes = await fetch(`${GRAPH_API}/${igUserId}/media`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(containerParams),
    });
    const containerData = (await containerRes.json()) as {
      id?: string;
      error?: { message: string };
    };
    if (!containerData.id) {
      throw new Error(
        `Instagram container creation failed: ${containerData.error?.message || "unknown"}`,
      );
    }

    // Step 2: Poll container until FINISHED
    await pollContainerStatus(containerData.id, accessToken);

    // Step 3: Publish the container
    const publishRes = await fetch(`${GRAPH_API}/${igUserId}/media_publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        creation_id: containerData.id,
        access_token: accessToken,
      }),
    });
    const publishData = (await publishRes.json()) as {
      id?: string;
      error?: { message: string };
    };
    if (!publishData.id) {
      throw new Error(
        `Instagram publish failed: ${publishData.error?.message || "unknown"}`,
      );
    }

    logger.info("instagram_post_published", { postId: publishData.id });

    return {
      postId: publishData.id,
      platform: SocialPlatform.Instagram,
      publishedAt: new Date(),
    };
  },

  async schedulePost(
    account: SocialAccount,
    postData: PostData,
    scheduleTime: Date,
  ): Promise<PublishResult> {
    const igUserId = account.accountId;
    const accessToken = account.accessToken;
    const publishTimestamp = Math.floor(scheduleTime.getTime() / 1000);

    // Create container with scheduled publish_time
    const containerParams: Record<string, string | number> = {
      caption: postData.caption,
      access_token: accessToken,
      published: "false",
      scheduled_publish_time: publishTimestamp,
    };

    if (postData.hashtags?.length) {
      containerParams.caption += "\n\n" + postData.hashtags.join(" ");
    }

    if (postData.mediaUrls.length === 1) {
      const mediaUrl = postData.mediaUrls[0];
      const isVideo =
        postData.contentType === "reel" || mediaUrl.match(/\.(mp4|mov|avi)$/i);
      containerParams[isVideo ? "video_url" : "image_url"] = mediaUrl;
      if (isVideo) {
        containerParams.media_type = "REELS";
      }
    }

    const containerRes = await fetch(`${GRAPH_API}/${igUserId}/media`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(containerParams),
    });
    const containerData = (await containerRes.json()) as {
      id?: string;
      error?: { message: string };
    };
    if (!containerData.id) {
      throw new Error(
        `Instagram schedule container failed: ${containerData.error?.message || "unknown"}`,
      );
    }

    logger.info("instagram_post_scheduled", {
      containerId: containerData.id,
      scheduleTime: scheduleTime.toISOString(),
    });

    return {
      postId: containerData.id,
      platform: SocialPlatform.Instagram,
      publishedAt: scheduleTime,
    };
  },

  async getMetrics(
    account: SocialAccount,
    postId: string,
  ): Promise<PostMetrics> {
    const accessToken = account.accessToken;
    const metrics = "views,likes,comments,shares,saved,reach";
    const url = `${GRAPH_API}/${postId}/insights?metric=${metrics}&access_token=${accessToken}`;

    const res = await fetch(url);
    const data = (await res.json()) as {
      data?: Array<{ name: string; values: Array<{ value: number }> }>;
      error?: { message: string };
    };
    if (!data.data) {
      throw new Error(
        `Instagram metrics fetch failed: ${data.error?.message || "unknown"}`,
      );
    }

    const metricsMap = new Map<string, number>();
    for (const metric of data.data) {
      metricsMap.set(metric.name, metric.values[0]?.value ?? 0);
    }

    return {
      postId,
      views: metricsMap.get("views") ?? 0,
      reach: metricsMap.get("reach") ?? 0,
      mediaViewers: metricsMap.get("reach") ?? 0, // mirror reach until migration
      likes: metricsMap.get("likes") ?? 0,
      comments: metricsMap.get("comments") ?? 0,
      shares: metricsMap.get("shares") ?? 0,
      saved: metricsMap.get("saved") ?? 0,
      fetchedAt: new Date(),
    };
  },

  async getPageInsights(account: SocialAccount): Promise<PageInsights> {
    const accessToken = account.accessToken;
    const igUserId = account.accountId;

    // Get follower count
    const profileRes = await fetch(
      `${GRAPH_API}/${igUserId}?fields=followers_count&access_token=${accessToken}`,
    );
    const profileData = (await profileRes.json()) as {
      followers_count?: number;
      error?: { message: string };
    };

    // Get page insights
    const insightsRes = await fetch(
      `${GRAPH_API}/${igUserId}/insights?metric=reach,accounts_engaged&period=day&metric_type=total_value&access_token=${accessToken}`,
    );
    const insightsData = (await insightsRes.json()) as {
      data?: Array<{
        name: string;
        total_value?: { value: number };
      }>;
      error?: { message: string };
    };

    const insightsMap = new Map<string, number>();
    if (insightsData.data) {
      for (const metric of insightsData.data) {
        insightsMap.set(metric.name, metric.total_value?.value ?? 0);
      }
    }

    const reachValue = insightsMap.get("reach") ?? 0;

    return {
      pageId: igUserId,
      followers: profileData?.followers_count ?? 0,
      reach: reachValue,
      mediaViewers: reachValue, // mirror reach until migration
      engagement: insightsMap.get("accounts_engaged") ?? 0,
      fetchedAt: new Date(),
    };
  },
};

// Self-register on import
registerProvider(instagramLoginProvider);

export { instagramLoginProvider };
