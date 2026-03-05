// ─────────────────────────────────────────────────────────────────
// Facebook Login Provider
// Connects both Facebook Page + Instagram via Facebook Login.
// Scopes: pages_manage_posts, pages_read_engagement, pages_show_list,
//         instagram_content_publish, instagram_manage_insights
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
  "pages_manage_posts",
  "pages_read_engagement",
  "pages_show_list",
  "instagram_content_publish",
  "instagram_manage_insights",
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

const facebookLoginProvider: SocialProvider = {
  platform: SocialPlatform.Facebook,

  getAuthUrl(params: OAuthParams): string {
    const { appId } = getAppCredentials();
    const state = encodeState(params, SocialPlatform.Facebook);
    const authUrl = new URL("https://www.facebook.com/v25.0/dialog/oauth");
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

    // Step 1: Exchange code for short-lived user access token
    const tokenRes = await fetch(
      `${GRAPH_API}/oauth/access_token?` +
        new URLSearchParams({
          client_id: appId,
          client_secret: appSecret,
          redirect_uri: redirectUri,
          code,
        }),
    );
    const tokenData = (await tokenRes.json()) as {
      access_token?: string;
      error?: { message: string };
    };
    if (!tokenData.access_token) {
      throw new Error(
        `Facebook token exchange failed: ${tokenData.error?.message || "unknown"}`,
      );
    }

    // Step 2: Exchange for long-lived user token (60 days)
    const longLivedRes = await fetch(
      `${GRAPH_API}/oauth/access_token?` +
        new URLSearchParams({
          grant_type: "fb_exchange_token",
          client_id: appId,
          client_secret: appSecret,
          fb_exchange_token: tokenData.access_token,
        }),
    );
    const longLivedData = (await longLivedRes.json()) as {
      access_token?: string;
      expires_in?: number;
      error?: { message: string };
    };
    if (!longLivedData.access_token) {
      throw new Error(
        `Facebook long-lived token exchange failed: ${longLivedData.error?.message || "unknown"}`,
      );
    }

    const userAccessToken = longLivedData.access_token;
    const tokenExpiresAt = new Date(
      Date.now() + (longLivedData.expires_in || 5184000) * 1000,
    );

    // Step 3: Get user's pages (returns page access tokens that never expire)
    const pagesRes = await fetch(
      `${GRAPH_API}/me/accounts?fields=id,name,access_token,instagram_business_account&access_token=${userAccessToken}`,
    );
    const pagesData = (await pagesRes.json()) as {
      data?: Array<{
        id: string;
        name: string;
        access_token: string;
        instagram_business_account?: { id: string };
      }>;
      error?: { message: string };
    };
    if (!pagesData.data?.length) {
      throw new Error(
        "No Facebook Pages found. You need at least one Facebook Page to connect.",
      );
    }

    // Use the first page (user can choose later in UI)
    const page = pagesData.data[0];

    // Check if the page has a connected Instagram business account
    if (page.instagram_business_account) {
      // Verify Instagram account type
      const igRes = await fetch(
        `${GRAPH_API}/${page.instagram_business_account.id}?fields=id,username,ig_id&access_token=${page.access_token}`,
      );
      const igData = (await igRes.json()) as {
        id?: string;
        username?: string;
        error?: { message: string };
      };

      if (igData.id) {
        logger.info("facebook_login_with_instagram", {
          pageId: page.id,
          pageName: page.name,
          igAccountId: igData.id,
          igUsername: igData.username,
        });
      }
    }

    logger.info("facebook_login_connected", {
      pageId: page.id,
      pageName: page.name,
    });

    return {
      accessToken: page.access_token, // Page access token (doesn't expire)
      refreshToken: userAccessToken, // Store user token for IG and refreshing
      tokenExpiresAt,
      accountId: page.id,
      pageId: page.id,
      pageName: page.name,
      platform: SocialPlatform.Facebook,
    };
  },

  async refreshToken(
    account: SocialAccount,
  ): Promise<{ accessToken: string; tokenExpiresAt: Date }> {
    // Facebook page tokens derived from long-lived user tokens don't expire.
    // We refresh the user token (stored as refreshToken) to extend its life.
    if (!account.refreshToken) {
      throw new Error("No user access token stored for Facebook token refresh");
    }

    const { appId, appSecret } = getAppCredentials();
    const res = await fetch(
      `${GRAPH_API}/oauth/access_token?` +
        new URLSearchParams({
          grant_type: "fb_exchange_token",
          client_id: appId,
          client_secret: appSecret,
          fb_exchange_token: account.refreshToken,
        }),
    );
    const data = (await res.json()) as {
      access_token?: string;
      expires_in?: number;
      error?: { message: string };
    };
    if (!data.access_token) {
      throw new Error(
        `Facebook token refresh failed: ${data.error?.message || "unknown"}`,
      );
    }

    // Re-fetch page token with new user token
    const pagesRes = await fetch(
      `${GRAPH_API}/me/accounts?fields=id,access_token&access_token=${data.access_token}`,
    );
    const pagesData = (await pagesRes.json()) as {
      data?: Array<{ id: string; access_token: string }>;
    };
    const page = pagesData.data?.find((p) => p.id === account.pageId);

    return {
      accessToken: page?.access_token || data.access_token,
      tokenExpiresAt: new Date(
        Date.now() + (data.expires_in || 5184000) * 1000,
      ),
    };
  },

  async publishPost(
    account: SocialAccount,
    postData: PostData,
  ): Promise<PublishResult> {
    const pageId = account.pageId || account.accountId;
    const accessToken = account.accessToken;

    let message = postData.caption;
    if (postData.hashtags?.length) {
      message += "\n\n" + postData.hashtags.join(" ");
    }

    let postUrl: string;
    let body: Record<string, string | boolean>;

    if (postData.mediaUrls.length > 0) {
      // Photo/video post
      if (postData.mediaUrls.length === 1) {
        const mediaUrl = postData.mediaUrls[0];
        const isVideo = !!mediaUrl.match(/\.(mp4|mov|avi)$/i);
        postUrl = `${GRAPH_API}/${pageId}/${isVideo ? "videos" : "photos"}`;
        body = {
          [isVideo ? "file_url" : "url"]: mediaUrl,
          message,
          access_token: accessToken,
          published: true,
        };
      } else {
        // Multi-photo: upload unpublished photos then create multi-photo post
        const photoIds: string[] = [];
        for (const mediaUrl of postData.mediaUrls) {
          const photoRes = await fetch(`${GRAPH_API}/${pageId}/photos`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              url: mediaUrl,
              published: false,
              access_token: accessToken,
            }),
          });
          const photoData = (await photoRes.json()) as {
            id?: string;
            error?: { message: string };
          };
          if (!photoData.id) {
            throw new Error(
              `Facebook photo upload failed: ${photoData.error?.message || "unknown"}`,
            );
          }
          photoIds.push(photoData.id);
        }

        // Create multi-photo post
        const attachedMedia = photoIds.map((id) => ({
          media_fbid: id,
        }));
        const multiRes = await fetch(`${GRAPH_API}/${pageId}/feed`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message,
            attached_media: attachedMedia,
            access_token: accessToken,
          }),
        });
        const multiData = (await multiRes.json()) as {
          id?: string;
          error?: { message: string };
        };
        if (!multiData.id) {
          throw new Error(
            `Facebook multi-photo post failed: ${multiData.error?.message || "unknown"}`,
          );
        }

        logger.info("facebook_post_published", { postId: multiData.id });
        return {
          postId: multiData.id,
          platform: SocialPlatform.Facebook,
          publishedAt: new Date(),
        };
      }
    } else {
      // Text-only post
      postUrl = `${GRAPH_API}/${pageId}/feed`;
      body = { message, access_token: accessToken, published: true };
    }

    const res = await fetch(postUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as {
      id?: string;
      post_id?: string;
      error?: { message: string };
    };
    const postId = data.id || data.post_id;
    if (!postId) {
      throw new Error(
        `Facebook publish failed: ${data.error?.message || "unknown"}`,
      );
    }

    logger.info("facebook_post_published", { postId });

    return {
      postId,
      platform: SocialPlatform.Facebook,
      publishedAt: new Date(),
    };
  },

  async schedulePost(
    account: SocialAccount,
    postData: PostData,
    scheduleTime: Date,
  ): Promise<PublishResult> {
    const pageId = account.pageId || account.accountId;
    const accessToken = account.accessToken;
    const publishTimestamp = Math.floor(scheduleTime.getTime() / 1000);

    let message = postData.caption;
    if (postData.hashtags?.length) {
      message += "\n\n" + postData.hashtags.join(" ");
    }

    const body: Record<string, string | number | boolean> = {
      message,
      access_token: accessToken,
      published: false,
      scheduled_publish_time: publishTimestamp,
    };

    if (postData.mediaUrls.length === 1) {
      body.url = postData.mediaUrls[0];
    }

    const res = await fetch(`${GRAPH_API}/${pageId}/feed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as {
      id?: string;
      error?: { message: string };
    };
    if (!data.id) {
      throw new Error(
        `Facebook schedule failed: ${data.error?.message || "unknown"}`,
      );
    }

    logger.info("facebook_post_scheduled", {
      postId: data.id,
      scheduleTime: scheduleTime.toISOString(),
    });

    return {
      postId: data.id,
      platform: SocialPlatform.Facebook,
      publishedAt: scheduleTime,
    };
  },

  async getMetrics(
    account: SocialAccount,
    postId: string,
  ): Promise<PostMetrics> {
    const accessToken = account.accessToken;

    // Get basic post metrics
    const res = await fetch(
      `${GRAPH_API}/${postId}?fields=likes.summary(true),comments.summary(true),shares&access_token=${accessToken}`,
    );
    const data = (await res.json()) as {
      likes?: { summary?: { total_count: number } };
      comments?: { summary?: { total_count: number } };
      shares?: { count: number };
      error?: { message: string };
    };

    // Get post insights
    const insightsRes = await fetch(
      `${GRAPH_API}/${postId}/insights?metric=post_impressions_unique,post_clicks&access_token=${accessToken}`,
    );
    const insightsData = (await insightsRes.json()) as {
      data?: Array<{ name: string; values: Array<{ value: number }> }>;
    };

    const insightsMap = new Map<string, number>();
    if (insightsData.data) {
      for (const metric of insightsData.data) {
        insightsMap.set(metric.name, metric.values[0]?.value ?? 0);
      }
    }

    const likes = data.likes?.summary?.total_count ?? 0;
    const comments = data.comments?.summary?.total_count ?? 0;
    const shares = data.shares?.count ?? 0;
    const reach = insightsMap.get("post_impressions_unique") ?? 0;

    return {
      postId,
      views: insightsMap.get("post_clicks") ?? 0,
      reach,
      mediaViewers: reach, // mirror reach until migration
      likes,
      comments,
      shares,
      saved: 0, // Facebook doesn't expose saved count
      fetchedAt: new Date(),
    };
  },

  async getPageInsights(account: SocialAccount): Promise<PageInsights> {
    const pageId = account.pageId || account.accountId;
    const accessToken = account.accessToken;

    // Get fan count
    const pageRes = await fetch(
      `${GRAPH_API}/${pageId}?fields=fan_count&access_token=${accessToken}`,
    );
    const pageData = (await pageRes.json()) as {
      fan_count?: number;
      error?: { message: string };
    };

    // Get page insights (daily reach and engagement)
    const insightsRes = await fetch(
      `${GRAPH_API}/${pageId}/insights?metric=page_impressions_unique,page_engaged_users&period=day&access_token=${accessToken}`,
    );
    const insightsData = (await insightsRes.json()) as {
      data?: Array<{ name: string; values: Array<{ value: number }> }>;
    };

    const insightsMap = new Map<string, number>();
    if (insightsData.data) {
      for (const metric of insightsData.data) {
        const latestValue = metric.values[metric.values.length - 1]?.value ?? 0;
        insightsMap.set(metric.name, latestValue);
      }
    }

    const reach = insightsMap.get("page_impressions_unique") ?? 0;

    return {
      pageId,
      followers: pageData?.fan_count ?? 0,
      reach,
      mediaViewers: reach, // mirror reach until migration
      engagement: insightsMap.get("page_engaged_users") ?? 0,
      fetchedAt: new Date(),
    };
  },
};

// Self-register on import
registerProvider(facebookLoginProvider);

export { facebookLoginProvider };
