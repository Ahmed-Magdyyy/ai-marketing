// ─────────────────────────────────────────────────────────────────
// Shared Types — Single source of truth for all enums & interfaces
// ─────────────────────────────────────────────────────────────────

// ── Model Roles ──────────────────────────────────────────────────

export enum ModelRole {
  AGENT_REASONING = "AGENT_REASONING",
  AGENT_FAST = "AGENT_FAST",
  IMAGE_PRIMARY = "IMAGE_PRIMARY",
  IMAGE_SECONDARY = "IMAGE_SECONDARY",
  EMBEDDINGS = "EMBEDDINGS",
  VIDEO_SHORT = "VIDEO_SHORT",
  VIDEO_PRESENTER = "VIDEO_PRESENTER",
  VOICEOVER = "VOICEOVER",
}

// ── Plan Tiers ───────────────────────────────────────────────────

export enum PlanTier {
  FREE = "free",
  STARTER = "starter",
  GROWTH = "growth",
  AGENCY = "agency",
  CUSTOM = "custom",
}

export enum BillingCycle {
  MONTHLY = "monthly",
  ANNUAL = "annual",
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
  ACTIVE = "active",
  CANCELLED = "cancelled",
  PAST_DUE = "past_due",
  TRIALING = "trialing",
}

// ── User ─────────────────────────────────────────────────────────

export enum UserRole {
  USER = "user",
  ADMIN = "admin",
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
}

// ── Brand Profile ────────────────────────────────────────────────

export enum BrandTone {
  PROFESSIONAL = "professional",
  PLAYFUL = "playful",
  BOLD = "bold",
  CASUAL = "casual",
}

export enum BrandDialect {
  EGYPTIAN_ARABIC = "egyptian_arabic",
  MSA = "msa",
  ENGLISH = "english",
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

export interface BrandDNA {
  colors: string[];
  fonts: string[];
  tone: BrandTone;
  dialect: BrandDialect;
  targetAudience: TargetAudience;
  uvp: string;
  competitors: CompetitorInfo[];
}

export interface SocialAccount {
  platform: string;
  accessToken: string;
  refreshToken: string;
  pageId: string;
  connectedAt: Date;
}

export interface IBrandProfile {
  _id: string;
  userId: string;
  businessName: string;
  industry: string;
  website: string;
  location: string;
  brandDNA: BrandDNA;
  socialAccounts: SocialAccount[];
  onboardingComplete: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ── Marketing Plan ───────────────────────────────────────────────

export enum PlanStatusType {
  DRAFT = "draft",
  APPROVED = "approved",
  ACTIVE = "active",
  COMPLETED = "completed",
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
  PENDING_GENERATION = "pending_generation",
  DRAFT = "draft",
  APPROVED = "approved",
  SCHEDULED = "scheduled",
  POSTED = "posted",
}

export enum ContentType {
  POST = "post",
  REEL = "reel",
  STORY = "story",
  CAROUSEL = "carousel",
  AD = "ad",
}

export enum AssetType {
  IMAGE = "image",
  VIDEO = "video",
  VOICEOVER = "voiceover",
  CAPTION = "caption",
  DESIGN = "design",
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

// ── AI Usage Log ─────────────────────────────────────────────────

export enum UsageType {
  TOKEN = "token",
  UNIT = "unit",
}

export interface IAiUsageLog {
  _id: string;
  userId: string;
  model: string;
  role: ModelRole;
  usageType: UsageType;
  inputTokens?: number;
  outputTokens?: number;
  units?: number;
  costUsd: number;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

// ── Agent Memory ─────────────────────────────────────────────────

export enum ConversationRole {
  USER = "user",
  ASSISTANT = "assistant",
  TOOL = "tool",
}

export enum LearningSource {
  CONVERSATION = "conversation",
  PERFORMANCE_REVIEW = "performance_review",
  FEEDBACK = "feedback",
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
    ar: "الحاجة دي موجودة بالفعل.",
    en: "This already exists.",
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

// ── Kill Switch Keys ─────────────────────────────────────────────

export enum KillSwitch {
  KILL_DEEP_RESEARCH = "KILL_DEEP_RESEARCH",
  KILL_OPUS = "KILL_OPUS",
  KILL_VIDEO = "KILL_VIDEO",
  KILL_VOICEOVER = "KILL_VOICEOVER",
  KILL_CONTENT = "KILL_CONTENT",
  KILL_ALL = "KILL_ALL",
}

// ── Social Platforms ─────────────────────────────────────────────

export enum SocialPlatform {
  FACEBOOK = "facebook",
  INSTAGRAM = "instagram",
  TIKTOK = "tiktok",
  TWITTER = "twitter",
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
