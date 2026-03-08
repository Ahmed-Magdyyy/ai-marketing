import { Router } from "express";
import { authMiddleware } from "../auth/auth.middleware";
import { killSwitch } from "../../shared/middleware/killSwitch.middleware";
import {
  enforceSubscription,
  enforceQuota,
} from "../../shared/middleware/planEnforcement.middleware";
import {
  enqueueDeepCrawl,
  scrapeSinglePage,
  getJobStatus,
} from "./research.controller";

const router = Router();

// All research routes require authentication + active subscription
router.use(authMiddleware);
router.use(enforceSubscription());

// ── POST /api/research/crawl ─────────────────────────────────────
// Enqueue a deep crawl job (kill switch + quota-guarded)
router.post(
  "/crawl",
  killSwitch(
    "DISABLE_DEEP_RESEARCH",
    "خدمة تحليل المنافسين مش متاحة دلوقتي. هنرجعلك قريباً.",
  ),
  enforceQuota("competitorResearch"),
  enqueueDeepCrawl,
);

// ── POST /api/research/scrape ────────────────────────────────────
// Single-page scrape (no kill switch — lightweight operation)
router.post("/scrape", scrapeSinglePage);

// ── GET /api/research/job/:jobId ─────────────────────────────────
// Poll job status (always available — read-only)
router.get("/job/:jobId", getJobStatus);

export default router;
