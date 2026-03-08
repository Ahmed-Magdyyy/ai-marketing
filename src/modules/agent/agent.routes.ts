import { Router } from "express";
import { authMiddleware } from "../auth/auth.middleware";
import { killSwitch } from "../../shared/middleware/killSwitch.middleware";
import { agentChatLimiter } from "../../shared/middleware/rateLimiter";
import { enforceSubscription } from "../../shared/middleware/planEnforcement.middleware";
import { costGuard } from "../../shared/middleware/costGuard.middleware";
import { chatHandler } from "./agent.controller";

const router = Router();

// ── POST /api/agent/chat ──────────────────────────────────────────
// Main entrypoint for the AI agent conversation.
// Protected by auth, rate limited (20 requests/min), and kill switch.

router.post(
  "/chat",
  authMiddleware,
  enforceSubscription(),
  agentChatLimiter,
  killSwitch("DISABLE_AGENT", "الوكيل الذكي مش متاح دلوقتي. هنرجعلك قريباً."),
  costGuard,
  chatHandler,
);

export default router;
