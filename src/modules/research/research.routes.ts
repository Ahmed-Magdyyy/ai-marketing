import { Router } from "express";
import { authMiddleware } from "../auth/auth.middleware";
import { killSwitch } from "../../shared/middleware/killSwitch.middleware";
import {
  enqueueDeepCrawl,
  scrapeSinglePage,
  getJobStatus,
} from "./research.controller";

const router = Router();

// All research routes require authentication
router.use(authMiddleware);

// ── POST /api/research/crawl ─────────────────────────────────────
// Enqueue a deep crawl job (guarded by DISABLE_DEEP_RESEARCH kill switch)
router.post(
  "/crawl",
  killSwitch(
    "DISABLE_DEEP_RESEARCH",
    "خدمة تحليل المنافسين مش متاحة دلوقتي. هنرجعلك قريباً.",
  ),
  enqueueDeepCrawl,
);

// ── POST /api/research/scrape ────────────────────────────────────
// Single-page scrape (no kill switch — lightweight operation)
router.post("/scrape", scrapeSinglePage);

// ── GET /api/research/job/:jobId ─────────────────────────────────
// Poll job status (always available — read-only)
router.get("/job/:jobId", getJobStatus);

export default router;
