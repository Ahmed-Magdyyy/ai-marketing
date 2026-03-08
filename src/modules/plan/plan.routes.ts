import { Router } from "express";
import { authMiddleware } from "../auth/auth.middleware";
import { contentGenerationLimiter } from "../../shared/middleware/rateLimiter";
import {
  enforceSubscription,
  enforceQuota,
} from "../../shared/middleware/planEnforcement.middleware";
import { costGuard } from "../../shared/middleware/costGuard.middleware";
import {
  generatePlan,
  getPlan,
  approvePlan,
  updateContentItem,
} from "./plan.controller";

const router = Router();

// All plan routes require authentication + active subscription
router.use(authMiddleware);
router.use(enforceSubscription());

// ── POST /api/plan/generate ──────────────────────────────────────
// Generate a new marketing plan (rate-limited, quota + cost guarded)
router.post(
  "/generate",
  contentGenerationLimiter,
  enforceQuota("posts"),
  costGuard,
  generatePlan,
);

// ── GET /api/plan/:id ────────────────────────────────────────────
// Get plan + content items (always available — read-only)
router.get("/:id", getPlan);

// ── PUT /api/plan/:id/approve ────────────────────────────────────
// Approve a draft plan (rate-limited)
router.put("/:id/approve", contentGenerationLimiter, approvePlan);

// ── PUT /api/plan/:id/item/:itemId ───────────────────────────────
// Update a single content item
router.put("/:id/item/:itemId", updateContentItem);

export default router;
