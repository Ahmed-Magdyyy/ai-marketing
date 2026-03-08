// ─────────────────────────────────────────────────────────────────
// Admin Routes — all require auth + admin role
// ─────────────────────────────────────────────────────────────────

import { Router } from "express";
import { authMiddleware } from "../auth/auth.middleware";
import { adminMiddleware } from "./admin.middleware";
import {
  listUsersHandler,
  getUserHandler,
  updateUserStatusHandler,
  deleteUserHandler,
  hardDeleteUserHandler,
  adminResetPasswordHandler,
  adminSetPlanTierHandler,
  adminResetUsageHandler,
  adminExtendSubscriptionHandler,
} from "./admin.controller";

const router = Router();

// All admin routes require authentication + admin role
router.use(authMiddleware, adminMiddleware);

router.get("/users", listUsersHandler);
router.get("/users/:userId", getUserHandler);
router.patch("/users/:userId/status", updateUserStatusHandler);
router.patch("/users/:userId/password", adminResetPasswordHandler);
router.delete("/users/:userId", deleteUserHandler);
router.delete("/users/:userId/hard", hardDeleteUserHandler);

// ── Phase 9: Admin Billing Overrides ─────────────────────────────
router.put("/users/:userId/plan", adminSetPlanTierHandler);
router.post("/users/:userId/reset-usage", adminResetUsageHandler);
router.post(
  "/users/:userId/extend-subscription",
  adminExtendSubscriptionHandler,
);

export default router;
