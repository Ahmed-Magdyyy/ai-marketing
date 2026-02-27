// ─────────────────────────────────────────────────────────────────
// AI Cost Tracker
// Every paid AI API call MUST be tracked here. No exceptions.
// Load costs from model-costs.json — update that file when pricing changes.
// ─────────────────────────────────────────────────────────────────

import MODEL_COSTS from "../config/model-costs.json";
import { AiUsageLog } from "../models/AiUsageLog.model";
import { logger } from "./logger";

// ── Type for model-costs.json entries ────────────────────────────

interface TokenCost {
  input: number;
  output: number;
}

interface UnitCost {
  perImage?: number;
  perSecond?: number;
  perChar?: number;
}

type ModelCostEntry = TokenCost | UnitCost;

// Type the JSON import as a Record
const COSTS = MODEL_COSTS as Record<string, ModelCostEntry>;

// ── Type guards ──────────────────────────────────────────────────

function isTokenCost(entry: ModelCostEntry): entry is TokenCost {
  return "input" in entry && "output" in entry;
}

function isUnitCost(entry: ModelCostEntry): entry is UnitCost {
  return "perImage" in entry || "perSecond" in entry || "perChar" in entry;
}

// ── trackTokenUsage ──────────────────────────────────────────────
// Call after every LLM / embedding API response.
// Calculates cost from token counts using model-costs.json pricing.

async function trackTokenUsage(
  userId: string,
  model: string,
  inputTokens: number,
  outputTokens: number,
  context: string = "unknown",
): Promise<void> {
  const costs = COSTS[model];
  if (!costs) {
    // Unknown model — log warning but don't throw (non-blocking)
    logger.warn("ai_cost_tracker_unknown_model", { model, context });
    return;
  }

  // Image/video/voiceover costs are tracked separately via trackUnitUsage
  const estimatedCostUSD = isTokenCost(costs)
    ? (inputTokens / 1_000_000) * costs.input +
      (outputTokens / 1_000_000) * costs.output
    : 0;

  await AiUsageLog.create({
    userId,
    model,
    inputTokens,
    outputTokens,
    estimatedCostUSD: parseFloat(estimatedCostUSD.toFixed(6)),
    context,
    timestamp: new Date(),
  });
}

// ── trackUnitUsage ───────────────────────────────────────────────
// Call after every image generation, video generation, or voiceover call.
// Units: image count, video seconds, or character count depending on model.

async function trackUnitUsage(
  userId: string,
  model: string,
  units: number,
  context: string = "unknown",
): Promise<void> {
  const costs = COSTS[model];
  if (!costs) {
    logger.warn("ai_cost_tracker_unknown_model", { model, context });
    return;
  }

  if (!isUnitCost(costs)) {
    logger.warn("ai_cost_tracker_not_unit_model", { model, context });
    return;
  }

  const estimatedCostUSD = costs.perImage
    ? units * costs.perImage
    : costs.perSecond
      ? units * costs.perSecond
      : costs.perChar
        ? units * costs.perChar
        : 0;

  await AiUsageLog.create({
    userId,
    model,
    units,
    estimatedCostUSD: parseFloat(estimatedCostUSD.toFixed(6)),
    context,
    timestamp: new Date(),
  });
}

export { trackTokenUsage, trackUnitUsage };
