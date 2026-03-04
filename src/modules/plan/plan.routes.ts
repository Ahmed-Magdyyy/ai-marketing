import { Router } from "express";
import { authMiddleware } from "../auth/auth.middleware";
import { contentGenerationLimiter } from "../../shared/middleware/rateLimiter";
import {
  generatePlan,
  getPlan,
  approvePlan,
  updateContentItem,
} from "./plan.controller";

const router = Router();

// All plan routes require authentication
router.use(authMiddleware);

// ── POST /api/plan/generate ──────────────────────────────────────
// Generate a new marketing plan (rate-limited)
router.post("/generate", contentGenerationLimiter, generatePlan);

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
