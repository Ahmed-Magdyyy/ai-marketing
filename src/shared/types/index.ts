// ─────────────────────────────────────────────────────────────────
// Shared Types — Single source of truth for all enums & interfaces
// ─────────────────────────────────────────────────────────────────

// ── Model Roles ──────────────────────────────────────────────────

export enum ModelRole {
  AgentReasoning = "AGENT_REASONING",
  AgentFast = "AGENT_FAST",
  ImagePrimary = "IMAGE_PRIMARY",
  ImageSecondary = "IMAGE_SECONDARY",
  Embeddings = "EMBEDDINGS",
  VideoShort = "VIDEO_SHORT",
  VideoPresenter = "VIDEO_PRESENTER",
  Voiceover = "VOICEOVER",
}

// ── Plan Tiers ───────────────────────────────────────────────────

export enum PlanTier {
  Free = "free",
  Starter = "starter",
  Growth = "growth",
  Agency = "agency",
  Custom = "custom",
}

export enum BillingCycle {
  Monthly = "monthly",
  Annual = "annual",
}

// ── Arabic Dialect ───────────────────────────────────────────────
// Content generation dialect — canonical source: BrandProfile.brandDNA.contentDialect
// Set during onboarding based on brand's target market country.
// Default: 'egyptian'. Never leave contentDialect unset.

export enum ArabicDialect {
  Egyptian = "egyptian",
  Saudi = "saudi",
  Gulf = "gulf",
  Levantine = "levantine",
  Moroccan = "moroccan",
  Msa = "msa",
  English = "english",
}

export enum PlanStatus {
  Active = "active",
  Cancelled = "cancelled",
  PastDue = "past_due",
  Trialing = "trialing",
}

// ── User ─────────────────────────────────────────────────────────

export enum UserRole {
  User = "user",
  Admin = "admin",
}

export interface UserPlan {
  tier: PlanTier;
  billingCycle: BillingCycle;
  status: PlanStatus;
  currentPeriodEnd: Date;
  paymobSubscriptionId: string;
}

export interface UserLimits {
  brandsAllowed: number;
  postsPerMonth: number;
  imagesPerMonth: number;
  videosPerMonth: number;
  voiceoversPerMonth: number;
  designsPerMonth: number;
  competitorResearchPerMonth: number;
  platforms: string[];
  agentMemoryMonths: number;
  prioritySupport: boolean;
}

export interface UserUsage {
  postsGenerated: number;
  imagesGenerated: number;
  videosGenerated: number;
  voiceoversGenerated: number;
  designsGenerated: number;
  competitorResearchRuns: number;
  resetAt: Date;
}

export type UserStatus = "active" | "inactive" | "suspended" | "banned";

export type SignupProvider = "email" | "google";

export interface IAuthProvider {
  provider: "google"; // extensible — add 'facebook' | 'apple' etc. later
  providerUserId: string;
  providerEmail: string;
  linkedAt: Date;
}

export interface IUser {
  _id: string;
  email: string;
  passwordHash: string;
  name: string;
  phone: string;
  lang: "ar" | "en"; // UI language preference (default: 'ar')
  role: UserRole;
  plan: UserPlan;
  limits: UserLimits;
  usage: UserUsage;
  refreshToken?: string;
  createdAt: Date;
  lastLoginAt: Date;

  // Enhanced auth
  isEmailVerified: boolean;
  status: UserStatus;
  statusReason: string;
  statusChangedAt?: Date;
  statusChangedBy?: string; // admin userId
  signupProvider: SignupProvider;
  authProviders: IAuthProvider[];
  passwordChangedAt?: Date;
  deletedAt?: Date | null;
}

// ── Brand Profile ────────────────────────────────────────────────

export enum BrandTone {
  Professional = "professional",
  Playful = "playful",
  Bold = "bold",
  Casual = "casual",
}

export interface TargetAudience {
  ageRange: string;
  gender: string;
  interests: string[];
  painPoints: string[];
  platforms: string[];
}

export interface CompetitorInfo {
  name: string;
  website: string;
  socialHandles: Record<string, string>;
  analysis: Record<string, unknown>;
  crawlId: string;
  analyzedAt: Date;
}

// ── Research / Scraping Interfaces ───────────────────────────────

export interface ScrapeOptions {
  url: string;
  tier?: ScrapingTier; // defaults to Fast (1)
  timeout?: number; // ms, defaults to 15_000
  waitSelector?: string; // CSS selector to wait for (Dynamic/Stealth/Puppeteer only)
}

export interface ScrapeResult {
  url: string;
  title: string;
  bodyText: string; // sanitized via sanitizeScrape()
  metaDescription: string;
  headings: string[];
  tier: ScrapingTier; // which tier actually succeeded
  scrapedAt: Date;
}

export interface CrawlItem {
  url: string;
  title: string;
  headings: string[];
  bodyText: string;
  metaDescription: string;
  internalLinks: string[];
  pageNumber: number;
  crawlId: string;
}

export interface IResearchJob {
  _id: string;
  userId: string;
  brandProfileId: string;
  url: string;
  domain: string;
  status: ResearchJobStatus;
  jobId: string; // BullMQ job ID
  scrapingTier: ScrapingTier;
  pagesScraped: number;
  rawText: string;
  analysis: Record<string, unknown>;
  error: string;
  scrapedAt?: Date;
  analyzedAt?: Date;
  createdAt: Date;
}

export interface BrandDNA {
  colors: string[];
  fonts: string[];
  tone: BrandTone;
  contentDialect: ArabicDialect;
  targetAudience: TargetAudience;
  uvp: string;
  competitors: CompetitorInfo[];
}

export enum SocialPlatform {
  Facebook = "facebook",
  Instagram = "instagram",
  TikTok = "tiktok",
  Twitter = "twitter",
  YouTube = "youtube",
}

export interface SocialAccount {
  platform: SocialPlatform;
  accountId: string;
  accountHandle?: string;
  accessToken: string;
  refreshToken?: string;
  pageId?: string;
  pageName?: string;
  tokenExpiresAt?: Date;
  connectedAt: Date;
}

export interface IBrandProfile {
  _id: string;
  userId: string;
  businessName: string;
  industry: string;
  website?: string;
  targetMarket: { country: string; city?: string };
  brandDNA: BrandDNA;
  socialAccounts: SocialAccount[];
  onboardingComplete: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ── Social Media Publishing ──────────────────────────────────────

export interface PostData {
  caption: string;
  mediaUrls: string[];
  contentType: ContentType;
  hashtags?: string[];
}

export interface PublishResult {
  postId: string;
  platform: SocialPlatform;
  publishedAt: Date;
  url?: string;
}

export interface PostMetrics {
  postId: string;
  views: number;
  reach: number;
  mediaViewers: number; // alongside reach for June 2026 migration
  likes: number;
  comments: number;
  shares: number;
  saved: number;
  fetchedAt: Date;
}

export interface PageInsights {
  pageId: string;
  followers: number;
  reach: number;
  mediaViewers: number; // alongside reach for June 2026 migration
  engagement: number;
  fetchedAt: Date;
}

// ── Marketing Plan ───────────────────────────────────────────────

export enum PlanStatusType {
  Draft = "draft",
  Approved = "approved",
  Active = "active",
  Completed = "completed",
}

export interface PlanStrategy {
  objective: string;
  keyMessages: string[];
  contentPillars: string[];
  platforms: string[];
  postingFrequency: Record<string, number>;
}

export interface IMarketingPlan {
  _id: string;
  userId: string;
  brandId: string;
  month: number;
  year: number;
  status: PlanStatusType;
  strategy: PlanStrategy;
  egyptianOccasions: string[];
  createdAt: Date;
  approvedAt?: Date;
}

// ── Content ──────────────────────────────────────────────────────

export enum ContentStatus {
  PendingGeneration = "pending_generation",
  Draft = "draft",
  Approved = "approved",
  Scheduled = "scheduled",
  Posted = "posted",
}

export enum ContentType {
  Post = "post",
  Reel = "reel",
  Story = "story",
  Carousel = "carousel",
  Ad = "ad",
}

export enum AssetType {
  Image = "image",
  Video = "video",
  Voiceover = "voiceover",
  Caption = "caption",
  Design = "design",
}

export interface ContentAsset {
  type: AssetType;
  url: string;
}

export interface IContentItem {
  _id: string;
  planId: string;
  userId: string;
  brandId: string;
  date: Date;
  platform: string;
  contentType: ContentType;
  caption: string;
  hashtags: string[];
  designBrief: string;
  assets: ContentAsset[];
  status: ContentStatus;
  scheduledAt?: Date;
  postedAt?: Date;
  metrics: Record<string, unknown>;
  idempotencyKey: string;
  createdAt: Date;
  updatedAt: Date;
}

// ── Generated Asset ──────────────────────────────────────────────

export interface IGeneratedAsset {
  _id: string;
  userId: string;
  planId: string;
  contentItemId: string;
  type: AssetType;
  url: string;
  thumbnailUrl: string;
  prompt: string;
  model: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

// ── Agent Memory ─────────────────────────────────────────────────

export enum ConversationRole {
  User = "user",
  Assistant = "assistant",
  Tool = "tool",
}

export enum LearningSource {
  Conversation = "conversation",
  PerformanceReview = "performance_review",
  Feedback = "feedback",
}

// ── API Response ─────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T;
  message: string;
  errorCode?: ErrorCode;
}

// ── Error Codes ──────────────────────────────────────────────────
// Always use these codes in error responses — never raw strings.
// Frontend can switch on errorCode for specific UI handling.

export enum ErrorCode {
  // Auth
  InvalidCredentials = "AUTH_INVALID_CREDENTIALS",
  TokenExpired = "AUTH_TOKEN_EXPIRED",
  TokenInvalid = "AUTH_TOKEN_INVALID",
  RefreshTokenInvalid = "AUTH_REFRESH_TOKEN_INVALID",
  Unauthorized = "AUTH_UNAUTHORIZED",
  Forbidden = "AUTH_FORBIDDEN",

  // Email & OTP
  EmailNotVerified = "EMAIL_NOT_VERIFIED",
  OtpExpired = "OTP_EXPIRED",
  OtpInvalid = "OTP_INVALID",
  OtpResendLimit = "OTP_RESEND_LIMIT",

  // Password Reset
  PasswordResetTokenInvalid = "PASSWORD_RESET_TOKEN_INVALID",

  // Google OAuth
  GoogleAuthFailed = "GOOGLE_AUTH_FAILED",
  GoogleAuthRequired = "GOOGLE_AUTH_REQUIRED",

  // Account Status
  AccountSuspended = "ACCOUNT_SUSPENDED",
  AccountBanned = "ACCOUNT_BANNED",
  AccountInactive = "ACCOUNT_INACTIVE",

  // Validation & Resources
  ValidationError = "VALIDATION_ERROR",
  NotFound = "RESOURCE_NOT_FOUND",
  AlreadyExists = "RESOURCE_ALREADY_EXISTS",

  // Plan & Quota
  QuotaExceeded = "QUOTA_EXCEEDED",
  CostCapReached = "COST_CAP_EXCEEDED",
  PlanExpired = "SUBSCRIPTION_EXPIRED",
  PlanUpgradeRequired = "SUBSCRIPTION_REQUIRED",

  // Rate Limiting
  RateLimitExceeded = "RATE_LIMIT_EXCEEDED",

  // Infrastructure
  KillSwitchActive = "KILL_SWITCH_ACTIVE",
  ServiceUnavailable = "SERVICE_UNAVAILABLE",
  ProviderDown = "AI_PROVIDER_ERROR",
  ScrapingFailed = "SCRAPING_ERROR",
  ExternalServiceError = "EXTERNAL_SERVICE_ERROR",

  // General
  InternalError = "INTERNAL_ERROR",
  IdempotencyConflict = "IDEMPOTENCY_CONFLICT",
}

// ── Error Messages ────────────────────────────────────────────────
// Single source of truth for all user-facing error messages.
// Backend populates `message` field from here — never hardcode strings in controllers.
// Frontend can use the same map for client-side locale overrides.
// Default language: Egyptian Arabic (عامية مصرية). English provided for bilingual support.

export const ERROR_MESSAGES: Record<ErrorCode, { ar: string; en: string }> = {
  // Auth
  [ErrorCode.InvalidCredentials]: {
    ar: "الإيميل أو الباسورد غلط. حاول تاني.",
    en: "Invalid email or password. Please try again.",
  },
  [ErrorCode.TokenExpired]: {
    ar: "الجلسة انتهت. ادخل تاني.",
    en: "Your session has expired. Please log in again.",
  },
  [ErrorCode.TokenInvalid]: {
    ar: "الجلسة مش صحيحة. ادخل تاني.",
    en: "Invalid session. Please log in again.",
  },
  [ErrorCode.RefreshTokenInvalid]: {
    ar: "انتهت صلاحية الجلسة. ادخل تاني.",
    en: "Session expired. Please log in again.",
  },
  [ErrorCode.Unauthorized]: {
    ar: "محتاج تسجل دخول الأول.",
    en: "You must be logged in to do this.",
  },
  [ErrorCode.Forbidden]: {
    ar: "مش مسموحلك تعمل ده.",
    en: "You do not have permission to do this.",
  },

  // Email & OTP
  [ErrorCode.EmailNotVerified]: {
    ar: "لازم تأكد الإيميل الأول. دور على كود التفعيل في الإيميل.",
    en: "Please verify your email first. Check your inbox for the verification code.",
  },
  [ErrorCode.OtpExpired]: {
    ar: "كود التفعيل انتهت صلاحيته. اطلب كود جديد.",
    en: "Verification code has expired. Please request a new one.",
  },
  [ErrorCode.OtpInvalid]: {
    ar: "كود التفعيل غلط. حاول تاني.",
    en: "Invalid verification code. Please try again.",
  },
  [ErrorCode.OtpResendLimit]: {
    ar: "وصلت لأقصى عدد محاولات إرسال الكود. حاول بعد ساعة.",
    en: "Maximum resend attempts reached. Please try again in an hour.",
  },

  // Password Reset
  [ErrorCode.PasswordResetTokenInvalid]: {
    ar: "رابط تغيير الباسورد مش صحيح أو انتهت صلاحيته.",
    en: "Password reset link is invalid or has expired.",
  },

  // Google OAuth
  [ErrorCode.GoogleAuthFailed]: {
    ar: "تسجيل الدخول بجوجل فشل. حاول تاني.",
    en: "Google authentication failed. Please try again.",
  },
  [ErrorCode.GoogleAuthRequired]: {
    ar: "الحساب ده مربوط بجوجل. سجل دخول بجوجل بدل الإيميل والباسورد.",
    en: "This account uses Google Sign-In. Please log in with Google instead of email and password.",
  },

  // Account Status
  [ErrorCode.AccountSuspended]: {
    ar: "الحساب متوقف مؤقتاً. تواصل مع الدعم.",
    en: "Your account has been suspended. Please contact support.",
  },
  [ErrorCode.AccountBanned]: {
    ar: "الحساب ده محظور. تواصل مع الدعم لو في غلط.",
    en: "Your account has been banned. Contact support if you believe this is an error.",
  },
  [ErrorCode.AccountInactive]: {
    ar: "الحساب ده مش نشط. تواصل مع الدعم.",
    en: "Your account is inactive. Please contact support.",
  },

  // Validation & Resources
  [ErrorCode.ValidationError]: {
    ar: "في بيانات ناقصة أو غلط. راجعها وحاول تاني.",
    en: "Some fields are missing or invalid. Please check and try again.",
  },
  [ErrorCode.NotFound]: {
    ar: "مش لاقيين اللي بتدور عليه.",
    en: "The requested resource was not found.",
  },
  [ErrorCode.AlreadyExists]: {
    ar: "موجود بالفعل.",
    en: "Already exists.",
  },

  // Plan & Quota
  [ErrorCode.QuotaExceeded]: {
    ar: "وصلت للحد الأقصى في خطتك. ترقّى لخطة أعلى عشان تكمل.",
    en: "You have reached your plan limit. Upgrade to continue.",
  },
  [ErrorCode.CostCapReached]: {
    ar: "وصلنا للحد الأقصى للاستخدام الشهري. هنتواصل معاك قريباً.",
    en: "Monthly usage limit reached. We will be in touch shortly.",
  },
  [ErrorCode.PlanExpired]: {
    ar: "الاشتراك بتاعك انتهى. جدده عشان تكمل.",
    en: "Your subscription has expired. Please renew to continue.",
  },
  [ErrorCode.PlanUpgradeRequired]: {
    ar: "الميزة دي مش في خطتك الحالية. ترقّى عشان تستخدمها.",
    en: "This feature is not available on your current plan. Please upgrade.",
  },

  // Rate Limiting
  [ErrorCode.RateLimitExceeded]: {
    ar: "طلبات كتير أوي في وقت قصير. استنى شوية وحاول تاني.",
    en: "Too many requests. Please wait a moment and try again.",
  },

  // Infrastructure
  [ErrorCode.KillSwitchActive]: {
    ar: "الخدمة دي مش متاحة دلوقتي. هنرجعلك قريباً.",
    en: "This service is temporarily unavailable. We will be back shortly.",
  },
  [ErrorCode.ServiceUnavailable]: {
    ar: "الخدمة واقعة دلوقتي. حاول بعد شوية.",
    en: "Service is currently unavailable. Please try again later.",
  },
  [ErrorCode.ProviderDown]: {
    ar: "في مشكلة مع أحد مزودي الخدمة. شغلك في الطابور وهيتعمل تلقائي.",
    en: "An AI provider is experiencing issues. Your job is queued and will process automatically.",
  },
  [ErrorCode.ScrapingFailed]: {
    ar: "مقدرناش نجيب بيانات الموقع ده. حاول تاني بعد شوية.",
    en: "Could not retrieve data from that website. Please try again later.",
  },
  [ErrorCode.ExternalServiceError]: {
    ar: "في مشكلة مع خدمة خارجية. حاول تاني.",
    en: "An external service encountered an error. Please try again.",
  },

  // General
  [ErrorCode.InternalError]: {
    ar: "في مشكلة من عندنا. بنشتغل عليها. حاول تاني بعد شوية.",
    en: "Something went wrong on our end. We are working on it. Please try again shortly.",
  },
  [ErrorCode.IdempotencyConflict]: {
    ar: "العملية دي شغالة بالفعل. استنى لحد ما تخلص.",
    en: "This operation is already in progress. Please wait for it to complete.",
  },
};

// ── Helper — get message for current locale ───────────────────────
// Usage in controllers: sendError(res, 404, ErrorCode.NotFound, req)
// The sendError() function in apiResponse.ts calls getErrorMessage() automatically.

export function getErrorMessage(
  code: ErrorCode,
  lang: "ar" | "en" = "ar",
): string {
  return (
    ERROR_MESSAGES[code]?.[lang] ??
    ERROR_MESSAGES[ErrorCode.InternalError][lang]
  );
}

// ── Success Codes ────────────────────────────────────────────────

export enum SuccessCode {
  Ok = "OK",
  Created = "CREATED",
  LoggedIn = "LOGGED_IN",
  LoggedOut = "LOGGED_OUT",
  ProfileUpdated = "PROFILE_UPDATED",
  Deleted = "DELETED",
  EmailVerified = "EMAIL_VERIFIED",
  OtpSent = "OTP_SENT",
  PasswordResetVerified = "PASSWORD_RESET_VERIFIED",
  PasswordReset = "PASSWORD_RESET",
  PasswordChanged = "PASSWORD_CHANGED",
  GoogleLinked = "GOOGLE_LINKED",
  GoogleUnlinked = "GOOGLE_UNLINKED",
  UserSuspended = "USER_SUSPENDED",
  UserActivated = "USER_ACTIVATED",
  AccountDeleted = "ACCOUNT_DELETED",
  PasswordResetByAdmin = "PASSWORD_RESET_BY_ADMIN",
}

const SUCCESS_MESSAGES: Record<SuccessCode, { ar: string; en: string }> = {
  [SuccessCode.Ok]: {
    ar: "تمت العملية بنجاح",
    en: "Success",
  },
  [SuccessCode.Created]: {
    ar: "تم الإنشاء بنجاح",
    en: "Created successfully",
  },
  [SuccessCode.LoggedIn]: {
    ar: "تم تسجيل الدخول بنجاح",
    en: "Welcome back!",
  },
  [SuccessCode.LoggedOut]: {
    ar: "تم تسجيل الخروج بنجاح",
    en: "Logged out successfully",
  },
  [SuccessCode.ProfileUpdated]: {
    ar: "تم تحديث الملف الشخصي بنجاح",
    en: "Profile updated successfully",
  },
  [SuccessCode.Deleted]: {
    ar: "تم الحذف بنجاح",
    en: "Deleted successfully",
  },
  [SuccessCode.EmailVerified]: {
    ar: "تم تأكيد الإيميل بنجاح",
    en: "Email verified successfully",
  },
  [SuccessCode.OtpSent]: {
    ar: "تم إرسال كود التفعيل لإيميلك",
    en: "Verification code sent to your email",
  },
  [SuccessCode.PasswordResetVerified]: {
    ar: "تم التحقق من الكود. استخدم التوكن لتغيير الباسورد.",
    en: "OTP verified. Use the reset token to set a new password.",
  },
  [SuccessCode.PasswordReset]: {
    ar: "تم تغيير الباسورد بنجاح. ادخل بالباسورد الجديد.",
    en: "Password reset successfully. Please log in with your new password.",
  },
  [SuccessCode.PasswordChanged]: {
    ar: "تم تغيير الباسورد بنجاح",
    en: "Password changed successfully",
  },
  [SuccessCode.GoogleLinked]: {
    ar: "تم ربط حساب جوجل بنجاح",
    en: "Google account linked successfully",
  },
  [SuccessCode.GoogleUnlinked]: {
    ar: "تم فصل حساب جوجل بنجاح",
    en: "Google account unlinked successfully",
  },
  [SuccessCode.UserSuspended]: {
    ar: "تم إيقاف المستخدم",
    en: "User suspended",
  },
  [SuccessCode.UserActivated]: {
    ar: "تم تفعيل المستخدم",
    en: "User activated",
  },
  [SuccessCode.AccountDeleted]: {
    ar: "تم حذف الحساب نهائياً",
    en: "Account permanently deleted",
  },
  [SuccessCode.PasswordResetByAdmin]: {
    ar: "تم إعادة تعيين كلمة المرور بواسطة الأدمن",
    en: "Password has been reset by admin",
  },
};

export function getSuccessMessage(
  code: SuccessCode,
  lang: "ar" | "en" = "ar",
): string {
  return (
    SUCCESS_MESSAGES[code]?.[lang] ?? SUCCESS_MESSAGES[SuccessCode.Ok][lang]
  );
}

// ── Kill Switch Keys ─────────────────────────────────────────────

export enum KillSwitch {
  DeepResearch = "KILL_DEEP_RESEARCH",
  Opus = "KILL_OPUS",
  Video = "KILL_VIDEO",
  Voiceover = "KILL_VOICEOVER",
  Content = "KILL_CONTENT",
  Agent = "KILL_AGENT",
  All = "KILL_ALL",
}

// ── Scraping Tiers ───────────────────────────────────────────────
// Tiered escalation: Fast (static) → Dynamic (JS render) → Stealth (anti-bot bypass) → Puppeteer (last resort)
// Each tier adds latency + resource cost. Always start at Tier 1.

export enum ScrapingTier {
  Fast = 1,
  Dynamic = 2,
  Stealth = 3,
  Puppeteer = 4,
}

// ── Research Job Status ──────────────────────────────────────────
// State machine: pending → scraping → analyzing → completed | failed
// Used by research.model.ts and BullMQ worker for status tracking.

export enum ResearchJobStatus {
  Pending = "pending",
  Scraping = "scraping",
  Analyzing = "analyzing",
  Completed = "completed",
  Failed = "failed",
}

// ── AI Usage Log ─────────────────────────────────────────────────
// Tracks every paid AI API call for cost governance.
// Separate collection, indexed for per-user and global cost dashboards.

export interface IAiUsageLog {
  userId: string;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  units?: number; // for image/video/voiceover
  estimatedCostUSD: number;
  context: string; // 'agent_chat' | 'caption_generation' | 'image_generation' | etc.
  timestamp: Date;
}
