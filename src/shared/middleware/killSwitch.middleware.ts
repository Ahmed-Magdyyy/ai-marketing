// ─────────────────────────────────────────────────────────────────
// Kill Switch Middleware
// Set KILL_*=true in .env and restart — feature disabled platform-wide.
// ─────────────────────────────────────────────────────────────────

import { Request, Response, NextFunction } from "express";
import { ModelRole, ErrorCode, getErrorMessage } from "../types";
import { getModel } from "../config/models";
import { logger } from "../utils/logger";
import { getLang } from "../utils/apiResponse";

// ── Switch State ──────────────────────────────────────────────────
// Read once at module load from process.env. To change, update .env and restart.

const SWITCHES = {
  // Disables all competitor deep-crawl research (Scrapling Spider)
  // Use when: proxy service fails, crawl abuse detected, Scrapling service down
  DISABLE_DEEP_RESEARCH: process.env.KILL_DEEP_RESEARCH === "true",

  // Downgrades all claude-opus-4-6 calls to claude-sonnet-4-6 platform-wide
  // Use when: Anthropic Opus pricing spikes, monthly budget nearly exhausted
  DOWNGRADE_OPUS_TO_SONNET: process.env.KILL_OPUS === "true",

  // Disables all video generation jobs (Runway ML + HeyGen)
  // Use when: Runway ML outage, video API costs spike, quota exhausted
  DISABLE_VIDEO_GENERATION: process.env.KILL_VIDEO === "true",

  // Disables all voiceover generation (ElevenLabs)
  // Use when: ElevenLabs outage or quota exhausted
  DISABLE_VOICEOVER_GENERATION: process.env.KILL_VOICEOVER === "true",

  // Disables all new content generation jobs (images, video, captions, designs)
  // Use when: runaway billing detected, system overload, emergency maintenance
  DISABLE_CONTENT_GENERATION: process.env.KILL_CONTENT === "true",

  // Puts entire platform in read-only mode (no writes, no jobs, no AI calls)
  // Use when: data integrity issue detected, emergency investigation needed
  READ_ONLY_MODE: process.env.KILL_ALL === "true",

  // Disables the smart agent (chat)
  // Use when API costs spike or emergency maintenance on agent infrastructure
  DISABLE_AGENT: process.env.KILL_AGENT === "true",

  // Disables all payment gateway operations (Paymob checkout)
  // Use when: Paymob outage, payment processing issues, or billing maintenance
  DISABLE_PAYMENT_GATEWAYS: process.env.KILL_PAYMENT_GATEWAYS === "true",

  // Disables subscription management (cancel, upgrade, downgrade)
  // Use when: billing system maintenance, plan migration in progress
  DISABLE_SUBSCRIPTION_MANAGEMENT:
    process.env.KILL_SUBSCRIPTION_MANAGEMENT === "true",

  // Disables analytics endpoints
  // Use when: heavy aggregation queries impacting DB performance
  DISABLE_ANALYTICS: process.env.KILL_ANALYTICS === "true",
} as const;

// ── Switch Name Type ──────────────────────────────────────────────

type SwitchName = keyof typeof SWITCHES;

// ── Middleware Factory ────────────────────────────────────────────
// Usage: killSwitch('DISABLE_DEEP_RESEARCH')
// Usage: killSwitch('DISABLE_AGENT', 'الوكيل الذكي مش متاح دلوقتي.')

function killSwitch(
  switchName: SwitchName,
  customMessage?: string,
): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction): void => {
    const active = SWITCHES[switchName] || SWITCHES.READ_ONLY_MODE;

    if (active) {
      const firedSwitch: string = SWITCHES.READ_ONLY_MODE
        ? "READ_ONLY_MODE"
        : switchName;

      // req.user is typed via Express.Request augmentation in auth.middleware.ts
      logger.warn("kill_switch_fired", {
        switch: firedSwitch,
        path: req.path,
        userId: req.user?._id?.toString() || "unauthenticated",
      });

      // Fire asynchronous alert without blocking
      import("../utils/alerting").then(({ sendAlert }) => {
        sendAlert("KillSwitchFired", {
          severity: "WARNING",
          message: `Kill switch [${firedSwitch}] intercepted a request.`,
          context: { path: req.path, userId: req.user?._id?.toString() },
        }).catch(err => logger.error("Failed to send alert", { error: err }));
      });

      const lang = getLang(req);
      const message =
        customMessage ?? getErrorMessage(ErrorCode.KillSwitchActive, lang);

      res.status(503).json({
        success: false,
        message,
        errorCode: ErrorCode.KillSwitchActive,
        data: { switchActive: firedSwitch },
      });
      return;
    }

    next();
  };
}

// ── getReasoningModel ─────────────────────────────────────────────
// Used in agent.service.ts instead of getModel(ModelRole.AgentReasoning).
// When KILL_OPUS is active, automatically downgrades to Sonnet.

function getReasoningModel(): string {
  if (SWITCHES.DOWNGRADE_OPUS_TO_SONNET) {
    return getModel(ModelRole.AgentFast); // Downgrade to Sonnet
  }
  return getModel(ModelRole.AgentReasoning);
}

export { SWITCHES, SwitchName, killSwitch, getReasoningModel };
