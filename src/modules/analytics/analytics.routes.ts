// ─────────────────────────────────────────────────────────────────
// Analytics Routes — all require auth + admin + analytics kill switch
// ─────────────────────────────────────────────────────────────────

import { Router } from "express";
import { authMiddleware } from "../auth/auth.middleware";
import { adminMiddleware } from "../admin/admin.middleware";
import { killSwitch } from "../../shared/middleware/killSwitch.middleware";
import {
  platformStatsHandler,
  userGrowthHandler,
  contentMetricsHandler,
  aiUsageHandler,
  revenueMetricsHandler,
} from "./analytics.controller";

const router = Router();

// All analytics routes require authentication + admin role + analytics enabled
router.use(authMiddleware, adminMiddleware, killSwitch("DISABLE_ANALYTICS"));

router.get("/platform", platformStatsHandler);
router.get("/users/growth", userGrowthHandler);
router.get("/content", contentMetricsHandler);
router.get("/ai-usage", aiUsageHandler);
router.get("/revenue", revenueMetricsHandler);

export default router;
