// ─────────────────────────────────────────────────────────────────
// Social Routes
// GET    /api/social/connect/:platform        — get OAuth URL
// GET    /api/social/callback                 — OAuth callback (FIXED URL)
// POST   /api/social/publish/:contentItemId   — publish content
// POST   /api/social/schedule/:contentItemId  — schedule content
// GET    /api/social/accounts/:brandId        — list connected accounts
// DELETE /api/social/accounts/:brandId/:platform — disconnect account
// ─────────────────────────────────────────────────────────────────

import { Router } from "express";
import { authMiddleware } from "../auth/auth.middleware";
import { contentGenerationLimiter } from "../../shared/middleware/rateLimiter";
import {
  enforceSubscription,
  enforceQuota,
} from "../../shared/middleware/planEnforcement.middleware";
import { costGuard } from "../../shared/middleware/costGuard.middleware";
import {
  getAuthUrl,
  handleOAuthCallback,
  publishContentHandler,
  scheduleContentHandler,
  listAccountsHandler,
  disconnectAccountHandler,
} from "./social.controller";

const router = Router();

// ── OAuth callback — NO auth middleware (user is mid-redirect) ───
// Fixed URL: /api/social/callback — Meta requires exact match
router.get("/callback", handleOAuthCallback);

// ── All remaining routes require authentication + active subscription ──
router.use(authMiddleware);
router.use(enforceSubscription());

// ── GET /api/social/connect/:platform ────────────────────────────
// Get the OAuth authorization URL for a platform
router.get("/connect/:platform", getAuthUrl);

// ── POST /api/social/publish/:contentItemId ──────────────────────
// Publish content to social media (rate-limited, quota + cost guarded)
router.post(
  "/publish/:contentItemId",
  contentGenerationLimiter,
  enforceQuota("posts"),
  costGuard,
  publishContentHandler,
);

// ── POST /api/social/schedule/:contentItemId ─────────────────────
// Schedule content for future publication (rate-limited, quota + cost guarded)
router.post(
  "/schedule/:contentItemId",
  contentGenerationLimiter,
  enforceQuota("posts"),
  costGuard,
  scheduleContentHandler,
);

// ── GET /api/social/accounts/:brandId ────────────────────────────
// List all connected social accounts for a brand
router.get("/accounts/:brandId", listAccountsHandler);

// ── DELETE /api/social/accounts/:brandId/:platform ───────────────
// Disconnect a social account
router.delete("/accounts/:brandId/:platform", disconnectAccountHandler);

export default router;
