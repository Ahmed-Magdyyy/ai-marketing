// ─────────────────────────────────────────────────────────────────
// SocialProvider Interface
// Every social platform provider (Instagram Login, Facebook Login,
// TikTok, Twitter, YouTube) implements this contract.
// ─────────────────────────────────────────────────────────────────

import type {
  SocialPlatform,
  PostData,
  PublishResult,
  PostMetrics,
  PageInsights,
  SocialAccount,
} from "../../../shared/types";

/** Parameters for building the OAuth authorization URL. */
export interface OAuthParams {
  brandId: string;
  userId: string;
  redirectUri: string;
}

/** Data decoded from the base64 OAuth state parameter. */
export interface OAuthState {
  platform: SocialPlatform;
  brandId: string;
  userId: string;
}

/** Result returned by handleCallback after exchanging the auth code. */
export interface OAuthCallbackResult {
  accessToken: string;
  refreshToken?: string;
  tokenExpiresAt?: Date;
  accountId: string;
  accountHandle?: string;
  pageId?: string;
  pageName?: string;
  platform: SocialPlatform;
}

/**
 * Contract every social platform provider must implement.
 * Two Meta providers exist: InstagramLoginProvider and FacebookLoginProvider.
 */
export interface SocialProvider {
  /** Which platform(s) this provider connects. */
  readonly platform: SocialPlatform;

  /** Build the OAuth authorization URL. Encode { platform, brandId, userId } as base64 in state. */
  getAuthUrl(params: OAuthParams): string;

  /** Exchange the OAuth code for tokens, verify account type, return account info. */
  handleCallback(
    code: string,
    redirectUri: string,
  ): Promise<OAuthCallbackResult>;

  /** Refresh an expiring access token. Returns new token + expiry. */
  refreshToken(
    account: SocialAccount,
  ): Promise<{ accessToken: string; tokenExpiresAt: Date }>;

  /** Publish a post immediately. */
  publishPost(
    account: SocialAccount,
    postData: PostData,
  ): Promise<PublishResult>;

  /** Schedule a post for future publication. */
  schedulePost(
    account: SocialAccount,
    postData: PostData,
    scheduleTime: Date,
  ): Promise<PublishResult>;

  /** Fetch metrics for a specific post. */
  getMetrics(account: SocialAccount, postId: string): Promise<PostMetrics>;

  /** Fetch page-level insights. */
  getPageInsights(account: SocialAccount): Promise<PageInsights>;
}
